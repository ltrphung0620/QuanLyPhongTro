namespace NhaTro.Dtos.Payments
{
    public class PaymentTransactionDto
    {
        public int PaymentTransactionId { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string ProviderTransactionId { get; set; } = string.Empty;
        public string? ReferenceCode { get; set; }
        public string? PaymentCode { get; set; }
        public string? AccountNumber { get; set; }
        public string? TransferType { get; set; }
        public decimal? TransferAmount { get; set; }
        public DateTime? TransactionDate { get; set; }
        public string? Content { get; set; }
        public int? MatchedInvoiceId { get; set; }
        public string? ProcessStatus { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}