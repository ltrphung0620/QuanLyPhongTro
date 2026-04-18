namespace NhaTro.Dtos.Reports
{
    public class PaymentStatusItemDto
    {
        public int InvoiceId { get; set; }
        public int RoomId { get; set; }
        public int? ContractId { get; set; }
        public DateOnly? BillingMonth { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? PaymentCode { get; set; }
    }
}
