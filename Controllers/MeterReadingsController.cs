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

        [HttpPost("{id:int}/image")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadImage(int id, [FromForm] UploadMeterReadingImageDto dto)
        {
            try
            {
                if (dto.Image == null)
                {
                    return BadRequest(new { message = "Vui lòng chọn ảnh công tơ điện." });
                }

                var result = await _service.UploadImageAsync(id, dto.Image);
                if (result == null)
                {
                    return NotFound(new { message = "KhÃ´ng tÃ¬m tháº¥y báº£n ghi chá»‰ sá»‘ Ä‘iá»‡n." });
                }

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

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var deleted = await _service.DeleteAsync(id);
                if (!deleted)
                {
                    return NotFound(new { message = "Không tìm thấy bản ghi chỉ số điện." });
                }

                return Ok(new { message = "Đã xóa bản ghi chỉ số điện." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("missing")]
        public async Task<IActionResult> GetMissing([FromQuery] DateOnly month)
        {
            var result = await _service.GetMissingAsync(month);
            return Ok(result);
        }
    }
}
