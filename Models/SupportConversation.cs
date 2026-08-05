using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("support_conversations")]
    public class SupportConversation
    {
        public int SupportConversationId { get; set; }

        public int AdminUserId { get; set; }
        public AppUser AdminUser { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastMessageAt { get; set; }

        public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
    }
}
