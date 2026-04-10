using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Transactions;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransactionsController : ControllerBase
    {
        private readonly ITransactionService _transactionService;

        public TransactionsController(ITransactionService transactionService)
        {
            _transactionService = transactionService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] DateOnly? month = null, [FromQuery] string? type = null)
        {
            try
            {
                var data = await _transactionService.GetAllAsync(month, type);
                return Ok(data);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var transaction = await _transactionService.GetByIdAsync(id);
            if (transaction == null)
            {
                return NotFound(new { message = "Không tìm thấy giao dịch." });
            }

            return Ok(transaction);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTransactionDto dto)
        {
            try
            {
                var created = await _transactionService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = created.TransactionId }, created);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTransactionDto dto)
        {
            try
            {
                var updated = await _transactionService.UpdateAsync(id, dto);
                if (updated == null)
                {
                    return NotFound(new { message = "Không tìm thấy giao dịch." });
                }

                return Ok(updated);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _transactionService.DeleteAsync(id);
            if (!deleted)
            {
                return NotFound(new { message = "Không tìm thấy giao dịch." });
            }

            return NoContent();
        }
    }
}