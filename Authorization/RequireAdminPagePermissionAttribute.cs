using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using System.Security.Claims;

namespace NhaTro.Authorization
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
    public class RequireAdminPagePermissionAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string _permission;

        public RequireAdminPagePermissionAttribute(string permission)
        {
            _permission = permission;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;
            var role = user.FindFirstValue(ClaimTypes.Role) ?? user.FindFirstValue("role");

            if (role != "Admin")
            {
                return;
            }

            var userIdValue = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("userId");
            if (!int.TryParse(userIdValue, out var userId))
            {
                context.Result = new ForbidResult();
                return;
            }

            var db = context.HttpContext.RequestServices.GetRequiredService<NhaTroDbContext>();
            var activeOrgId = context.HttpContext.Items["ActiveOrganizationId"] as int?;
            if (activeOrgId == null)
            {
                context.Result = new ForbidResult();
                return;
            }

            var membership = await db.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(m => m.UserId == userId && m.OrganizationId == activeOrgId && m.IsActive);

            if (membership == null)
            {
                context.Result = new ForbidResult();
                return;
            }

            if (membership.CanAccessAllPages)
            {
                return;
            }

            var hasPermission = await db.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .AnyAsync(p => p.UserId == userId && p.OrganizationId == activeOrgId && p.PageKey == _permission && p.CanAccess);

            if (hasPermission)
            {
                return;
            }

            var hasDashboard = await db.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .AnyAsync(p => p.UserId == userId && p.OrganizationId == activeOrgId && p.PageKey == "dashboard" && p.CanAccess);

            var isDashboardRead = HttpMethods.IsGet(context.HttpContext.Request.Method)
                && hasDashboard
                && (_permission == "rooms" || _permission == "reports" || _permission == "invoices");

            if (!isDashboardRead)
            {
                context.Result = new ForbidResult();
            }
        }
    }
}
