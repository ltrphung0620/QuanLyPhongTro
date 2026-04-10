using System.ComponentModel.DataAnnotations;

namespace NhaTro.Models
{
    public class Tenant
    {
        public int TenantId { get; set; }

        [Required]
        [MaxLength(255)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(50)]
        public string? CCCD { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
    }
}