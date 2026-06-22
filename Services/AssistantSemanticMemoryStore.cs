using System.Text.Json;

namespace NhaTro.Services
{
    public class AssistantSemanticMemoryStore
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        };

        private readonly object _lock = new();
        private readonly string _filePath;

        public AssistantSemanticMemoryStore(IWebHostEnvironment environment)
        {
            var directory = Path.Combine(environment.ContentRootPath, "App_Data");
            Directory.CreateDirectory(directory);
            _filePath = Path.Combine(directory, "assistant-semantic-memory.json");
        }

        public IReadOnlyList<AssistantSemanticMemoryItem> GetMany(IEnumerable<string> sourceKeys)
        {
            var keys = sourceKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);
            return ReadAll()
                .Where(x => keys.Contains(x.SourceKey))
                .ToList();
        }

        public void Upsert(AssistantSemanticMemoryItem item)
        {
            UpsertMany(new[] { item });
        }

        public void UpsertMany(IEnumerable<AssistantSemanticMemoryItem> newItems)
        {
            var items = ReadAll();
            foreach (var item in newItems)
            {
                var existing = items.FirstOrDefault(x => string.Equals(x.SourceKey, item.SourceKey, StringComparison.OrdinalIgnoreCase));
                if (existing == null)
                {
                    items.Add(item);
                }
                else
                {
                    existing.UserId = item.UserId;
                    existing.Kind = item.Kind;
                    existing.Intent = item.Intent;
                    existing.Text = item.Text;
                    existing.Vector = item.Vector;
                    existing.UpdatedAt = item.UpdatedAt;
                }
            }

            WriteAll(items);
        }

        private List<AssistantSemanticMemoryItem> ReadAll()
        {
            lock (_lock)
            {
                if (!File.Exists(_filePath))
                {
                    return new List<AssistantSemanticMemoryItem>();
                }

                var json = File.ReadAllText(_filePath);
                return string.IsNullOrWhiteSpace(json)
                    ? new List<AssistantSemanticMemoryItem>()
                    : JsonSerializer.Deserialize<List<AssistantSemanticMemoryItem>>(json, JsonOptions) ?? new List<AssistantSemanticMemoryItem>();
            }
        }

        private void WriteAll(List<AssistantSemanticMemoryItem> items)
        {
            lock (_lock)
            {
                var trimmed = items
                    .OrderByDescending(x => x.UpdatedAt)
                    .Take(5000)
                    .OrderBy(x => x.UpdatedAt)
                    .ToList();

                File.WriteAllText(_filePath, JsonSerializer.Serialize(trimmed, JsonOptions));
            }
        }
    }

    public class AssistantSemanticMemoryItem
    {
        public int UserId { get; set; }
        public string Kind { get; set; } = string.Empty;
        public string SourceKey { get; set; } = string.Empty;
        public string Intent { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public float[] Vector { get; set; } = Array.Empty<float>();
        public DateTime UpdatedAt { get; set; }
    }

    public record AssistantSemanticMemoryCandidate(
        int UserId,
        string Kind,
        string SourceKey,
        string Intent,
        string Text);
}
