using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NhaTro.Dtos.TenantDevices;
using NhaTro.Interfaces.Services;

namespace NhaTro.Controllers
{
    [Route("api/tenant/devices")]
    [ApiController]
    [Authorize(Policy = "TenantOnly")]
    public class TenantDevicesController : ControllerBase
    {
        private readonly ITenantDeviceTokenService _tenantDeviceTokenService;

        public TenantDevicesController(ITenantDeviceTokenService tenantDeviceTokenService)
        {
            _tenantDeviceTokenService = tenantDeviceTokenService;
        }

        [HttpPost]
        public async Task<IActionResult> Register([FromBody] RegisterTenantDeviceTokenDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var device = await _tenantDeviceTokenService.RegisterAsync(dto);
            return Ok(new
            {
                device.TenantDeviceTokenId,
                device.Platform,
                device.DeviceName,
                device.IsActive,
                device.LastSeenAt
            });
        }

        [HttpPost("unregister")]
        public async Task<IActionResult> Unregister([FromBody] UnregisterTenantDeviceTokenDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            await _tenantDeviceTokenService.UnregisterAsync(dto.ExpoPushToken);
            return NoContent();
        }
    }
}
