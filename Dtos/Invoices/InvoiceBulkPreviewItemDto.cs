namespace NhaTro.Dtos.Invoices
{
    public class InvoiceBulkPreviewItemDto
    {
        public int RoomId { get; set; }
        public int ContractId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public string TenantName { get; set; } = string.Empty;

        public decimal RoomFee { get; set; }
        public decimal ElectricityFee { get; set; }
        public decimal WaterFee { get; set; }
        public decimal TrashFee { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal DebtAmount { get; set; }
        public decimal TotalAmount { get; set; }
    }
}