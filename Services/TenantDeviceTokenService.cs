using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos.TenantDevices;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class TenantDeviceTokenService : ITenantDeviceTokenService
    {
        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public TenantDeviceTokenService(NhaTroDbContext context, ICurrentUserService currentUserService)
        {
            _context = context;
            _currentUserService = currentUserService;
        }

        public async Task<TenantDeviceToken> RegisterAsync(RegisterTenantDeviceTokenDto dto)
        {
            var tenantId = _currentUserService.TenantId
                ?? throw new InvalidOperationException("Tai khoan hien tai khong phai khach thue.");
            var organizationId = _currentUserService.OrganizationId
                ?? throw new InvalidOperationException("Khong xac dinh duoc to chuc hien tai.");
            var userId = _currentUserService.UserId;

            var token = NormalizeToken(dto.ExpoPushToken);
            var device = await _context.TenantDeviceTokens
                .FirstOrDefaultAsync(x => x.OrganizationId == organizationId && x.ExpoPushToken == token);

            if (device == null)
            {
                device = new TenantDeviceToken
                {
                    OrganizationId = organizationId,
                    ExpoPushToken = token,
                    CreatedAt = DateTime.UtcNow
                };
                _context.TenantDeviceTokens.Add(device);
            }

            device.TenantId = tenantId;
            device.AppUserId = userId;
            device.Platform = TrimOrNull(dto.Platform, 30);
            device.DeviceName = TrimOrNull(dto.DeviceName, 120);
            device.IsActive = true;
            device.LastSeenAt = DateTime.UtcNow;
            device.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return device;
        }

        public async Task<bool> UnregisterAsync(string expoPushToken)
        {
            var tenantId = _currentUserService.TenantId;
            var organizationId = _currentUserService.OrganizationId;
            if (!tenantId.HasValue || !organizationId.HasValue)
            {
                return false;
            }

            var token = NormalizeToken(expoPushToken);
            var device = await _context.TenantDeviceTokens
                .FirstOrDefaultAsync(x =>
                    x.OrganizationId == organizationId.Value &&
                    x.TenantId == tenantId.Value &&
                    x.ExpoPushToken == token);

            if (device == null)
            {
                return false;
            }

            device.IsActive = false;
            device.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public Task<List<TenantDeviceToken>> GetActiveTenantDevicesAsync(int tenantId, int organizationId)
        {
            return _context.TenantDeviceTokens
                .AsNoTracking()
                .Where(x => x.OrganizationId == organizationId &&
                            x.TenantId == tenantId &&
                            x.IsActive)
                .ToListAsync();
        }

        public async Task MarkInactiveAsync(IEnumerable<string> expoPushTokens)
        {
            var tokens = expoPushTokens
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(NormalizeToken)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (tokens.Count == 0)
            {
                return;
            }

            var devices = await _context.TenantDeviceTokens
                .Where(x => tokens.Contains(x.ExpoPushToken))
                .ToListAsync();

            foreach (var device in devices)
            {
                device.IsActive = false;
                device.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        private static string NormalizeToken(string value)
        {
            var token = value.Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                throw new InvalidOperationException("Expo push token khong hop le.");
            }

            return token;
        }

        private static string? TrimOrNull(string? value, int maxLength)
        {
            var trimmed = value?.Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                return null;
            }

            return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
        }
    }
}
