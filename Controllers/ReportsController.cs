using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NhaTro.Authorization;
using NhaTro.Dtos.Reports;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [Authorize(Policy = "AdminOnly")]
    [RequireAdminPagePermission("reports")]
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
        public async Task<IActionResult> GetSalesLedger([FromQuery] DateOnly fromMonth, [FromQuery] DateOnly toMonth, [FromQuery] string? ledgerOwnerKey = null)
        {
            var result = await _reportService.GetSalesLedgerAsync(fromMonth, toMonth, ledgerOwnerKey);
            return Ok(result);
        }

        [HttpPost("sales-ledger/pdf")]
        public async Task<IActionResult> ExportSalesLedgerPdf([FromBody] SalesLedgerPdfRequestDto request)
        {
            var pdfBytes = await _reportService.GenerateSalesLedgerPdfAsync(request);
            var fileName = _reportService.BuildSalesLedgerPdfFileName(request.FromMonth, request.ToMonth, request.LedgerOwnerKey);

            return File(pdfBytes, "application/pdf", fileName);
        }

        [HttpGet("sales-ledger/pdf")]
        public async Task<IActionResult> DownloadSalesLedgerPdf(
            [FromQuery] DateOnly fromMonth,
            [FromQuery] DateOnly toMonth,
            [FromQuery] string? ledgerOwnerKey = null,
            [FromQuery] string? businessOwnerName = null,
            [FromQuery] string? address = null,
            [FromQuery] string? taxCode = null,
            [FromQuery] string? businessLocation = null)
        {
            var request = new SalesLedgerPdfRequestDto
            {
                FromMonth = fromMonth,
                ToMonth = toMonth,
                LedgerOwnerKey = ledgerOwnerKey,
                BusinessOwnerName = businessOwnerName,
                Address = address,
                TaxCode = taxCode,
                BusinessLocation = businessLocation
            };
            var pdfBytes = await _reportService.GenerateSalesLedgerPdfAsync(request);
            return File(pdfBytes, "application/pdf", _reportService.BuildSalesLedgerPdfFileName(fromMonth, toMonth, ledgerOwnerKey));
        }
    }
}
