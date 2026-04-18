using System.ComponentModel.DataAnnotations;

namespace NhaTro.Models
{
    public class Room
    {
        public int RoomId { get; set; }

        [Required]
        [MaxLength(50)]
        public string RoomCode { get; set; } = string.Empty;

        public decimal ListedPrice { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "vacant"; // vacant | occupied

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
        public ICollection<MeterReading> MeterReadings { get; set; } = new List<MeterReading>();
        public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    }
}
