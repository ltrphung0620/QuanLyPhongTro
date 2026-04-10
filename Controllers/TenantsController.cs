using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.Tenants;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TenantsController : ControllerBase
    {
        private readonly ITenantService _tenantService;

        public TenantsController(ITenantService tenantService)
        {
            _tenantService = tenantService;
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
    }
}