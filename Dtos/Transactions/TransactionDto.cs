namespace NhaTro.Dtos.Transactions
{
    public class TransactionDto
    {
        public int TransactionId { get; set; }
        public string TransactionDirection { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? ItemName { get; set; }
        public decimal Amount { get; set; }
        public DateOnly TransactionDate { get; set; }
        public string? Description { get; set; }
        public int? RelatedRoomId { get; set; }
        public string? RelatedRoomCode { get; set; }
        public int? RelatedInvoiceId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
