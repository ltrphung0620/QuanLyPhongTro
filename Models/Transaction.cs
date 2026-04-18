using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    public class Transaction
    {
        public int TransactionId { get; set; }

        [Required]
        [MaxLength(20)]
        public string TransactionDirection { get; set; } = string.Empty; // income | expense

        [Required]
        [MaxLength(20)]
        public string Category { get; set; } = string.Empty; // operating | other

        [MaxLength(255)]
        public string? ItemName { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateOnly TransactionDate { get; set; }

        public string? Description { get; set; }

        public int? RelatedRoomId { get; set; }

        public int? RelatedInvoiceId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Room? RelatedRoom { get; set; }
        public Invoice? RelatedInvoice { get; set; }
    }
}
