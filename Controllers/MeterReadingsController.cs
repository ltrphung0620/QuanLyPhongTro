using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MeterReadingsController : ControllerBase
    {
        private readonly IMeterReadingService _service;

        public MeterReadingsController(IMeterReadingService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int? roomId, [FromQuery] DateOnly? month)
        {
            var data = await _service.GetAllAsync(roomId, month);
            return Ok(data);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateMeterReadingDto dto)
        {
            try
            {
                var result = await _service.CreateAsync(dto);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
        [HttpPost("preview")]
        public async Task<IActionResult> Preview([FromBody] CreateMeterReadingDto dto)
        {
            try
            {
                var result = await _service.PreviewAsync(dto);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPatch("current-reading")]
        public async Task<IActionResult> UpdateOriginalReading([FromBody] UpdateOriginalMeterReadingDto dto)
        {
            try
            {
                var result = await _service.UpdateOriginalReadingAsync(dto);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("by-ended-contract/{contractId:int}")]
        public async Task<IActionResult> DeleteByEndedContract(int contractId)
        {
            try
            {
                var result = await _service.DeleteByEndedContractAsync(contractId);
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

        [HttpPost("read-from-image")]
        public async Task<IActionResult> ReadFromImage([FromForm] MeterReadingFromImageDto dto)
        {
            var result = await _service.ReadFromImageAsync(dto.Image);
            return Ok(result);
        }
        [HttpGet("missing")]
        public async Task<IActionResult> GetMissing([FromQuery] DateOnly month)
        {
            var result = await _service.GetMissingAsync(month);
            return Ok(result);
        }
    }
}
