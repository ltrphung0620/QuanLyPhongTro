namespace NhaTro.Dtos.Reports
{
    public class MonthlyProfitLossDto
    {
        public DateOnly Month { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal TotalExpense { get; set; }
        public decimal ProfitLoss { get; set; }
    }
}