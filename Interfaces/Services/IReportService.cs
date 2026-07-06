using NhaTro.Dtos.Reports;

namespace NhaTro.Interfaces.Services
{
    public interface IReportService
    {
        Task<MonthlyRevenueDto> GetMonthlyRevenueAsync(DateOnly month);
        Task<MonthlyExpenseDto> GetMonthlyExpenseAsync(DateOnly month);
        Task<MonthlyProfitLossDto> GetMonthlyProfitLossAsync(DateOnly month);
        Task<List<PaymentStatusItemDto>> GetPaymentStatusAsync(DateOnly month);
        Task<SalesLedgerDto> GetSalesLedgerAsync(DateOnly fromMonth, DateOnly toMonth, string? ledgerOwnerKey = null);
        Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerPdfRequestDto request);
        string BuildSalesLedgerPdfFileName(DateOnly fromMonth, DateOnly toMonth, string? ledgerOwnerKey = null);
    }
}
