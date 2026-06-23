using NhaTro.Dtos.TenantDevices;
using NhaTro.Models;

namespace NhaTro.Interfaces.Services
{
    public interface ITenantDeviceTokenService
    {
        Task<TenantDeviceToken> RegisterAsync(RegisterTenantDeviceTokenDto dto);
        Task<bool> UnregisterAsync(string expoPushToken);
        Task<List<TenantDeviceToken>> GetActiveTenantDevicesAsync(int tenantId, int organizationId);
        Task MarkInactiveAsync(IEnumerable<string> expoPushTokens);
    }
}
