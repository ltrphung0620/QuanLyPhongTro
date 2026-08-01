using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    public class Contract
    {
        public int ContractId { get; set; }

        public int RoomId { get; set; }

        public int TenantId { get; set; }

        public DateOnly StartDate { get; set; }

        public DateOnly? ExpectedEndDate { get; set; }

        public DateOnly? ActualEndDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DepositPaidAmount { get; set; }

        public int OccupantCount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CustomWaterFee { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ActualRoomPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TrashFee { get; set; } = 30000m;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "active"; // active | ended | cancelled

        public bool IsArchived { get; set; }

        public DateTime? ArchivedAt { get; set; }

        [MaxLength(500)]
        public string? ArchiveReason { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Room? Room { get; set; }

        public Tenant? Tenant { get; set; }

        public ICollection<MeterReading> MeterReadings { get; set; } = new List<MeterReading>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public DepositSettlement? DepositSettlement { get; set; }
        public int AppUserId { get; set; }
        public AppUser? AppUser { get; set; }

        public int OrganizationId { get; set; }
        public Organization? Organization { get; set; }

    }
}
