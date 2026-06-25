using System.Security.Claims;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public int UserId
        {
            get
            {
                var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                                  ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue("userId");
                if (int.TryParse(userIdClaim, out int userId))
                {
                    return userId;
                }
                return 0;
            }
        }

        public string? Role => _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Role)
                               ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue("role");

        public int? OrganizationId
        {
            get
            {
                var httpContext = _httpContextAccessor.HttpContext;
                if (httpContext == null) return null;

                var role = Role;
                if (role == "Admin" || role == "SuperAdmin")
                {
                    if (httpContext.Items.TryGetValue("ActiveOrganizationId", out var activeIdObj) && activeIdObj is int activeId)
                    {
                        return activeId;
                    }
                    return null;
                }

                var orgIdClaim = httpContext.User?.FindFirstValue("organizationId");
                if (int.TryParse(orgIdClaim, out int orgId))
                {
                    return orgId;
                }
                return null;
            }
        }

        public int? TenantId
        {
            get
            {
                var tenantIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirstValue("tenantId");
                if (int.TryParse(tenantIdClaim, out int tenantId))
                {
                    return tenantId;
                }
                return null;
            }
        }

        public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated ?? false;
    }
}
