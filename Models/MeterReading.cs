using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    public class MeterReading
    {
        public int MeterReadingId { get; set; }

        public int RoomId { get; set; }

        public int ContractId { get; set; }

        public DateOnly BillingMonth { get; set; }

        public int PreviousReading { get; set; }

        public int CurrentReading { get; set; }

        public int ConsumedUnits { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Room? Room { get; set; }

        public Contract? Contract { get; set; }
    }
}