using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Invoices
{
    public class InvoiceReplaceDto
    {
        [Range(0, double.MaxValue)]
        public decimal RoomFee { get; set; }

        [Range(0, double.MaxValue)]
        public decimal ElectricityFee { get; set; }

        [Range(0, double.MaxValue)]
        public decimal WaterFee { get; set; }

        [Range(0, double.MaxValue)]
        public decimal TrashFee { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DiscountAmount { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DebtAmount { get; set; }

        public string? Note { get; set; }
    }
}