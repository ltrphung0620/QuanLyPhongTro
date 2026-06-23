using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    [Table("organizations")]
    public class Organization
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("code")]
        public string Code { get; set; } = string.Empty;

        [MaxLength(255)]
        [Column("owner_name")]
        public string? OwnerName { get; set; }

        [MaxLength(20)]
        [Column("phone")]
        public string? Phone { get; set; }

        [MaxLength(255)]
        [Column("email")]
        public string? Email { get; set; }

        [MaxLength(500)]
        [Column("address")]
        public string? Address { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
