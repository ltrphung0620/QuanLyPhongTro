using NhaTro.Models;

namespace NhaTro.Interfaces.Services
{
    public interface IExpoPushNotificationService
    {
        Task SendAsync(
            IReadOnlyCollection<TenantDeviceToken> devices,
            string title,
            string body,
            object data,
            CancellationToken cancellationToken = default);
    }
}
