using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace NhaTro.Services
{
    public class AuthService : IAuthService
    {
        private readonly NhaTroDbContext _context;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;

        public AuthService(NhaTroDbContext context, IEmailService emailService, IConfiguration configuration)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
        }

        public async Task<bool> RegisterAsync(RegisterDto dto)
        {
            // Public registration is disabled
            return false;
        }

        public async Task<bool> VerifyOtpAsync(VerifyOtpDto dto)
        {
            // OTP verification is disabled
            return false;
        }
        public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
        {
            var loginName = NormalizeLoginName(dto.Email);
            var user = await _context.Users
                .IgnoreQueryFilters()
                .Include(u => u.Organization)
                .FirstOrDefaultAsync(u =>
                    u.Email.ToLower() == loginName ||
                    u.Username.ToLower() == loginName);

            if (user == null)
            {
                throw new InvalidOperationException("Tên đăng nhập hoặc Email không tồn tại.");
            }

            if (!user.IsActive)
            {
                throw new InvalidOperationException("Tài khoản đã bị khóa hoặc ngừng hoạt động.");
            }

            // Check if organization is active (skip for SuperAdmins as organizationId is null)
            if (user.OrganizationId.HasValue && user.Organization != null && !user.Organization.IsActive)
            {
                throw new InvalidOperationException("Tổ chức của tài khoản này đã bị khóa hoặc ngừng hoạt động.");
            }

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                throw new InvalidOperationException("Mật khẩu không chính xác.");
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var keyStr = _configuration["Jwt:Key"];
            if (string.IsNullOrEmpty(keyStr))
            {
                throw new InvalidOperationException("JWT Key is missing from configuration.");
            }
            
            var key = Encoding.UTF8.GetBytes(keyStr);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim("userId", user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("role", user.Role)
            };

            if (user.OrganizationId.HasValue)
            {
                claims.Add(new Claim("organizationId", user.OrganizationId.Value.ToString()));
            }

            if (user.TenantId.HasValue)
            {
                claims.Add(new Claim("tenantId", user.TenantId.Value.ToString()));
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(double.Parse(_configuration["Jwt:ExpireMinutes"] ?? "10")),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            // Update last login timestamp
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new AuthResponseDto
            {
                Token = tokenHandler.WriteToken(token),
                Email = user.Email,
                UserId = user.Id
            };
        }

        private static string NormalizeLoginName(string value)
        {
            var normalized = value.Trim().ToLowerInvariant();
            return normalized.StartsWith('@') ? normalized[1..] : normalized;
        }

        public async Task<bool> ChangePasswordAsync(int userId, string oldPassword, string newPassword)
        {
            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return false;
            }

            if (!BCrypt.Net.BCrypt.Verify(oldPassword, user.PasswordHash))
            {
                return false;
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.MustChangePassword = false;
            await _context.SaveChangesAsync();

            return true;
        }
    }
}
