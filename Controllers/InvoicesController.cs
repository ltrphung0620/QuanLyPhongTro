using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Authorization;
using NhaTro.Data;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;
using System.IO.Compression;

namespace NhaTro.Controllers
{
    [Authorize]
    [RequireAdminPagePermission("invoices")]
    [ApiController]
    [Route("api/[controller]")]
    public class InvoicesController : ControllerBase
    {
        private readonly IInvoiceService _service;
        private readonly IInvoicePdfService _pdfService;
        private readonly IRealtimeService _realtimeService;
        private readonly ITenantInvoiceNotificationService _tenantInvoiceNotificationService;
        private readonly NhaTroDbContext _context;

        public InvoicesController(
            IInvoiceService service, 
            IInvoicePdfService pdfService, 
            IRealtimeService realtimeService,
            ITenantInvoiceNotificationService tenantInvoiceNotificationService,
            NhaTroDbContext context)
        {
            _service = service;
            _pdfService = pdfService;
            _realtimeService = realtimeService;
            _tenantInvoiceNotificationService = tenantInvoiceNotificationService;
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? roomId,
            [FromQuery] DateOnly? month,
            [FromQuery] string? status = null)
        {
            return Ok(await _service.GetAllAsync(roomId, month, status));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var invoice = await _service.GetByIdAsync(id);
            if (invoice == null)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn." });
            }

            return Ok(invoice);
        }

        [HttpGet("{id:int}/pdf")]
        public async Task<IActionResult> DownloadPdf(int id)
        {
            try
            {
                var invoice = await _service.GetByIdAsync(id);
                if (invoice == null)
                {
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });
                }

