namespace NhaTro.Services
{
    public static class AssistantToolModes
    {
        public const string Read = "read";
        public const string Write = "write";
        public const string Agent = "agent";
    }

    public static class AssistantToolRiskLevels
    {
        public const string Low = "low";
        public const string Medium = "medium";
        public const string High = "high";
    }

    public class AssistantToolDefinition
    {
        public string Name { get; init; } = string.Empty;
        public string Intent { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string Mode { get; init; } = AssistantToolModes.Read;
        public string RiskLevel { get; init; } = AssistantToolRiskLevels.Low;
        public bool RequiresConfirmation { get; init; }
        public bool RequiresStrongConfirmation { get; init; }
        public bool CanExecute { get; init; } = true;
        public AssistantToolParameterDefinition[] Parameters { get; init; } = Array.Empty<AssistantToolParameterDefinition>();
        public string[] Examples { get; init; } = Array.Empty<string>();
        public string OutputDescription { get; init; } = string.Empty;
    }

    public class AssistantToolParameterDefinition
    {
        public string Name { get; init; } = string.Empty;
        public string Type { get; init; } = "string";
        public string Description { get; init; } = string.Empty;
        public bool Required { get; init; }
    }
}
