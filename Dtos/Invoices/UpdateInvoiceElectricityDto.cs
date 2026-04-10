using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Invoices
{
    public class UpdateInvoiceElectricityDto
    {
        [Required]
        public string RoomCode { get; set; } = string.Empty;

        [Required]
        public DateOnly BillingMonth { get; set; }

        [Range(0, double.MaxValue)]
        public decimal ElectricityFee { get; set; }

        public string? Note { get; set; }
    }
}
