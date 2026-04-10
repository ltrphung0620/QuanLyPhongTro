using System.ComponentModel.DataAnnotations;

namespace NhaTro.Models
{
    public class EmailNotification
    {
        public int EmailNotificationId { get; set; }

        [MaxLength(50)]
        public string? NotificationType { get; set; }

        [MaxLength(255)]
        public string? TargetEmail { get; set; }

        [MaxLength(255)]
        public string? Subject { get; set; }

        public string? PayloadJson { get; set; }

        [MaxLength(20)]
        public string? Status { get; set; } // pending | sent | failed

        public DateTime? SentAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}