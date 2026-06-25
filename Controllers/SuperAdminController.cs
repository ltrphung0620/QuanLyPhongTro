using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Models;
using System;
using System.Collections.Generic;
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
        private static readonly HashSet<string> ValidAdminPagePermissions = new(StringComparer.OrdinalIgnoreCase)
        {
            "dashboard",
            "rooms",
            "tenants",
            "contracts",
            "meter-readings",
            "invoices",
            "payments",
            "reports",
            "pricing-settings",
            "assistant"
        };

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
            var userIds = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Where(m => m.OrganizationId == id)
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();

            var users = await _context.Users
                .IgnoreQueryFilters()
                .Where(u => userIds.Contains(u.Id) && u.Role == "Admin")
                .ToListAsync();

            var memberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Include(m => m.Organization)
                .Where(m => userIds.Contains(m.UserId))
                .ToListAsync();

            var allPermissions = await _context.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .Where(p => userIds.Contains(p.UserId) && p.CanAccess)
                .ToListAsync();

            var admins = users.Select(u =>
            {
                var userMemberships = memberships.Where(m => m.UserId == u.Id).ToList();
                var userOrgs = userMemberships.Select(m => new UserOrganizationDto
                {
                    Id = m.OrganizationId,
                    Name = m.Organization.Name,
                    Code = m.Organization.Code,
                    IsActive = m.Organization.IsActive,
                    HasFullAccess = m.CanAccessAllPages,
                    PagePermissions = allPermissions
                        .Where(p => p.UserId == u.Id && p.OrganizationId == m.OrganizationId)
                        .Select(p => p.PageKey)
                        .ToList()
                }).ToList();

                var currentOrgMembership = userMemberships.FirstOrDefault(m => m.OrganizationId == id);

                return new UserProfileDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    Email = u.Email,
                    DisplayName = u.DisplayName,
                    Role = u.Role,
                    OrganizationId = id,
                    MustChangePassword = u.MustChangePassword,
                    IsActive = u.IsActive,
                    LastLoginAt = u.LastLoginAt,
                    HasFullAccess = currentOrgMembership?.CanAccessAllPages ?? false,
                    PagePermissions = allPermissions
                        .Where(p => p.UserId == u.Id && p.OrganizationId == id)
                        .Select(p => p.PageKey)
                        .ToList(),
                    Organizations = userOrgs,
                    ActiveOrganization = userOrgs.FirstOrDefault(o => o.Id == id)
                };
            }).ToList();

            return Ok(admins);
        }

        // GET /api/super-admin/admins
        [HttpGet("admins")]
        public async Task<IActionResult> GetAllAdmins()
        {
            var users = await _context.Users
                .IgnoreQueryFilters()
                .Where(u => u.Role == "Admin")
                .ToListAsync();

            var userIds = users.Select(u => u.Id).ToList();

            var memberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Include(m => m.Organization)
                .Where(m => userIds.Contains(m.UserId))
                .ToListAsync();

            var allPermissions = await _context.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .Where(p => userIds.Contains(p.UserId) && p.CanAccess)
                .ToListAsync();

            var admins = users.Select(u =>
            {
                var userMemberships = memberships.Where(m => m.UserId == u.Id).ToList();
                var userOrgs = userMemberships.Select(m => new UserOrganizationDto
                {
                    Id = m.OrganizationId,
                    Name = m.Organization.Name,
                    Code = m.Organization.Code,
                    IsActive = m.Organization.IsActive,
                    HasFullAccess = m.CanAccessAllPages,
                    PagePermissions = allPermissions
                        .Where(p => p.UserId == u.Id && p.OrganizationId == m.OrganizationId)
                        .Select(p => p.PageKey)
                        .ToList()
                }).ToList();

                var firstOrgId = userOrgs.FirstOrDefault()?.Id ?? 0;

                return new UserProfileDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    Email = u.Email,
                    DisplayName = u.DisplayName,
                    Role = u.Role,
                    OrganizationId = firstOrgId,
                    MustChangePassword = u.MustChangePassword,
                    IsActive = u.IsActive,
                    LastLoginAt = u.LastLoginAt,
                    HasFullAccess = userMemberships.FirstOrDefault(m => m.OrganizationId == firstOrgId)?.CanAccessAllPages ?? false,
                    PagePermissions = allPermissions
                        .Where(p => p.UserId == u.Id && p.OrganizationId == firstOrgId)
                        .Select(p => p.PageKey)
                        .ToList(),
                    Organizations = userOrgs,
                    ActiveOrganization = userOrgs.FirstOrDefault(o => o.Id == firstOrgId)
                };
            }).ToList();

            return Ok(admins);
        }

        // POST /api/super-admin/admins
        [HttpPost("admins")]
        public async Task<IActionResult> CreateAdminWithoutOrg([FromBody] CreateAdminDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var firstOrgId = dto.Memberships?.FirstOrDefault()?.OrganizationId ?? 0;
            if (firstOrgId == 0) return BadRequest(new { message = "Admin must be assigned to at least one organization." });

            var org = await _context.Organizations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == firstOrgId);

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
                OrganizationId = firstOrgId,
                PagePermissions = "*",
                IsActive = true,
                MustChangePassword = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(adminUser);
            await _context.SaveChangesAsync();

            var savedPermissions = new List<AdminOrganizationPagePermission>();
            var membershipsInput = dto.Memberships ?? new List<AdminOrganizationInputDto>();

            foreach (var m in membershipsInput)
            {
                var membership = new AdminOrganizationMembership
                {
                    UserId = adminUser.Id,
                    OrganizationId = m.OrganizationId,
                    IsActive = true,
                    CanAccessAllPages = m.HasFullAccess,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.AdminOrganizationMemberships.Add(membership);

                if (!m.HasFullAccess && m.PagePermissions != null)
                {
                    foreach (var perm in m.PagePermissions)
                    {
                        var pagePermission = new AdminOrganizationPagePermission
                        {
                            UserId = adminUser.Id,
                            OrganizationId = m.OrganizationId,
                            PageKey = perm.Trim().ToLowerInvariant(),
                            CanAccess = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.AdminOrganizationPagePermissions.Add(pagePermission);
                        savedPermissions.Add(pagePermission);
                    }
                }
            }

            await _context.SaveChangesAsync();

            var memberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Include(m => m.Organization)
                .Where(m => m.UserId == adminUser.Id)
                .ToListAsync();

            var userOrgs = memberships.Select(m => new UserOrganizationDto
            {
                Id = m.OrganizationId,
                Name = m.Organization.Name,
                Code = m.Organization.Code,
                IsActive = m.Organization.IsActive,
                HasFullAccess = m.CanAccessAllPages,
                PagePermissions = savedPermissions
                    .Where(p => p.OrganizationId == m.OrganizationId)
                    .Select(p => p.PageKey)
                    .ToList()
            }).ToList();

            var defaultOrgId = firstOrgId;

            return Ok(new UserProfileDto
            {
                Id = adminUser.Id,
                Username = adminUser.Username,
                Email = adminUser.Email,
                DisplayName = adminUser.DisplayName,
                Role = adminUser.Role,
                OrganizationId = defaultOrgId,
                MustChangePassword = adminUser.MustChangePassword,
                IsActive = adminUser.IsActive,
                HasFullAccess = memberships.FirstOrDefault(m => m.OrganizationId == defaultOrgId)?.CanAccessAllPages ?? false,
                PagePermissions = savedPermissions
                    .Where(p => p.OrganizationId == defaultOrgId)
                    .Select(p => p.PageKey)
                    .ToList(),
                Organizations = userOrgs,
                ActiveOrganization = userOrgs.FirstOrDefault(o => o.Id == defaultOrgId)
            });
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
                OrganizationId = dto.Memberships.FirstOrDefault()?.OrganizationId ?? id,
                PagePermissions = "*",
                IsActive = true,
                MustChangePassword = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(adminUser);
            await _context.SaveChangesAsync();

            var savedPermissions = new List<AdminOrganizationPagePermission>();
            var membershipsInput = dto.Memberships;

            if (membershipsInput == null || membershipsInput.Count == 0)
            {
                membershipsInput = new List<AdminOrganizationInputDto>
                {
                    new AdminOrganizationInputDto
                    {
                        OrganizationId = id,
                        HasFullAccess = dto.HasFullAccess,
                        PagePermissions = dto.PagePermissions
                    }
                };
            }

            foreach (var m in membershipsInput)
            {
                var membership = new AdminOrganizationMembership
                {
                    UserId = adminUser.Id,
                    OrganizationId = m.OrganizationId,
                    IsActive = true,
                    CanAccessAllPages = m.HasFullAccess,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.AdminOrganizationMemberships.Add(membership);

                if (!m.HasFullAccess && m.PagePermissions != null)
                {
                    foreach (var perm in m.PagePermissions)
                    {
                        var pagePermission = new AdminOrganizationPagePermission
                        {
                            UserId = adminUser.Id,
                            OrganizationId = m.OrganizationId,
                            PageKey = perm.Trim().ToLowerInvariant(),
                            CanAccess = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.AdminOrganizationPagePermissions.Add(pagePermission);
                        savedPermissions.Add(pagePermission);
                    }
                }
            }

            await _context.SaveChangesAsync();

            var memberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Include(m => m.Organization)
                .Where(m => m.UserId == adminUser.Id)
                .ToListAsync();

            var userOrgs = memberships.Select(m => new UserOrganizationDto
            {
                Id = m.OrganizationId,
                Name = m.Organization.Name,
                Code = m.Organization.Code,
                IsActive = m.Organization.IsActive,
                HasFullAccess = m.CanAccessAllPages,
                PagePermissions = savedPermissions
                    .Where(p => p.OrganizationId == m.OrganizationId)
                    .Select(p => p.PageKey)
                    .ToList()
            }).ToList();

            var currentOrgMembership = memberships.FirstOrDefault(m => m.OrganizationId == id);

            return Ok(new UserProfileDto
            {
                Id = adminUser.Id,
                Username = adminUser.Username,
                Email = adminUser.Email,
                DisplayName = adminUser.DisplayName,
                Role = adminUser.Role,
                OrganizationId = id,
                MustChangePassword = adminUser.MustChangePassword,
                IsActive = adminUser.IsActive,
                HasFullAccess = currentOrgMembership?.CanAccessAllPages ?? false,
                PagePermissions = savedPermissions
                    .Where(p => p.OrganizationId == id)
                    .Select(p => p.PageKey)
                    .ToList(),
                Organizations = userOrgs,
                ActiveOrganization = userOrgs.FirstOrDefault(o => o.Id == id)
            });
        }

        // PUT /api/super-admin/users/{id}/permissions
        [HttpPut("users/{id}/permissions")]
        public async Task<IActionResult> UpdateAdminPermissions(int id, [FromBody] UpdateAdminPermissionsDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == id && u.Role == "Admin");

            if (user == null) return NotFound(new { message = "Admin user not found." });

            var defaultOrgId = user.OrganizationId ?? 0;
            if (defaultOrgId == 0)
            {
                var firstMembership = await _context.AdminOrganizationMemberships
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(m => m.UserId == id);
                defaultOrgId = firstMembership?.OrganizationId ?? 0;
            }

            if (defaultOrgId == 0) return BadRequest(new { message = "Admin has no assigned organization." });

            var membership = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(m => m.UserId == id && m.OrganizationId == defaultOrgId);
            
            if (membership != null)
            {
                membership.CanAccessAllPages = dto.HasFullAccess;
                membership.UpdatedAt = DateTime.UtcNow;
            }

            var existingPermissions = await _context.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .Where(p => p.UserId == id && p.OrganizationId == defaultOrgId)
                .ToListAsync();
            _context.AdminOrganizationPagePermissions.RemoveRange(existingPermissions);

            if (!dto.HasFullAccess && dto.PagePermissions != null)
            {
                foreach (var perm in dto.PagePermissions)
                {
                    if (ValidAdminPagePermissions.Contains(perm))
                    {
                        var pagePermission = new AdminOrganizationPagePermission
                        {
                            UserId = id,
                            OrganizationId = defaultOrgId,
                            PageKey = perm.Trim().ToLowerInvariant(),
                            CanAccess = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.AdminOrganizationPagePermissions.Add(pagePermission);
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Permissions updated successfully." });
        }

        // PUT /api/super-admin/users/{id}
        [HttpPut("users/{id}")]
        public async Task<IActionResult> UpdateAdminProfile(int id, [FromBody] UpdateAdminProfileDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == id && u.Role == "Admin");

            if (user == null) return NotFound(new { message = "Admin user not found." });

            if (user.Username != dto.Username)
            {
                var usernameExists = await _context.Users
                    .IgnoreQueryFilters()
                    .AnyAsync(u => u.Username == dto.Username && u.Id != id);
                if (usernameExists) return BadRequest(new { message = "Username already exists." });
            }

            if (user.Email != dto.Email)
            {
                var emailExists = await _context.Users
                    .IgnoreQueryFilters()
                    .AnyAsync(u => u.Email == dto.Email && u.Id != id);
                if (emailExists) return BadRequest(new { message = "Email already exists." });
            }

            var existingMemberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Where(m => m.UserId == id)
                .ToListAsync();

            var existingPermissions = await _context.AdminOrganizationPagePermissions
                .IgnoreQueryFilters()
                .Where(p => p.UserId == id)
                .ToListAsync();

            _context.AdminOrganizationMemberships.RemoveRange(existingMemberships);
            _context.AdminOrganizationPagePermissions.RemoveRange(existingPermissions);

            var savedPermissions = new List<AdminOrganizationPagePermission>();

            if (dto.Memberships != null)
            {
                foreach (var m in dto.Memberships)
                {
                    var membership = new AdminOrganizationMembership
                    {
                        UserId = id,
                        OrganizationId = m.OrganizationId,
                        IsActive = true,
                        CanAccessAllPages = m.HasFullAccess,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.AdminOrganizationMemberships.Add(membership);

                    if (!m.HasFullAccess && m.PagePermissions != null)
                    {
                        foreach (var perm in m.PagePermissions)
                        {
                            var pagePermission = new AdminOrganizationPagePermission
                            {
                                UserId = id,
                                OrganizationId = m.OrganizationId,
                                PageKey = perm.Trim().ToLowerInvariant(),
                                CanAccess = true,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };
                            _context.AdminOrganizationPagePermissions.Add(pagePermission);
                            savedPermissions.Add(pagePermission);
                        }
                    }
                }
            }

            user.DisplayName = dto.DisplayName;
            user.Username = dto.Username;
            user.Email = dto.Email;
            user.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();

            var memberships = await _context.AdminOrganizationMemberships
                .IgnoreQueryFilters()
                .Include(m => m.Organization)
                .Where(m => m.UserId == id)
                .ToListAsync();

            var userOrgs = memberships.Select(m => new UserOrganizationDto
            {
                Id = m.OrganizationId,
                Name = m.Organization.Name,
                Code = m.Organization.Code,
                IsActive = m.Organization.IsActive,
                HasFullAccess = m.CanAccessAllPages,
                PagePermissions = savedPermissions
                    .Where(p => p.OrganizationId == m.OrganizationId)
                    .Select(p => p.PageKey)
                    .ToList()
            }).ToList();

            var defaultOrgId = memberships.FirstOrDefault()?.OrganizationId ?? 0;

            return Ok(new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                DisplayName = user.DisplayName,
                Role = user.Role,
                OrganizationId = defaultOrgId,
                MustChangePassword = user.MustChangePassword,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt,
                HasFullAccess = memberships.FirstOrDefault(m => m.OrganizationId == defaultOrgId)?.CanAccessAllPages ?? false,
                PagePermissions = savedPermissions
                    .Where(p => p.OrganizationId == defaultOrgId)
                    .Select(p => p.PageKey)
                    .ToList(),
                Organizations = userOrgs,
                ActiveOrganization = userOrgs.FirstOrDefault(o => o.Id == defaultOrgId)
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

        private static string SerializePagePermissions(bool hasFullAccess, IEnumerable<string>? permissions)
        {
            if (hasFullAccess)
            {
                return "*";
            }

            var sanitized = (permissions ?? Enumerable.Empty<string>())
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim())
                .Where(p => ValidAdminPagePermissions.Contains(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (sanitized.Count == 0)
            {
                throw new InvalidOperationException("Admin must have at least one page permission.");
            }

            return string.Join(",", sanitized);
        }

        private static List<string> ParsePagePermissions(string? value)
        {
            if (string.IsNullOrWhiteSpace(value) || value == "*")
            {
                return new List<string>();
            }

            return value
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(p => ValidAdminPagePermissions.Contains(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }
}
