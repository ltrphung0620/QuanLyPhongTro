using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantParseResult
    {
        public AssistantCommandDto Command { get; set; } = new();
        public string Parser { get; set; } = "rule";
        public double Confidence { get; set; } = 1;
        public string Reason { get; set; } = string.Empty;
    }
}
