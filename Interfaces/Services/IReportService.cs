using NhaTro.Dtos.Reports;

namespace NhaTro.Interfaces.Services
{
    public interface IReportService
    {
        Task<MonthlyRevenueDto> GetMonthlyRevenueAsync(DateOnly month);
        Task<MonthlyExpenseDto> GetMonthlyExpenseAsync(DateOnly month);
        Task<MonthlyProfitLossDto> GetMonthlyProfitLossAsync(DateOnly month);
        Task<List<PaymentStatusItemDto>> GetPaymentStatusAsync(DateOnly month);
        Task<SalesLedgerDto> GetSalesLedgerAsync(int year, int period);
        Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerPdfRequestDto request);
        string BuildSalesLedgerPdfFileName(int year, int period);
    }
}
