using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Tenants
{
    public class UpdateTenantDto
    {
        [Required]
        [MaxLength(255)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Phone { get; set; }

        [MaxLength(50)]
        public string? CCCD { get; set; }
    }
}