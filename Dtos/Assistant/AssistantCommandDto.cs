namespace NhaTro.Dtos.Assistant
{
    public class AssistantCommandDto
    {
        public string Intent { get; set; } = string.Empty;
        public Dictionary<string, string?> Params { get; set; } = new();
        public List<string> MissingFields { get; set; } = new();
        public bool RequiresConfirmation { get; set; }
        public double Confidence { get; set; } = 1;
        public string Reason { get; set; } = string.Empty;
    }
}
