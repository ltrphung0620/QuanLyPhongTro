using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class ExpoPushNotificationService : IExpoPushNotificationService
    {
        private readonly HttpClient _httpClient;
        private readonly ITenantDeviceTokenService _deviceTokenService;
        private readonly ILogger<ExpoPushNotificationService> _logger;

        public ExpoPushNotificationService(
            HttpClient httpClient,
            ITenantDeviceTokenService deviceTokenService,
            ILogger<ExpoPushNotificationService> logger)
        {
            _httpClient = httpClient;
            _deviceTokenService = deviceTokenService;
            _logger = logger;
        }

        public async Task SendAsync(
            IReadOnlyCollection<TenantDeviceToken> devices,
            string title,
            string body,
            object data,
            CancellationToken cancellationToken = default)
        {
            if (devices.Count == 0)
            {
                return;
            }

            var messages = devices
                .Where(x => !string.IsNullOrWhiteSpace(x.ExpoPushToken))
                .Select(x => new ExpoPushMessage
                {
                    To = x.ExpoPushToken,
                    Title = title,
                    Body = body,
                    Data = data,
                    Sound = "default",
                    Priority = "high"
                })
                .ToList();

            if (messages.Count == 0)
            {
                return;
            }

            try
            {
                using var response = await _httpClient.PostAsJsonAsync(
                    "https://exp.host/--/api/v2/push/send",
                    messages,
                    cancellationToken);

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Expo push failed with status {StatusCode}: {Body}", response.StatusCode, json);
                    return;
                }

                await MarkInvalidTokensInactiveAsync(messages, json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not send Expo push notification.");
            }
        }

        private async Task MarkInvalidTokensInactiveAsync(List<ExpoPushMessage> messages, string json)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<ExpoPushResponse>(json);
                var receipts = payload?.Data;
                if (receipts == null || receipts.Count == 0)
                {
                    return;
                }

                var invalidTokens = receipts
                    .Select((receipt, index) => new { receipt, index })
                    .Where(x => string.Equals(x.receipt.Status, "error", StringComparison.OrdinalIgnoreCase) &&
                                string.Equals(x.receipt.Details?.Error, "DeviceNotRegistered", StringComparison.OrdinalIgnoreCase) &&
                                x.index < messages.Count)
                    .Select(x => messages[x.index].To)
                    .ToList();

                await _deviceTokenService.MarkInactiveAsync(invalidTokens);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Could not parse Expo push response.");
            }
        }

        private sealed class ExpoPushMessage
        {
            [JsonPropertyName("to")]
            public string To { get; set; } = string.Empty;

            [JsonPropertyName("title")]
            public string Title { get; set; } = string.Empty;

            [JsonPropertyName("body")]
            public string Body { get; set; } = string.Empty;

            [JsonPropertyName("data")]
            public object Data { get; set; } = new();

            [JsonPropertyName("sound")]
            public string Sound { get; set; } = "default";

            [JsonPropertyName("priority")]
            public string Priority { get; set; } = "high";
        }

        private sealed class ExpoPushResponse
        {
            [JsonPropertyName("data")]
            public List<ExpoPushReceipt>? Data { get; set; }
        }

        private sealed class ExpoPushReceipt
        {
            [JsonPropertyName("status")]
            public string? Status { get; set; }

            [JsonPropertyName("details")]
            public ExpoPushReceiptDetails? Details { get; set; }
        }

        private sealed class ExpoPushReceiptDetails
        {
            [JsonPropertyName("error")]
            public string? Error { get; set; }
        }
    }
}
