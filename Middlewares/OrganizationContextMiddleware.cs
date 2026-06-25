using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace NhaTro.Middlewares
{
    public class OrganizationContextMiddleware
    {
        private readonly RequestDelegate _next;

        public OrganizationContextMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var user = context.User;
            if (user?.Identity?.IsAuthenticated == true)
            {
                var role = user.FindFirstValue(ClaimTypes.Role) ?? user.FindFirstValue("role");
                var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("userId");

                if (role == "Admin" && int.TryParse(userIdValue, out var userId))
                {
                    var db = context.RequestServices.GetRequiredService<NhaTroDbContext>();
                    var memberships = await db.AdminOrganizationMemberships
                        .IgnoreQueryFilters()
                        .Include(m => m.Organization)
                        .Where(m => m.UserId == userId && m.IsActive && m.Organization.IsActive)
                        .ToListAsync();

                    if (memberships.Count == 1)
                    {
                        context.Items["ActiveOrganizationId"] = memberships[0].OrganizationId;
                    }
                    else if (memberships.Count > 1)
                    {
                        if (context.Request.Headers.TryGetValue("X-Organization-Id", out var values) &&
                            int.TryParse(values.FirstOrDefault(), out var headerOrgId))
                        {
                            var targetMembership = memberships.FirstOrDefault(m => m.OrganizationId == headerOrgId);
                            if (targetMembership != null)
                            {
                                context.Items["ActiveOrganizationId"] = headerOrgId;
                            }
                            else
                            {
                                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                                context.Response.ContentType = "application/json";
                                await context.Response.WriteAsJsonAsync(new { message = "Bạn không có quyền truy cập tổ chức này hoặc tổ chức bị khóa." });
                                return;
                            }
                        }
                        else
                        {
                            var path = context.Request.Path.Value?.ToLowerInvariant();
                            bool isBypassed = path != null && (
                                path.Contains("/api/auth/me") ||
                                path.Contains("/api/admin/organizations") ||
                                path.Contains("/api/super-admin") ||
                                path.Contains("/hub/")
                            );

                            if (!isBypassed)
                            {
                                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                                context.Response.ContentType = "application/json";
                                await context.Response.WriteAsJsonAsync(new { message = "Vui lòng chọn tổ chức trước khi thao tác." });
                                return;
                            }
                        }
                    }
                    else
                    {
                        var path = context.Request.Path.Value?.ToLowerInvariant();
                        bool isBypassed = path != null && (
                            path.Contains("/api/auth/me") ||
                            path.Contains("/api/admin/organizations") ||
                            path.Contains("/api/super-admin")
                        );

                        if (!isBypassed)
                        {
                            context.Response.StatusCode = StatusCodes.Status403Forbidden;
                            context.Response.ContentType = "application/json";
                            await context.Response.WriteAsJsonAsync(new { message = "Tài khoản chưa được gán vào tổ chức hoạt động nào." });
                            return;
                        }
                    }
                }
                else if (role == "Tenant")
                {
                    var orgIdClaim = user.FindFirstValue("organizationId");
                    if (int.TryParse(orgIdClaim, out var orgId))
                    {
                        context.Items["ActiveOrganizationId"] = orgId;
                    }
                }
                else if (role == "SuperAdmin")
                {
                    if (context.Request.Headers.TryGetValue("X-Organization-Id", out var values) &&
                        int.TryParse(values.FirstOrDefault(), out var headerOrgId))
                    {
                        context.Items["ActiveOrganizationId"] = headerOrgId;
                    }
                }
            }

            await _next(context);
        }
    }
}
