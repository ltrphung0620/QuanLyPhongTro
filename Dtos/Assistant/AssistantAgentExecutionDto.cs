namespace NhaTro.Dtos.Assistant
{
    public class AssistantAgentExecutionDto
    {
        public string StateId { get; set; } = string.Empty;
        public AssistantAgentPlanDto Plan { get; set; } = new();
        public List<AssistantAgentStepExecutionDto> Steps { get; set; } = new();
        public bool Completed { get; set; }
        public bool WaitingForConfirmation { get; set; }
        public string? PendingCommandId { get; set; }
        public int NextStepNumber { get; set; } = 1;
        public string StopReason { get; set; } = string.Empty;
    }

    public class AssistantAgentStepExecutionDto
    {
        public int StepNumber { get; set; }
        public string Tool { get; set; } = string.Empty;
        public string Intent { get; set; } = string.Empty;
        public string Purpose { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
        public string ResponseType { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public object? Observation { get; set; }
    }
}
