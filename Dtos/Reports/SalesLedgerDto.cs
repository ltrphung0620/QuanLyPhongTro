namespace NhaTro.Dtos.Reports
{
    public class SalesLedgerDto
    {
        public int Year { get; set; }
        public int Period { get; set; }
        public DateOnly FromDate { get; set; }
        public DateOnly ToDate { get; set; }
        public string UnitLabel { get; set; } = "dong";
        public decimal TotalAmount { get; set; }
        public List<SalesLedgerRowDto> Rows { get; set; } = new();
    }
}
