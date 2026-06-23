using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Services;
using System.Threading.Tasks;

namespace NhaTro.Middlewares
{
    public class TenantStatusMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantStatusMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ICurrentUserService currentUserService, NhaTroDbContext dbContext)
        {
            if (currentUserService.IsAuthenticated && currentUserService.OrganizationId.HasValue)
            {
                var orgId = currentUserService.OrganizationId.Value;
                var isActive = await dbContext.Organizations
                    .IgnoreQueryFilters()
                    .Where(o => o.Id == orgId)
                    .Select(o => (bool?)o.IsActive)
                    .FirstOrDefaultAsync() ?? false;

                if (!isActive)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new { message = "Organization has been deactivated." });
                    return;
                }
            }

            await _next(context);
        }
    }
}
