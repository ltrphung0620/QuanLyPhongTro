using System.Collections.Concurrent;
using System.Threading.Channels;
using System.Text.Json;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class RealtimeService : IRealtimeService
    {
        private readonly ConcurrentDictionary<string, Channel<string>> _clients = new();

        public string RegisterClient()
        {
            var clientId = Guid.NewGuid().ToString("N");
            var channel = Channel.CreateUnbounded<string>();
            _clients[clientId] = channel;
            return clientId;
        }

        public void UnregisterClient(string clientId)
        {
            if (_clients.TryRemove(clientId, out var channel))
            {
                channel.Writer.TryComplete();
            }
        }

        public async Task<string?> WaitForEventAsync(string clientId, CancellationToken cancellationToken)
        {
            if (!_clients.TryGetValue(clientId, out var channel))
            {
                return null;
            }

            try
            {
                return await channel.Reader.ReadAsync(cancellationToken);
            }
            catch (ChannelClosedException)
            {
                return null;
            }
        }

        public Task PublishAsync(string eventName, params string[] modules)
        {
            var payload = JsonSerializer.Serialize(new
            {
                eventName,
                modules = modules
                    .Where(module => !string.IsNullOrWhiteSpace(module))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray(),
                occurredAt = DateTime.UtcNow
            });

            foreach (var client in _clients.Values)
            {
                client.Writer.TryWrite(payload);
            }

            return Task.CompletedTask;
        }
    }
}
