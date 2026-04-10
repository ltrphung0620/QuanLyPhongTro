using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Invoices
{
    public class CreateInvoiceDto
    {
        [Required]
        public int RoomId { get; set; }

        [Required]
        public int ContractId { get; set; }

        [Required]
        public DateOnly BillingMonth { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DiscountAmount { get; set; } = 0;

        [Range(0, double.MaxValue)]
        public decimal DebtAmount { get; set; } = 0;
    }
}