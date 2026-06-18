using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var result = await _authService.RegisterAsync(dto);
            if (!result) return BadRequest(new { message = "Email already exists or failed to register." });

            return Ok(new { message = "Registration successful. Please check your email for the OTP." });
        }

        [HttpPost("verify-otp")]
        public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var result = await _authService.VerifyOtpAsync(dto);
            if (!result) return BadRequest(new { message = "Invalid or expired OTP." });

            return Ok(new { message = "OTP verified successfully. You can now login." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var response = await _authService.LoginAsync(dto);
            if (response == null) return Unauthorized(new { message = "Invalid credentials or account is inactive." });

            return Ok(response);
        }
    }
}
