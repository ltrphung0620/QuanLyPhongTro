using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Invoices
{
    public class InvoiceBulkCreateDto
    {
        [Required]
        public DateOnly BillingMonth { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DefaultDiscountAmount { get; set; } = 0;

        [Range(0, double.MaxValue)]
        public decimal DefaultDebtAmount { get; set; } = 0;
    }
}