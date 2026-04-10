using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InvoicesController : ControllerBase
    {
        private readonly IInvoiceService _service;

        public InvoicesController(IInvoiceService service)
        {
            _service = service;
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
                return NotFound(new { message = "Không tìm thấy hóa đơn." });

            return Ok(invoice);
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
                return Ok(await _service.CreateAsync(dto));
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
                return NotFound(new { message = "Không tìm thấy hóa đơn theo phòng và tháng." });

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
                return NotFound(new { message = "Không tìm thấy hóa đơn theo payment code." });

            return Ok(invoice);
        }

        [HttpPatch("{id:int}/mark-paid")]
        public async Task<IActionResult> MarkPaid(int id, [FromBody] MarkInvoicePaidDto dto)
        {
            try
            {
                var invoice = await _service.MarkPaidAsync(id, dto);
                if (invoice == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

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
                return NotFound(new { message = "Không tìm thấy hóa đơn." });

            return Ok(invoice);
        }

        [HttpPatch("electricity")]
        public async Task<IActionResult> UpdateElectricity([FromBody] UpdateInvoiceElectricityDto dto)
        {
            try
            {
                var invoice = await _service.UpdateElectricityAsync(dto);
                if (invoice == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn theo phòng và tháng." });

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
                return Ok(await _service.MonthlyBulkCreateAsync(dto));
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
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

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
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

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
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

                return Ok(new { message = "Xóa hóa đơn thành công." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
