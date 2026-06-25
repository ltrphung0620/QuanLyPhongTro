using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Interfaces.Services;
using System.Linq;
using System.Threading.Tasks;

namespace NhaTro.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ICurrentUserService _currentUserService;
        private readonly NhaTroDbContext _context;

        public AuthController(
            IAuthService authService,
            ICurrentUserService currentUserService,
            NhaTroDbContext context)
        {
            _authService = authService;
            _currentUserService = currentUserService;
            _context = context;
        }

        [HttpPost("register")]
        public IActionResult Register([FromBody] RegisterDto dto)
        {
            return BadRequest(new { message = "Đăng ký tài khoản công khai bị vô hiệu hóa." });
        }

        [HttpPost("verify-otp")]
        public IActionResult VerifyOtp([FromBody] VerifyOtpDto dto)
        {
            return BadRequest(new { message = "Xác thực OTP công khai bị vô hiệu hóa." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            try
            {
                var response = await _authService.LoginAsync(dto);
                if (response == null) return Unauthorized(new { message = "Đăng nhập thất bại." });

                return Ok(response);
            }
            catch (System.InvalidOperationException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetMe()
        {
            var userId = _currentUserService.UserId;
            var user = await _context.Users
                .IgnoreQueryFilters()
                .Include(u => u.Organization)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng." });

            var orgs = new List<UserOrganizationDto>();
            UserOrganizationDto? activeOrg = null;

            if (user.Role == "Admin")
            {
                var memberships = await _context.AdminOrganizationMemberships
                    .IgnoreQueryFilters()
                    .Include(m => m.Organization)
                    .Where(m => m.UserId == userId && m.IsActive && m.Organization.IsActive)
                    .ToListAsync();

                var permissions = await _context.AdminOrganizationPagePermissions
                    .IgnoreQueryFilters()
                    .Where(p => p.UserId == userId && p.CanAccess)
                    .ToListAsync();

                orgs = memberships.Select(m => new UserOrganizationDto
                {
                    Id = m.OrganizationId,
                    Name = m.Organization.Name,
                    Code = m.Organization.Code,
                    IsActive = m.Organization.IsActive,
                    HasFullAccess = m.CanAccessAllPages,
                    PagePermissions = permissions
                        .Where(p => p.OrganizationId == m.OrganizationId)
                        .Select(p => p.PageKey)
                        .ToList()
                }).ToList();

                int? headerOrgId = null;
                if (Request.Headers.TryGetValue("X-Organization-Id", out var values) &&
                    int.TryParse(values.FirstOrDefault(), out var parsedId))
                {
                    headerOrgId = parsedId;
                }

                if (headerOrgId.HasValue)
                {
                    activeOrg = orgs.FirstOrDefault(o => o.Id == headerOrgId.Value);
                }

                if (activeOrg == null && orgs.Count == 1)
                {
                    activeOrg = orgs[0];
                }
            }

            return Ok(new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                DisplayName = user.DisplayName,
                Role = user.Role,
                OrganizationId = activeOrg?.Id ?? user.OrganizationId,
                TenantId = user.TenantId,
                MustChangePassword = user.MustChangePassword,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                HasFullAccess = user.Role == "Admin" ? (activeOrg?.HasFullAccess ?? false) : (user.PagePermissions == "*"),
                PagePermissions = user.Role == "Admin" ? (activeOrg?.PagePermissions ?? new List<string>()) : ParsePagePermissions(user.PagePermissions),
                Organizations = orgs,
                ActiveOrganization = activeOrg
            });
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = _currentUserService.UserId;
            var result = await _authService.ChangePasswordAsync(userId, dto.OldPassword, dto.NewPassword);

            if (!result) return BadRequest(new { message = "Mật khẩu cũ không chính xác hoặc thay đổi mật khẩu thất bại." });

            return Ok(new { message = "Đổi mật khẩu thành công." });
        }
        private static System.Collections.Generic.List<string> ParsePagePermissions(string? value)
        {
            if (string.IsNullOrWhiteSpace(value) || value == "*")
            {
                return new System.Collections.Generic.List<string>();
            }

            return value
                .Split(',', System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries)
                .Distinct(System.StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }
}
