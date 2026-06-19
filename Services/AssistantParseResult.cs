using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantParseResult
    {
        public AssistantCommandDto Command { get; set; } = new();
        public string Parser { get; set; } = "rule";
    }
}
