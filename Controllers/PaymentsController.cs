using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Payments;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _service;
        private readonly IRealtimeService _realtimeService;

        public PaymentsController(IPaymentService service, IRealtimeService realtimeService)
        {
            _service = service;
            _realtimeService = realtimeService;
        }

        [HttpPost("sepay/webhook")]
        [HttpPost("/api/webhooks/sepay")]
        public async Task<IActionResult> HandleSepayWebhook([FromBody] SepayWebhookDto dto)
        {
            try
            {
                var result = await _service.HandleSepayWebhookAsync(dto);
                await _realtimeService.PublishAsync("payment.webhook-received", "payments", "invoices", "reports");
                return Ok(new
                {
                    success = true,
                    data = result
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions([FromQuery] string? processStatus = null)
        {
            var data = await _service.GetAllAsync(processStatus);
            return Ok(data);
        }

        [HttpGet("transactions/{id:int}")]
        public async Task<IActionResult> GetTransactionById(int id)
        {
            var payment = await _service.GetByIdAsync(id);
            if (payment == null)
            {
                return NotFound(new { message = "Không tìm thấy giao dịch." });
            }

            return Ok(payment);
        }

        [HttpPost("transactions/{id:int}/reconcile")]
        public async Task<IActionResult> Reconcile(int id, [FromBody] ReconcilePaymentDto dto)
        {
            try
            {
                var result = await _service.ReconcileAsync(id, dto);
                if (result == null)
                {
                    return NotFound(new { message = "Không tìm thấy giao dịch." });
                }

                await _realtimeService.PublishAsync("payment.reconciled", "payments", "invoices", "reports");
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("transactions/{id:int}")]
        public async Task<IActionResult> DeleteTransaction(int id)
        {
            try
            {
                var deleted = await _service.DeleteAsync(id);
                if (!deleted)
                {
                    return NotFound(new { message = "Không tìm thấy giao dịch." });
                }

                await _realtimeService.PublishAsync("payment.deleted", "payments", "reports");
                return Ok(new { success = true, message = "Đã xóa giao dịch thanh toán." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
