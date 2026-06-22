using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Assistant;
using NhaTro.Interfaces.Services;
using NhaTro.Services;

namespace NhaTro.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AssistantController : ControllerBase
    {
        private readonly IAssistantService _assistantService;
        private readonly AssistantAuditStore _auditStore;
        private readonly AssistantToolRegistry _toolRegistry;
        private readonly AssistantAgentPlanner _agentPlanner;
        private readonly AssistantAgentStateStore _agentStateStore;
        private readonly AssistantConversationStore _conversationStore;
        private readonly AssistantCommandStore _commandStore;
        private readonly ICurrentUserService _currentUserService;

        public AssistantController(
            IAssistantService assistantService,
            AssistantAuditStore auditStore,
            AssistantToolRegistry toolRegistry,
            AssistantAgentPlanner agentPlanner,
            AssistantAgentStateStore agentStateStore,
            AssistantConversationStore conversationStore,
            AssistantCommandStore commandStore,
            ICurrentUserService currentUserService)
        {
            _assistantService = assistantService;
            _auditStore = auditStore;
            _toolRegistry = toolRegistry;
            _agentPlanner = agentPlanner;
            _agentStateStore = agentStateStore;
            _conversationStore = conversationStore;
            _commandStore = commandStore;
            _currentUserService = currentUserService;
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
        public async Task<IActionResult> Execute(string commandId, [FromQuery] bool? strongConfirm = null)
        {
            try
            {
                var result = await _assistantService.ExecuteAsync(commandId, strongConfirm);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("audit")]
        public IActionResult Audit([FromQuery] int take = 100)
        {
            var result = _auditStore.GetLatest(_currentUserService.UserId, take);
            return Ok(result);
        }

        [HttpGet("tools")]
        public IActionResult Tools()
        {
            return Ok(_toolRegistry.Tools);
        }

        [HttpPost("plan")]
        public async Task<IActionResult> Plan([FromBody] AssistantMessageRequestDto dto)
        {
            var result = await _agentPlanner.PlanAsync(dto.Message, _currentUserService.UserId);
            return Ok(result);
        }

        [HttpPost("agent")]
        public async Task<IActionResult> Agent([FromBody] AssistantMessageRequestDto dto)
        {
            try
            {
                var result = await _assistantService.HandleAgentAsync(dto.Message);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("agent/state")]
        public IActionResult AgentState()
        {
            return _agentStateStore.TryGet(_currentUserService.UserId, out var state)
                ? Ok(state)
                : Ok(null);
        }

        [HttpPost("reset")]
        public IActionResult Reset()
        {
            var userId = _currentUserService.UserId;
            _agentStateStore.Clear(userId);
            _conversationStore.Clear(userId);
            _commandStore.ClearForUser(userId);
            return Ok(new { success = true });
        }
    }
}
