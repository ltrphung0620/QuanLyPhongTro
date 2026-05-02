namespace NhaTro.Dtos.Reports
{
    public class SalesLedgerPdfRequestDto
    {
        public DateOnly FromMonth { get; set; }
        public DateOnly ToMonth { get; set; }

        public string? BusinessOwnerName { get; set; }
        public string? Address { get; set; }
        public string? TaxCode { get; set; }
        public string? BusinessLocation { get; set; }
    }
}
