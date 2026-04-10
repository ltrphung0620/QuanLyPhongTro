using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    public class Invoice
    {
        public int InvoiceId { get; set; }

        public int RoomId { get; set; }

        public int ContractId { get; set; }

        [Required]
        [MaxLength(20)]
        public string InvoiceType { get; set; } = "monthly"; // monthly | final

        public DateOnly? BillingMonth { get; set; }

        public DateOnly? FromDate { get; set; }

        public DateOnly? ToDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal RoomFee { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ElectricityFee { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal WaterFee { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TrashFee { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DebtAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "unpaid"; // unpaid | paid

        [MaxLength(100)]
        public string? PaymentCode { get; set; }

        public DateTime? PaidAt { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PaidAmount { get; set; }

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        [MaxLength(100)]
        public string? PaymentReference { get; set; }

        public int? ReplacedByInvoiceId { get; set; }

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Room? Room { get; set; }

        public Contract? Contract { get; set; }

        public Invoice? ReplacedByInvoice { get; set; }

        public ICollection<Invoice> ReplacingInvoices { get; set; } = new List<Invoice>();
        public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
        public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();
    }
}