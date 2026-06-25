using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NhaTro.Authorization;
using NhaTro.Dtos.Pricing;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [Authorize(Policy = "AdminOnly")]
    [RequireAdminPagePermission("pricing-settings")]
    [ApiController]
    [Route("api/pricing-settings")]
    public class PricingSettingsController : ControllerBase
    {
        private readonly IPricingSettingsService _pricingSettingsService;

        public PricingSettingsController(IPricingSettingsService pricingSettingsService)
        {
            _pricingSettingsService = pricingSettingsService;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            return Ok(await _pricingSettingsService.GetAsync());
        }

        [HttpPut]
        public async Task<IActionResult> Update([FromBody] PricingSettingsDto dto)
        {
            try
            {
                return Ok(await _pricingSettingsService.UpdateAsync(dto));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
