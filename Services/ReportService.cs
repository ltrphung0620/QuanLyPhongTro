using NhaTro.Dtos.Reports;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class ReportService : IReportService
    {
        private readonly IInvoiceRepository _invoiceRepository;
        private readonly ITransactionRepository _transactionRepository;

        public ReportService(
            IInvoiceRepository invoiceRepository,
            ITransactionRepository transactionRepository)
        {
            _invoiceRepository = invoiceRepository;
            _transactionRepository = transactionRepository;
        }

        public async Task<MonthlyRevenueDto> GetMonthlyRevenueAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var invoices = await _invoiceRepository.GetAllAsync(null, billingMonth, null);
            var transactions = await _transactionRepository.GetAllAsync(billingMonth, "income");

            var paidInvoicesRevenue = invoices
                .Where(x => x.ReplacedByInvoiceId == null)
                .Sum(CalculateRecognizedRevenue);

            var extraIncome = transactions.Sum(x => x.Amount);
            var totalRevenue = paidInvoicesRevenue + extraIncome;

            return new MonthlyRevenueDto
            {
                Month = billingMonth,
                PaidInvoicesRevenue = paidInvoicesRevenue,
                ExtraIncome = extraIncome,
                TotalRevenue = totalRevenue
            };
        }

        public async Task<MonthlyExpenseDto> GetMonthlyExpenseAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var expenses = await _transactionRepository.GetAllAsync(billingMonth, "expense");
            var totalExpense = expenses.Sum(x => x.Amount);

            return new MonthlyExpenseDto
            {
                Month = billingMonth,
                TotalExpense = totalExpense
            };
        }

        public async Task<MonthlyProfitLossDto> GetMonthlyProfitLossAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var revenue = await GetMonthlyRevenueAsync(billingMonth);
            var expense = await GetMonthlyExpenseAsync(billingMonth);

            return new MonthlyProfitLossDto
            {
                Month = billingMonth,
                TotalRevenue = revenue.TotalRevenue,
                TotalExpense = expense.TotalExpense,
                ProfitLoss = revenue.TotalRevenue - expense.TotalExpense
            };
        }

        public async Task<List<PaymentStatusItemDto>> GetPaymentStatusAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var invoices = await _invoiceRepository.GetAllAsync(null, billingMonth, null);

            return invoices
                .Where(x => x.InvoiceType == "monthly" && x.ReplacedByInvoiceId == null)
                .OrderBy(x => x.RoomId)
                .Select(x => new PaymentStatusItemDto
                {
                    InvoiceId = x.InvoiceId,
                    RoomId = x.RoomId,
                    ContractId = x.ContractId,
                    BillingMonth = x.BillingMonth,
                    TotalAmount = x.TotalAmount,
                    Status = x.Status,
                    PaymentCode = x.PaymentCode
                })
                .ToList();
        }

        private static DateOnly NormalizeMonth(DateOnly date)
        {
            return new DateOnly(date.Year, date.Month, 1);
        }

        private static decimal CalculateRecognizedRevenue(Models.Invoice invoice)
        {
            var recognizedRevenue = invoice.TotalAmount - invoice.DebtAmount;
            return recognizedRevenue > 0 ? recognizedRevenue : 0;
        }
    }
}