                var fileBytes = await _pdfService.GenerateInvoicePdfAsync(invoice);
                var fileName = _pdfService.BuildInvoicePdfFileName(invoice);
                return File(fileBytes, "application/pdf", fileName);
            }
            catch
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Không tải được PDF hóa đơn." });
            }
        }

        [HttpGet("images.zip")]
        public async Task<IActionResult> DownloadImagesZip(
            [FromQuery] DateOnly? month,
            [FromQuery] string? status = null)
        {
            try
            {
                var invoices = await _service.GetAllAsync(null, month, status);
                if (invoices.Count == 0)
                {
                    return NotFound(new { message = "Kh\u00F4ng c\u00F3 h\u00F3a \u0111\u01A1n \u0111\u1EC3 xu\u1EA5t \u1EA3nh." });
                }

                await using var zipStream = new MemoryStream();
                using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
                {
                    foreach (var invoice in invoices)
                    {
                        var images = await _pdfService.GenerateInvoiceImagesAsync(invoice);

                        for (var index = 0; index < images.Count; index++)
                        {
                            var pageNumber = images.Count > 1 ? index + 1 : (int?)null;
                            var entryName = _pdfService.BuildInvoiceImageFileName(invoice, pageNumber);
                            var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);

                            await using var entryStream = entry.Open();
                            await entryStream.WriteAsync(images[index]);
                        }
                    }
                }

                var monthPart = month.HasValue ? month.Value.ToString("yyyy-MM") : "tat-ca";
                var statusPart = string.IsNullOrWhiteSpace(status) ? "tat-ca" : status.Trim().ToLowerInvariant();
                var fileName = $"AnhHoaDon-{monthPart}-{statusPart}.zip";

                return File(zipStream.ToArray(), "application/zip", fileName);
            }
            catch
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Kh\u00F4ng t\u1EA3i \u0111\u01B0\u1EE3c \u1EA3nh h\u00F3a \u0111\u01A1n." });
            }
        }

        [HttpPost("preview")]
        public async Task<IActionResult> Preview([FromBody] CreateInvoiceDto dto)
        {
            try
            {
                return Ok(await _service.PreviewAsync(dto));
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateInvoiceDto dto)
        {
            try
            {
                var invoice = await _service.CreateAsync(dto);
                await _realtimeService.PublishAsync("invoice.created", "invoices", "reports");
                await _tenantInvoiceNotificationService.NotifyInvoiceCreatedAsync(invoice, HttpContext.RequestAborted);
                return Ok(invoice);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("by-room-and-month")]
        public async Task<IActionResult> GetByRoomAndMonth([FromQuery] int roomId, [FromQuery] DateOnly month)
        {
            var invoice = await _service.GetByRoomAndMonthAsync(roomId, month);
            if (invoice == null)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn theo phòng và tháng." });
            }

            return Ok(invoice);
        }

        [HttpGet("unpaid")]
        public async Task<IActionResult> GetUnpaid([FromQuery] DateOnly? month = null)
        {
            return Ok(await _service.GetUnpaidAsync(month));
        }

        [HttpGet("by-payment-code/{paymentCode}")]
        public async Task<IActionResult> GetByPaymentCode(string paymentCode)
        {
            var invoice = await _service.GetByPaymentCodeAsync(paymentCode);
            if (invoice == null)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn theo mã thanh toán." });
            }

            return Ok(invoice);
        }

        [HttpPatch("{id:int}/mark-paid")]
        public async Task<IActionResult> MarkPaid(int id, [FromBody] MarkInvoicePaidDto dto)
        {
            try
            {
                var invoice = await _service.MarkPaidAsync(id, dto);
                if (invoice == null)
                {
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });
                }

                var dbInvoice = await _context.Invoices
                    .Include(i => i.Room)
                    .FirstOrDefaultAsync(i => i.InvoiceId == id);

                if (dbInvoice != null)
                {
                    var billingMonthStr = dbInvoice.BillingMonth?.ToString("MM/yyyy");
                    var message = $"Phòng {dbInvoice.Room?.RoomCode} đã thanh toán hóa đơn tháng {billingMonthStr} với số tiền {dbInvoice.TotalAmount:N0} đồng.";
                    
                    await _realtimeService.PublishWithDataAsync("invoice.marked-paid", new
                    {
                        invoiceId = dbInvoice.InvoiceId,
                        roomCode = dbInvoice.Room?.RoomCode,
                        billingMonth = dbInvoice.BillingMonth,
                        totalAmount = dbInvoice.TotalAmount,
                        message = message,
                        organizationId = dbInvoice.OrganizationId
                    }, "invoices", "payments", "reports");
                }
                else
                {
                    await _realtimeService.PublishAsync("invoice.marked-paid", "invoices", "payments", "reports");
                }

                return Ok(invoice);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPatch("{id:int}/mark-unpaid")]
        public async Task<IActionResult> MarkUnpaid(int id)
        {
            var invoice = await _service.MarkUnpaidAsync(id);
            if (invoice == null)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn." });
            }

            await _realtimeService.PublishAsync("invoice.marked-unpaid", "invoices", "payments", "reports");
            return Ok(invoice);
        }

        [HttpPatch("electricity")]
        public async Task<IActionResult> UpdateElectricity([FromBody] UpdateInvoiceElectricityDto dto)
        {
            try
            {
                var invoice = await _service.UpdateElectricityAsync(dto);
                if (invoice == null)
                {
                    return NotFound(new { message = "Không tìm thấy hóa đơn theo phòng và tháng." });
                }

                await _realtimeService.PublishAsync("invoice.electricity-updated", "invoices", "reports");
                return Ok(invoice);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("monthly-bulk-preview")]
        public async Task<IActionResult> MonthlyBulkPreview([FromBody] InvoiceBulkCreateDto dto)
        {
            try
            {
                return Ok(await _service.MonthlyBulkPreviewAsync(dto));
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("monthly-bulk")]
        public async Task<IActionResult> MonthlyBulkCreate([FromBody] InvoiceBulkCreateDto dto)
        {
            try
            {
                var invoices = await _service.MonthlyBulkCreateAsync(dto);
                await _realtimeService.PublishAsync("invoice.bulk-created", "invoices", "reports");
                foreach (var invoice in invoices)
                {
                    await _tenantInvoiceNotificationService.NotifyInvoiceCreatedAsync(invoice, HttpContext.RequestAborted);
                }
                return Ok(invoices);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/replace")]
        public async Task<IActionResult> Replace(int id, [FromBody] InvoiceReplaceDto dto)
        {
            try
            {
                var invoice = await _service.ReplaceAsync(id, dto);
                if (invoice == null)
                {
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });
                }

                await _realtimeService.PublishAsync("invoice.replaced", "invoices", "reports");
                return Ok(invoice);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateInvoiceDto dto)
        {
            try
            {
                var invoice = await _service.UpdateAsync(id, dto);
                if (invoice == null)
                {
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });
                }

                await _realtimeService.PublishAsync("invoice.updated", "invoices", "reports");
                return Ok(invoice);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var deleted = await _service.DeleteAsync(id);
                if (!deleted)
                {
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });
                }

                await _realtimeService.PublishAsync("invoice.deleted", "invoices", "reports");
                return Ok(new { message = "Xóa hóa đơn thành công." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
