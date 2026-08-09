using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Support
{
    public class SupportConversationDto
    {
        public int SupportConversationId { get; set; }
        public int AdminUserId { get; set; }
        public string AdminName { get; set; } = string.Empty;
        public string AdminEmail { get; set; } = string.Empty;
        public List<string> OrganizationNames { get; set; } = new();
        public string? LastMessage { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public int UnreadCount { get; set; }
    }

    public class SupportMessageDto
    {
        public int SupportMessageId { get; set; }
        public int SupportConversationId { get; set; }
        public int SenderUserId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string SenderRole { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? ImagePath { get; set; }
        public DateTime SentAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public bool IsMine { get; set; }
    }

    public class SupportMessagePageDto
    {
        public List<SupportMessageDto> Items { get; set; } = new();
        public bool HasMore { get; set; }
    }

    public class SendSupportMessageDto
    {
        [StringLength(2000)]
        public string? Content { get; set; }
        public IFormFile? Image { get; set; }
    }
}
