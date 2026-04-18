namespace NhaTro.Dtos.Reports
{
    public class SalesLedgerRowDto
    {
        public int PaymentTransactionId { get; set; }
        public DateOnly TransactionDate { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? RoomCode { get; set; }
        public string? PaymentCode { get; set; }
        public string? ReferenceCode { get; set; }
    }
}
