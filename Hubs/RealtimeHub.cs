using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace NhaTro.Hubs
{
    [Authorize]
    public class RealtimeHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var role = Context.User?.FindFirstValue(ClaimTypes.Role)
                ?? Context.User?.FindFirstValue("role");
            var organizationId = Context.User?.FindFirstValue("organizationId");
            var tenantId = Context.User?.FindFirstValue("tenantId");
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? Context.User?.FindFirstValue("userId");

            if (!string.IsNullOrWhiteSpace(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");
            }

            if (!string.IsNullOrWhiteSpace(organizationId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"org:{organizationId}");
            }

            if (!string.IsNullOrWhiteSpace(tenantId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant:{tenantId}");
            }

            await base.OnConnectedAsync();
        }
    }
}
