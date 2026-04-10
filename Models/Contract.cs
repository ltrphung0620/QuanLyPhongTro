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

        public int OccupantCount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ActualRoomPrice { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "active"; // active | ended

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Room? Room { get; set; }

        public Tenant? Tenant { get; set; }

        public ICollection<MeterReading> MeterReadings { get; set; } = new List<MeterReading>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public DepositSettlement? DepositSettlement { get; set; }
    }
}