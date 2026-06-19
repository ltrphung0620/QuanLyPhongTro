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
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            {
                return false; // User already exists
            }

            var otp = new Random().Next(100000, 999999).ToString();
            var user = new AppUser
            {
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                IsActive = false,
                OtpCode = otp,
                OtpExpiryTime = DateTime.UtcNow.AddMinutes(5)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await _emailService.SendOtpEmailAsync(user.Email, otp);

            return true;
        }

        public async Task<bool> VerifyOtpAsync(VerifyOtpDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null || user.OtpCode != dto.OtpCode)
            {
                return false;
            }

            if (user.OtpExpiryTime < DateTime.UtcNow)
            {
                return false; // OTP expired
            }

            user.IsActive = true;
            user.OtpCode = null;
            user.OtpExpiryTime = null;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null || !user.IsActive)
            {
                return null;
            }

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                return null;
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var keyStr = _configuration["Jwt:Key"];
            if (string.IsNullOrEmpty(keyStr))
            {
                throw new InvalidOperationException("JWT Key is missing from configuration.");
            }
            
            var key = Encoding.UTF8.GetBytes(keyStr);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email)
                }),
                Expires = DateTime.UtcNow.AddMinutes(double.Parse(_configuration["Jwt:ExpireMinutes"] ?? "10")),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            return new AuthResponseDto
            {
                Token = tokenHandler.WriteToken(token),
                Email = user.Email,
                UserId = user.Id
            };
        }
    }
}
