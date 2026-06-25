using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("admin_organization_memberships")]
    public class AdminOrganizationMembership
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

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("can_access_all_pages")]
        public bool CanAccessAllPages { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
