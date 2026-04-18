using Microsoft.AspNetCore.Mvc;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RealtimeController : ControllerBase
    {
        private readonly IRealtimeService _realtimeService;

        public RealtimeController(IRealtimeService realtimeService)
        {
            _realtimeService = realtimeService;
        }

        [HttpGet("stream")]
        public async Task Stream(CancellationToken cancellationToken)
        {
            Response.Headers.ContentType = "text/event-stream";
            Response.Headers.CacheControl = "no-cache";
            Response.Headers.Connection = "keep-alive";

            var clientId = _realtimeService.RegisterClient();

            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var payload = await _realtimeService.WaitForEventAsync(clientId, cancellationToken);
                    if (payload == null)
                    {
                        break;
                    }

                    await Response.WriteAsync($"data: {payload}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Client disconnected.
            }
            finally
            {
                _realtimeService.UnregisterClient(clientId);
            }
        }
    }
}
