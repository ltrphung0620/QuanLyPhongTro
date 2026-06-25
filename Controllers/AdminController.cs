using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Interfaces.Services;
using System.Linq;
using System.Threading.Tasks;

namespace NhaTro.Controllers
{
    [Route("api/admin")]
    [ApiController]
    [Authorize(Policy = "AdminOnly")]
    public class AdminController : ControllerBase
    {
        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public AdminController(NhaTroDbContext context, ICurrentUserService currentUserService)
        {
            _context = context;
            _currentUserService = currentUserService;
        }

        // GET /api/admin/organizations
        [HttpGet("organizations")]
        public async Task<IActionResult> GetOrganizations()
        {
            var userId = _currentUserService.UserId;
            var memberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Include(m => m.Organization)
                .Where(m => m.UserId == userId && m.IsActive && m.Organization.IsActive)
                .ToListAsync();

            var permissions = await _context.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .Where(p => p.UserId == userId && p.CanAccess)
                .ToListAsync();

            var orgs = memberships.Select(m => new UserOrganizationDto
            {
                Id = m.OrganizationId,
                Name = m.Organization.Name,
                Code = m.Organization.Code,
                IsActive = m.Organization.IsActive,
                HasFullAccess = m.CanAccessAllPages,
                PagePermissions = permissions
                    .Where(p => p.OrganizationId == m.OrganizationId)
                    .Select(p => p.PageKey)
                    .ToList()
            }).ToList();

            return Ok(orgs);
        }
    }
}
