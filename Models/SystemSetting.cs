using System.ComponentModel.DataAnnotations;

namespace NhaTro.Models
{
    public class SystemSetting
    {
        [Key]
        [MaxLength(100)]
        public string SettingKey { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string SettingValue { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public int AppUserId { get; set; }
        public AppUser? AppUser { get; set; }

        public int OrganizationId { get; set; }
        public Organization? Organization { get; set; }

    }
}