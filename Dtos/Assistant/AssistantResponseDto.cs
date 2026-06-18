namespace NhaTro.Dtos.Assistant
{
    public class AssistantResponseDto
    {
        public string Type { get; set; } = "message";
        public string Intent { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? CommandId { get; set; }
        public object? Preview { get; set; }
        public object? Result { get; set; }
        public List<string> Suggestions { get; set; } = new();
    }
}
