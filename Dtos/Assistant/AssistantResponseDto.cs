namespace NhaTro.Dtos.Assistant
{
    public class AssistantResponseDto
    {
        public string Type { get; set; } = "message";
        public string Intent { get; set; } = string.Empty;
        public string Parser { get; set; } = "rule";
        public double Confidence { get; set; } = 1;
        public string Reason { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public AssistantCommandDto? Command { get; set; }
        public AssistantCommandDto? PendingCommand { get; set; }
        public string? CommandId { get; set; }
        public object? Preview { get; set; }
        public object? Result { get; set; }
        public AssistantAgentPlanDto? AgentPlan { get; set; }
        public AssistantAgentExecutionDto? AgentExecution { get; set; }
        public List<string> Suggestions { get; set; } = new();
        public List<AssistantActionSuggestionDto> ActionSuggestions { get; set; } = new();
        public bool RequiresStrongConfirmation { get; set; }
    }

    public class AssistantActionSuggestionDto
    {
        public string Intent { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
    }
}
