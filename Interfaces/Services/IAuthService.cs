using NhaTro.Dtos;

namespace NhaTro.Interfaces.Services
{
    public interface IAuthService
    {
        Task<bool> RegisterAsync(RegisterDto dto);
        Task<bool> VerifyOtpAsync(VerifyOtpDto dto);
        Task<AuthResponseDto?> LoginAsync(LoginDto dto);
    }
}
