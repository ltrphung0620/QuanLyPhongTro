namespace NhaTro.Dtos.Reports
{
    public class MonthlyRevenueDto
    {
        public DateOnly Month { get; set; }
        public decimal PaidInvoicesRevenue { get; set; }
        public decimal ExtraIncome { get; set; }
        public decimal TotalRevenue { get; set; }
    }
}