namespace NhaTro.Dtos.Payments
{
    public class SepayWebhookDto
    {
        public string? Id { get; set; }
        public string? Gateway { get; set; }
        public string? TransactionDate { get; set; }
        public string? AccountNumber { get; set; }
        public string? Code { get; set; }
        public string? Content { get; set; }
        public string? TransferType { get; set; } // in | out
        public decimal? TransferAmount { get; set; }
        public string? ReferenceCode { get; set; }
    }
}