namespace NhaTro.Dtos.Reports
{
    public class MonthlyExpenseDto
    {
        public DateOnly Month { get; set; }
        public decimal TotalExpense { get; set; }
    }
}