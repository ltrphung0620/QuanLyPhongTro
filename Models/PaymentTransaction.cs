using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NhaTro.Models
{
    public class PaymentTransaction
    {
        public int PaymentTransactionId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Provider { get; set; } = "sepay";

        [Required]
        [MaxLength(100)]
        public string ProviderTransactionId { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? ReferenceCode { get; set; }

        [MaxLength(100)]
        public string? PaymentCode { get; set; }

        [MaxLength(50)]
        public string? AccountNumber { get; set; }

        [MaxLength(20)]
        public string? TransferType { get; set; } // in | out

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TransferAmount { get; set; }

        public DateTime? TransactionDate { get; set; }

        public string? Content { get; set; }

        public string? RawPayloadJson { get; set; }

        public int? MatchedInvoiceId { get; set; }

        [MaxLength(20)]
        public string? ProcessStatus { get; set; } // received | matched | paid | ignored | failed

        public DateTime? ProcessedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Invoice? MatchedInvoice { get; set; }
    }
}