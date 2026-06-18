using NhaTro.Dtos.Assistant;

namespace NhaTro.Interfaces.Services
{
    public interface IAssistantService
    {
        Task<AssistantResponseDto> HandleMessageAsync(string message);
        Task<AssistantResponseDto> ExecuteAsync(string commandId);
    }
}
