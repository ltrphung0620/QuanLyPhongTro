namespace NhaTro.Dtos.Assistant
{
    public class AssistantAgentPlanDto
    {
        public string Goal { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public List<AssistantAgentPlanStepDto> Steps { get; set; } = new();
        public List<string> MissingInformation { get; set; } = new();
        public bool RequiresConfirmation { get; set; }
        public string RiskLevel { get; set; } = "low";
        public double Confidence { get; set; } = 1;
        public string Reason { get; set; } = string.Empty;
        public string Planner { get; set; } = "gemini";
    }

    public class AssistantAgentPlanStepDto
    {
        public int StepNumber { get; set; }
        public string Tool { get; set; } = string.Empty;
        public string Intent { get; set; } = string.Empty;
        public Dictionary<string, string?> Args { get; set; } = new();
        public string Purpose { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public string StopIf { get; set; } = string.Empty;
        public List<int> DependsOn { get; set; } = new();
        public bool RequiresConfirmation { get; set; }
        public string RiskLevel { get; set; } = "low";
    }
}
