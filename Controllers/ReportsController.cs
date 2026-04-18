using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Reports;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;

        public ReportsController(IReportService reportService)
        {
            _reportService = reportService;
        }

        [HttpGet("monthly-revenue")]
        public async Task<IActionResult> GetMonthlyRevenue([FromQuery] DateOnly month)
        {
            var result = await _reportService.GetMonthlyRevenueAsync(month);
            return Ok(result);
        }

        [HttpGet("monthly-expense")]
        public async Task<IActionResult> GetMonthlyExpense([FromQuery] DateOnly month)
        {
            var result = await _reportService.GetMonthlyExpenseAsync(month);
            return Ok(result);
        }

        [HttpGet("monthly-profit-loss")]
        public async Task<IActionResult> GetMonthlyProfitLoss([FromQuery] DateOnly month)
        {
            var result = await _reportService.GetMonthlyProfitLossAsync(month);
            return Ok(result);
        }

        [HttpGet("payment-status")]
        public async Task<IActionResult> GetPaymentStatus([FromQuery] DateOnly month)
        {
            var result = await _reportService.GetPaymentStatusAsync(month);
            return Ok(result);
        }

        [HttpGet("sales-ledger")]
        public async Task<IActionResult> GetSalesLedger([FromQuery] int year, [FromQuery] int period)
        {
            var result = await _reportService.GetSalesLedgerAsync(year, period);
            return Ok(result);
        }

        [HttpPost("sales-ledger/pdf")]
        public async Task<IActionResult> ExportSalesLedgerPdf([FromBody] SalesLedgerPdfRequestDto request)
        {
            var pdfBytes = await _reportService.GenerateSalesLedgerPdfAsync(request);
            var fileName = _reportService.BuildSalesLedgerPdfFileName(request.Year, request.Period);

            return File(pdfBytes, "application/pdf", fileName);
        }
    }
}
