using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Interfaces.Services;
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

            return Ok(new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                DisplayName = user.DisplayName,
                Role = user.Role,
                OrganizationId = user.OrganizationId,
                TenantId = user.TenantId,
                MustChangePassword = user.MustChangePassword,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt
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
    }
}
