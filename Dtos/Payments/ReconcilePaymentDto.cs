using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Payments
{
    public class ReconcilePaymentDto
    {
        [Required]
        public int InvoiceId { get; set; }
    }
}