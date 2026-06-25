using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("admin_organization_page_permissions")]
    public class AdminOrganizationPagePermission
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }
        public AppUser User { get; set; } = null!;

        [Column("organization_id")]
        public int OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        [Column("page_key")]
        public string PageKey { get; set; } = string.Empty;

        [Column("can_access")]
        public bool CanAccess { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
