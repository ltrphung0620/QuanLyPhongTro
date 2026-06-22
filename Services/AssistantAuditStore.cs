using System.Text.Json;
using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantAuditStore
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        };

        private readonly object _lock = new();
        private readonly string _filePath;

        public AssistantAuditStore(IWebHostEnvironment environment)
        {
            var directory = Path.Combine(environment.ContentRootPath, "App_Data");
            Directory.CreateDirectory(directory);
            _filePath = Path.Combine(directory, "assistant-audit-log.json");
        }

        public void Record(AssistantAuditItem item)
        {
            var items = ReadAll();
            item.Id = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N") : item.Id;
            item.CreatedAt = item.CreatedAt == default ? DateTime.UtcNow : item.CreatedAt;
            items.Add(item);
            WriteAll(items);
        }

        public IReadOnlyList<AssistantAuditItem> GetLatest(int userId, int take = 100)
        {
            return ReadAll()
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(Math.Clamp(take, 1, 300))
                .ToList();
        }

        private List<AssistantAuditItem> ReadAll()
        {
            lock (_lock)
            {
                if (!File.Exists(_filePath))
                {
                    return new List<AssistantAuditItem>();
                }

                var json = File.ReadAllText(_filePath);
                return string.IsNullOrWhiteSpace(json)
                    ? new List<AssistantAuditItem>()
                    : JsonSerializer.Deserialize<List<AssistantAuditItem>>(json, JsonOptions) ?? new List<AssistantAuditItem>();
            }
        }

        private void WriteAll(List<AssistantAuditItem> items)
        {
            lock (_lock)
            {
                var trimmed = items
                    .OrderByDescending(x => x.CreatedAt)
                    .Take(1000)
                    .OrderBy(x => x.CreatedAt)
                    .ToList();

                File.WriteAllText(_filePath, JsonSerializer.Serialize(trimmed, JsonOptions));
            }
        }
    }

    public class AssistantAuditItem
    {
        public string Id { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string? UserMessage { get; set; }
        public string? CommandId { get; set; }
        public string Parser { get; set; } = string.Empty;
        public double Confidence { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Intent { get; set; } = string.Empty;
        public string ToolName { get; set; } = string.Empty;
        public string ToolMode { get; set; } = string.Empty;
        public string RiskLevel { get; set; } = string.Empty;
        public bool RequiresConfirmation { get; set; }
        public bool RequiresStrongConfirmation { get; set; }
        public Dictionary<string, string?> Params { get; set; } = new();
        public List<string> MissingFields { get; set; } = new();
        public string ResponseType { get; set; } = string.Empty;
        public string ResponseMessage { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
        public string? Error { get; set; }
        public object? ResultSummary { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
