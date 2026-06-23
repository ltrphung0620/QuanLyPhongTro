using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("tenant_device_tokens")]
    public class TenantDeviceToken
    {
        public int TenantDeviceTokenId { get; set; }

        public int TenantId { get; set; }
        public Tenant? Tenant { get; set; }

        public int OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public int AppUserId { get; set; }
        public AppUser? AppUser { get; set; }

        [Required]
        [MaxLength(255)]
        public string ExpoPushToken { get; set; } = string.Empty;

        [MaxLength(30)]
        public string? Platform { get; set; }

        [MaxLength(120)]
        public string? DeviceName { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastSeenAt { get; set; }
    }
}
