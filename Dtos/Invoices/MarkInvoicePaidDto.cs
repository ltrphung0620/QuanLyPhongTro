using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Invoices
{
    public class MarkInvoicePaidDto
    {
        [Range(0, double.MaxValue)]
        public decimal Amount { get; set; }

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        [MaxLength(100)]
        public string? PaymentReference { get; set; }
    }
}