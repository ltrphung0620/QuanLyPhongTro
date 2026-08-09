using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("support_messages")]
    public class SupportMessage
    {
        public int SupportMessageId { get; set; }

        public int SupportConversationId { get; set; }
        public SupportConversation Conversation { get; set; } = null!;

        public int SenderUserId { get; set; }
        public AppUser SenderUser { get; set; } = null!;

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? ImagePath { get; set; }

        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; }
    }
}
