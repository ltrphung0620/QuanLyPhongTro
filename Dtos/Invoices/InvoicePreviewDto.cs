namespace NhaTro.Dtos.Invoices
{
    public class InvoicePreviewDto
    {
        public int RoomId { get; set; }
        public int ContractId { get; set; }
        public DateOnly BillingMonth { get; set; }
        public DateOnly FromDate { get; set; }
        public DateOnly ToDate { get; set; }

        public decimal RoomFee { get; set; }
        public decimal ElectricityFee { get; set; }
        public decimal WaterFee { get; set; }
        public decimal TrashFee { get; set; }
        public decimal ExtraFee { get; set; }

        public decimal DiscountAmount { get; set; }
        public decimal DebtAmount { get; set; }

        public decimal TotalAmount { get; set; }
    }
}
