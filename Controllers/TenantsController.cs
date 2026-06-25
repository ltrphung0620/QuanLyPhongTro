using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NhaTro.Authorization;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Dtos.Tenants;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using System;
using System.Threading.Tasks;

namespace NhaTro.Controllers
{
    [Authorize(Policy = "AdminOnly")]
    [RequireAdminPagePermission("tenants")]
    [ApiController]
    [Route("api/[controller]")]
    public class TenantsController : ControllerBase
    {
        private readonly ITenantService _tenantService;
        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public TenantsController(
            ITenantService tenantService,
            NhaTroDbContext context,
            ICurrentUserService currentUserService)
        {
            _tenantService = tenantService;
            _context = context;
            _currentUserService = currentUserService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var tenants = await _tenantService.GetAllAsync();
            return Ok(tenants);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var tenant = await _tenantService.GetByIdAsync(id);

            if (tenant == null)
            {
                return NotFound(new { message = "Không tìm thấy người thuê." });
            }

            return Ok(tenant);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTenantDto dto)
        {
            var createdTenant = await _tenantService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = createdTenant.TenantId }, createdTenant);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTenantDto dto)
        {
            var updatedTenant = await _tenantService.UpdateAsync(id, dto);

            if (updatedTenant == null)
            {
                return NotFound(new { message = "Không tìm thấy người thuê." });
            }

            return Ok(updatedTenant);
        }

        // GET /api/admin/tenants/{tenantId}/account
        [HttpGet("/api/admin/tenants/{tenantId:int}/account")]
        public async Task<IActionResult> GetTenantAccount(int tenantId)
        {
            var adminOrgId = _currentUserService.OrganizationId;
            if (!adminOrgId.HasValue) return Forbid();

            // Verify the Tenant belongs to the admin's organization (implicit by query filter)
            var tenant = await _context.Tenants
                .FirstOrDefaultAsync(t => t.TenantId == tenantId);

            if (tenant == null)
            {
                return NotFound(new { message = "Không tìm thấy người thuê." });
            }

            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.TenantId == tenantId);

            if (user == null)
            {
                return Ok(null); // No account exists
            }

            return Ok(new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                DisplayName = user.DisplayName,
                Role = user.Role,
                OrganizationId = user.OrganizationId,
                TenantId = user.TenantId,
                MustChangePassword = user.MustChangePassword,
                IsActive = user.IsActive,
                LastLoginAt = user.LastLoginAt
            });
        }

        // POST /api/admin/tenants/{tenantId}/account
        [HttpPost("/api/admin/tenants/{tenantId:int}/account")]
        public async Task<IActionResult> CreateTenantAccount(int tenantId, [FromBody] CreateAdminDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var adminOrgId = _currentUserService.OrganizationId;
            if (!adminOrgId.HasValue) return Forbid();

            // Verify Tenant exists
            var tenant = await _context.Tenants
                .FirstOrDefaultAsync(t => t.TenantId == tenantId);

            if (tenant == null)
            {
                return NotFound(new { message = "Không tìm thấy người thuê." });
            }

            // Check if tenant already has an account
            var accountExists = await _context.Users
                .IgnoreQueryFilters()
                .AnyAsync(u => u.TenantId == tenantId);

            if (accountExists) return BadRequest(new { message = "Khách thuê đã có tài khoản login." });

            // Check if username/email exists globally
            var usernameOrEmailExists = await _context.Users
                .IgnoreQueryFilters()
                .AnyAsync(u => u.Username == dto.Username || u.Email == dto.Email);

            if (usernameOrEmailExists) return BadRequest(new { message = "Username hoặc Email đã được sử dụng." });

            var tenantUser = new AppUser
            {
                Username = dto.Username,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                DisplayName = dto.DisplayName,
                Role = "Tenant",
                OrganizationId = adminOrgId.Value,
                TenantId = tenantId,
                IsActive = true,
                MustChangePassword = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(tenantUser);
            await _context.SaveChangesAsync();

            return Ok(new UserProfileDto
            {
                Id = tenantUser.Id,
                Username = tenantUser.Username,
                Email = tenantUser.Email,
                DisplayName = tenantUser.DisplayName,
                Role = tenantUser.Role,
                OrganizationId = tenantUser.OrganizationId,
                TenantId = tenantUser.TenantId,
                MustChangePassword = tenantUser.MustChangePassword,
                IsActive = tenantUser.IsActive
            });
        }

        // POST /api/admin/tenant-accounts/{userId}/reset-password
        [HttpPost("/api/admin/tenant-accounts/{userId:int}/reset-password")]
        public async Task<IActionResult> ResetTenantPassword(int userId, [FromBody] ResetPasswordDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var adminOrgId = _currentUserService.OrganizationId;
            if (!adminOrgId.HasValue) return Forbid();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Tenant");

            if (user == null) return NotFound(new { message = "Không tìm thấy tài khoản khách thuê." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.MustChangePassword = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đặt lại mật khẩu thành công." });
        }

        // POST /api/admin/tenant-accounts/{userId}/disable
        [HttpPost("/api/admin/tenant-accounts/{userId:int}/disable")]
        public async Task<IActionResult> DisableTenantAccount(int userId)
        {
            var adminOrgId = _currentUserService.OrganizationId;
            if (!adminOrgId.HasValue) return Forbid();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Tenant");

            if (user == null) return NotFound(new { message = "Không tìm thấy tài khoản khách thuê." });

            user.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Khóa tài khoản thành công." });
        }

        // POST /api/admin/tenant-accounts/{userId}/enable
        [HttpPost("/api/admin/tenant-accounts/{userId:int}/enable")]
        public async Task<IActionResult> EnableTenantAccount(int userId)
        {
            var adminOrgId = _currentUserService.OrganizationId;
            if (!adminOrgId.HasValue) return Forbid();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == "Tenant");

            if (user == null) return NotFound(new { message = "Không tìm thấy tài khoản khách thuê." });

            user.IsActive = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Mở khóa tài khoản thành công." });
        }
    }
}
