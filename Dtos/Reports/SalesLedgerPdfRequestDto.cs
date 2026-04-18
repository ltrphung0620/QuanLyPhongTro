using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Reports
{
    public class SalesLedgerPdfRequestDto
    {
        [Range(2000, 3000)]
        public int Year { get; set; }

        [Range(1, 2)]
        public int Period { get; set; }

        public string? BusinessOwnerName { get; set; }
        public string? Address { get; set; }
        public string? TaxCode { get; set; }
        public string? BusinessLocation { get; set; }
    }
}
