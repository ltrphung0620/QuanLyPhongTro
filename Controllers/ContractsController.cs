using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NhaTro.Authorization;
using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [Authorize(Policy = "AdminOnly")]
    [RequireAdminPagePermission("contracts")]
    [ApiController]
    [Route("api/[controller]")]
    public class ContractsController : ControllerBase
    {
        private readonly IContractService _contractService;

        public ContractsController(IContractService contractService)
        {
            _contractService = contractService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null, [FromQuery] int? roomId = null, [FromQuery] bool includeArchived = false)
        {
            try
            {
                var contracts = await _contractService.GetAllAsync(status, roomId, includeArchived);
                return Ok(contracts);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var contract = await _contractService.GetByIdAsync(id);

            if (contract == null)
            {
                return NotFound(new { message = "Không tìm thấy hợp đồng." });
            }

            return Ok(contract);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateContractDto dto)
        {
            try
            {
                var createdContract = await _contractService.CreateAsync(dto);
                return CreatedAtAction(nameof(GetById), new { id = createdContract.ContractId }, createdContract);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateContractDto dto)
        {
            try
            {
                var updatedContract = await _contractService.UpdateAsync(id, dto);

                if (updatedContract == null)
                {
                    return NotFound(new { message = "Không tìm thấy hợp đồng." });
                }

                return Ok(updatedContract);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteEnded(int id)
        {
            try
            {
                var deleted = await _contractService.DeleteEndedAsync(id);
                if (!deleted)
                {
                    return NotFound(new { message = "Không tìm thấy hợp đồng." });
                }

                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] CancelContractDto dto)
        {
            try
            {
                var result = await _contractService.CancelAsync(id, dto);

                if (result == null)
                {
                    return NotFound(new { message = "Không tìm thấy hợp đồng." });
                }

                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/end-preview")]
        public async Task<IActionResult> EndPreview(int id, [FromBody] ContractEndPreviewRequestDto dto)
        {
            try
            {
                var result = await _contractService.EndPreviewAsync(id, dto);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/end")]
        public async Task<IActionResult> End(int id, [FromBody] ContractEndExecuteDto dto)
        {
            try
            {
                var result = await _contractService.EndAsync(id, dto);

                if (result == null)
                {
                    return NotFound(new { message = "Không tìm thấy hợp đồng." });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
        [HttpGet("active-by-room/{roomCode}")]
        public async Task<IActionResult> GetActiveByRoomCode(string roomCode)
        {
            try
            {
                var contract = await _contractService.GetActiveByRoomCodeAsync(roomCode);

                if (contract == null)
                    return NotFound(new { message = "Không có hợp đồng active cho phòng này." });

                return Ok(contract);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
