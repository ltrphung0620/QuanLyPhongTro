using NhaTro.Dtos.Assistant;
using NhaTro.Services;

namespace NhaTro.Interfaces.Services
{
    public interface IAssistantCommandParser
    {
        Task<AssistantParseResult> ParseAsync(string message, AssistantCommandDto? context = null);
        AssistantCommandDto Normalize(AssistantCommandDto command);
    }
}
