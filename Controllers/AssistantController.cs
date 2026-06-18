using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Assistant;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AssistantController : ControllerBase
    {
        private readonly IAssistantService _assistantService;

        public AssistantController(IAssistantService assistantService)
        {
            _assistantService = assistantService;
        }

        [HttpPost("message")]
        public async Task<IActionResult> Message([FromBody] AssistantMessageRequestDto dto)
        {
            try
            {
                var result = await _assistantService.HandleMessageAsync(dto.Message);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("execute/{commandId}")]
        public async Task<IActionResult> Execute(string commandId)
        {
            try
            {
                var result = await _assistantService.ExecuteAsync(commandId);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
