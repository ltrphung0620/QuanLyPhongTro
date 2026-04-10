using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Invoices
{
    public class UpdateInvoiceDto
    {
        [Range(0, double.MaxValue)]
        public decimal? DiscountAmount { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? DebtAmount { get; set; }

        public string? Note { get; set; }
    }
}