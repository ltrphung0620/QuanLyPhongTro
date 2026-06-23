namespace NhaTro.Interfaces.Services
{
    public interface IRealtimeService
    {
        string RegisterClient();
        void UnregisterClient(string clientId);
        Task<string?> WaitForEventAsync(string clientId, CancellationToken cancellationToken);
        Task PublishAsync(string eventName, params string[] modules);
        Task PublishWithDataAsync(string eventName, object? data, params string[] modules);
        Task PublishToTenantAsync(int tenantId, string eventName, object? data = null, params string[] modules);
    }
}
