using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace NhaTro.Controllers
{
    [Route("api/tenant/invoices")]
    [ApiController]
    [Authorize(Policy = "TenantOnly")]
    public class TenantInvoicesController : ControllerBase
    {
        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUserService;
        private readonly IInvoicePdfService _pdfService;

        public TenantInvoicesController(
            NhaTroDbContext context,
            ICurrentUserService currentUserService,
            IInvoicePdfService pdfService)
        {
            _context = context;
            _currentUserService = currentUserService;
            _pdfService = pdfService;
        }

        // GET /api/tenant/invoices
        [HttpGet]
        public async Task<IActionResult> GetMyInvoices([FromQuery] string? status)
        {
            var tenantId = _currentUserService.TenantId;
            if (!tenantId.HasValue) return Forbid();

            var query = _context.Invoices
                .Include(i => i.Room)
                .Include(i => i.Contract)
                    .ThenInclude(c => c!.Tenant)
                .Where(i => i.Contract != null && i.Contract.TenantId == tenantId.Value);

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(i => i.Status == status);
            }

            var invoices = await query
                .OrderByDescending(i => i.BillingMonth)
                .ToListAsync();

            var dtos = new List<InvoiceDto>();
            foreach (var inv in invoices)
            {
                dtos.Add(await MapToDtoWithMeterReadingAsync(inv));
            }

            return Ok(dtos);
        }

        // GET /api/tenant/invoices/{id}
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetMyInvoiceDetails(int id)
        {
            var tenantId = _currentUserService.TenantId;
            if (!tenantId.HasValue) return Forbid();

            var invoice = await _context.Invoices
                .Include(i => i.Room)
                .Include(i => i.Contract)
                    .ThenInclude(c => c!.Tenant)
                .FirstOrDefaultAsync(i => i.InvoiceId == id);

            if (invoice == null || invoice.Contract == null || invoice.Contract.TenantId != tenantId.Value)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn." });
            }

            var dto = await MapToDtoWithMeterReadingAsync(invoice);
            return Ok(dto);
        }

        // GET /api/tenant/invoices/{id}/pdf
        [HttpGet("{id:int}/pdf")]
        public async Task<IActionResult> DownloadMyInvoicePdf(int id)
        {
            var tenantId = _currentUserService.TenantId;
            if (!tenantId.HasValue) return Forbid();

            var invoice = await _context.Invoices
                .Include(i => i.Room)
                .Include(i => i.Contract)
                    .ThenInclude(c => c!.Tenant)
                .FirstOrDefaultAsync(i => i.InvoiceId == id);

            if (invoice == null || invoice.Contract == null || invoice.Contract.TenantId != tenantId.Value)
            {
                return NotFound(new { message = "Không tìm thấy hóa đơn." });
            }

            try
            {
                var dto = await MapToDtoWithMeterReadingAsync(invoice);
                var fileBytes = await _pdfService.GenerateInvoicePdfAsync(dto);
                var fileName = _pdfService.BuildInvoicePdfFileName(dto);
                return File(fileBytes, "application/pdf", fileName);
            }
            catch
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Không tải được PDF hóa đơn." });
            }
        }

        private async Task<InvoiceDto> MapToDtoWithMeterReadingAsync(Invoice invoice)
        {
            var dto = new InvoiceDto
            {
                InvoiceId = invoice.InvoiceId,
                RoomId = invoice.RoomId,
                RoomCode = invoice.Room?.RoomCode,
                ContractId = invoice.ContractId,
                TenantName = invoice.Contract?.Tenant?.FullName,
                InvoiceType = invoice.InvoiceType,
                BillingMonth = invoice.BillingMonth,
                FromDate = invoice.FromDate,
                ToDate = invoice.ToDate,
                RoomFee = invoice.RoomFee,
                ElectricityFee = invoice.ElectricityFee,
                WaterFee = invoice.WaterFee,
                TrashFee = invoice.TrashFee,
                ExtraFee = invoice.ExtraFee,
                DiscountAmount = invoice.DiscountAmount,
                DebtAmount = invoice.DebtAmount,
                DepositDebtAmount = invoice.DepositDebtAmount,
                DepositPaidAmount = invoice.Contract?.DepositPaidAmount ?? 0,
                TotalAmount = invoice.TotalAmount,
                Status = invoice.Status,
                PaymentCode = invoice.PaymentCode,
                PaidAt = invoice.PaidAt,
                PaidAmount = invoice.PaidAmount,
                PaymentMethod = invoice.PaymentMethod,
                PaymentReference = invoice.PaymentReference,
                ExtraFeeNote = invoice.ExtraFeeNote,
                Note = invoice.Note,
                CreatedAt = invoice.CreatedAt
            };

            if (invoice.ContractId.HasValue && invoice.BillingMonth.HasValue)
            {
                var billMonth = invoice.BillingMonth.Value;
                var meter = await _context.MeterReadings
                    .FirstOrDefaultAsync(m => m.ContractId == invoice.ContractId.Value 
                                              && m.BillingMonth.Year == billMonth.Year 
                                              && m.BillingMonth.Month == billMonth.Month);
                if (meter != null)
                {
                    dto.PreviousReading = meter.PreviousReading;
                    dto.CurrentReading = meter.CurrentReading;
                    dto.ConsumedUnits = meter.ConsumedUnits;
                    dto.MeterImagePath = meter.MeterImagePath;
                }
            }

            return dto;
        }
    }
}
