using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Assistant
{
    public class AssistantMessageRequestDto
    {
        [Required]
        public string Message { get; set; } = string.Empty;
    }
}
