using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Models;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace NhaTro.Controllers
{
    [Route("api/super-admin")]
    [ApiController]
    [Authorize(Policy = "SuperAdminOnly")]
    public class SuperAdminController : ControllerBase
    {
        private readonly NhaTroDbContext _context;

        public SuperAdminController(NhaTroDbContext context)
        {
            _context = context;
        }

        // GET /api/super-admin/organizations
        [HttpGet("organizations")]
        public async Task<IActionResult> GetOrganizations()
        {
            var orgs = await _context.Organizations
                .IgnoreQueryFilters()
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
            return Ok(orgs);
        }

        // GET /api/super-admin/organizations/{id}
        [HttpGet("organizations/{id}")]
        public async Task<IActionResult> GetOrganization(int id)
        {
            var org = await _context.Organizations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null) return NotFound(new { message = "Organization not found." });
            return Ok(org);
        }

        // POST /api/super-admin/organizations
        [HttpPost("organizations")]
        public async Task<IActionResult> CreateOrganization([FromBody] CreateOrganizationDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var codeExists = await _context.Organizations
                .IgnoreQueryFilters()
                .AnyAsync(o => o.Code == dto.Code);

            if (codeExists) return BadRequest(new { message = "Organization code already exists." });

            var org = new Organization
            {
                Name = dto.Name,
                Code = dto.Code,
                OwnerName = dto.OwnerName,
                Phone = dto.Phone,
                Email = dto.Email,
                Address = dto.Address,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Organizations.Add(org);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetOrganization), new { id = org.Id }, org);
        }

        // PUT /api/super-admin/organizations/{id}
        [HttpPut("organizations/{id}")]
        public async Task<IActionResult> UpdateOrganization(int id, [FromBody] CreateOrganizationDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var org = await _context.Organizations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null) return NotFound(new { message = "Organization not found." });

            if (org.Code != dto.Code)
            {
                var codeExists = await _context.Organizations
                    .IgnoreQueryFilters()
                    .AnyAsync(o => o.Code == dto.Code && o.Id != id);

                if (codeExists) return BadRequest(new { message = "Organization code already exists." });
            }

            org.Name = dto.Name;
            org.Code = dto.Code;
            org.OwnerName = dto.OwnerName;
            org.Phone = dto.Phone;
            org.Email = dto.Email;
            org.Address = dto.Address;
            org.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(org);
        }

        // POST /api/super-admin/organizations/{id}/disable
        [HttpPost("organizations/{id}/disable")]
        public async Task<IActionResult> DisableOrganization(int id)
        {
            var org = await _context.Organizations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null) return NotFound(new { message = "Organization not found." });

            org.IsActive = false;
            org.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Organization has been deactivated successfully." });
        }

        // POST /api/super-admin/organizations/{id}/enable
        [HttpPost("organizations/{id}/enable")]
        public async Task<IActionResult> EnableOrganization(int id)
        {
            var org = await _context.Organizations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null) return NotFound(new { message = "Organization not found." });

            org.IsActive = true;
            org.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Organization has been activated successfully." });
        }

        // GET /api/super-admin/organizations/{id}/admins
        [HttpGet("organizations/{id}/admins")]
        public async Task<IActionResult> GetAdmins(int id)
        {
            var admins = await _context.Users
                .IgnoreQueryFilters()
                .Where(u => u.OrganizationId == id && u.Role == "Admin")
                .Select(u => new UserProfileDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    Email = u.Email,
                    DisplayName = u.DisplayName,
                    Role = u.Role,
                    OrganizationId = u.OrganizationId,
                    MustChangePassword = u.MustChangePassword,
                    IsActive = u.IsActive,
                    LastLoginAt = u.LastLoginAt
                })
                .ToListAsync();

            return Ok(admins);
        }

        // POST /api/super-admin/organizations/{id}/admins
        [HttpPost("organizations/{id}/admins")]
        public async Task<IActionResult> CreateAdmin(int id, [FromBody] CreateAdminDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var org = await _context.Organizations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null) return NotFound(new { message = "Organization not found." });
            if (!org.IsActive) return BadRequest(new { message = "Cannot create admin for a locked organization." });

            var userExists = await _context.Users
                .IgnoreQueryFilters()
                .AnyAsync(u => u.Username == dto.Username || u.Email == dto.Email);

            if (userExists) return BadRequest(new { message = "Username or Email already exists." });

            var adminUser = new AppUser
            {
                Username = dto.Username,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                DisplayName = dto.DisplayName,
                Role = "Admin",
                OrganizationId = id,
                IsActive = true,
                MustChangePassword = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(adminUser);
            await _context.SaveChangesAsync();

            return Ok(new UserProfileDto
            {
                Id = adminUser.Id,
                Username = adminUser.Username,
                Email = adminUser.Email,
                DisplayName = adminUser.DisplayName,
                Role = adminUser.Role,
                OrganizationId = adminUser.OrganizationId,
                MustChangePassword = adminUser.MustChangePassword,
                IsActive = adminUser.IsActive
            });
        }

        // POST /api/super-admin/users/{id}/reset-password
        [HttpPost("users/{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == id && u.Role == "Admin");

            if (user == null) return NotFound(new { message = "Admin user not found." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.MustChangePassword = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password reset successfully." });
        }
    }
}
