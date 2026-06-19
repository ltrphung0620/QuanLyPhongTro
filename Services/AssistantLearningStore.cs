using System.Text.Json;
using NhaTro.Dtos.Assistant;

namespace NhaTro.Services
{
    public class AssistantLearningStore
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        };

        private readonly object _lock = new();
        private readonly string _filePath;

        public AssistantLearningStore(IWebHostEnvironment environment)
        {
            var directory = Path.Combine(environment.ContentRootPath, "App_Data");
            Directory.CreateDirectory(directory);
            _filePath = Path.Combine(directory, "assistant-learning.json");
        }

        public void RecordMistake(int userId, string message, AssistantCommandDto command)
        {
            var items = ReadAll();
            items.Add(new AssistantLearningItem
            {
                UserId = userId,
                RawMessage = message,
                RejectedIntent = command.Intent,
                RejectedParams = command.Params
                    .Where(x => !string.IsNullOrWhiteSpace(x.Value))
                    .ToDictionary(x => x.Key, x => x.Value),
                CreatedAt = DateTime.UtcNow
            });

            WriteAll(items);
        }

        public void RecordCorrection(int userId, string message, AssistantCommandDto command)
        {
            var items = ReadAll();
            var latest = items
                .Where(x => x.UserId == userId && x.Kind != "value_alias" && x.CorrectedIntent == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefault();

            if (latest == null)
            {
                return;
            }

            latest.CorrectionMessage = message;
            latest.CorrectedIntent = command.Intent;
            latest.CorrectedParams = command.Params
                .Where(x => !string.IsNullOrWhiteSpace(x.Value))
                .ToDictionary(x => x.Key, x => x.Value);

            WriteAll(items);
        }

        public void RecordValueAlias(int userId, string intent, string field, string rawValue, string normalizedValue)
        {
            var items = ReadAll();
            var normalizedRaw = NormalizeKey(rawValue);
            var existing = items.FirstOrDefault(x =>
                x.UserId == userId
                && x.Kind == "value_alias"
                && x.Intent == intent
                && x.Field == field
                && x.RawValueKey == normalizedRaw);

            if (existing == null)
            {
                items.Add(new AssistantLearningItem
                {
                    Kind = "value_alias",
                    UserId = userId,
                    Intent = intent,
                    Field = field,
                    RawValue = rawValue,
                    RawValueKey = normalizedRaw,
                    NormalizedValue = normalizedValue,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.RawValue = rawValue;
                existing.NormalizedValue = normalizedValue;
                existing.CreatedAt = DateTime.UtcNow;
            }

            WriteAll(items);
        }

        public void ApplyValueAliases(int userId, string intent, string rawMessage, AssistantCommandDto command)
        {
            var messageKey = NormalizeKey(rawMessage);
            var aliases = ReadAll()
                .Where(x =>
                    x.UserId == userId
                    && x.Kind == "value_alias"
                    && x.Intent == intent
                    && x.Field != null
                    && x.NormalizedValue != null)
                .ToList();

            foreach (var alias in aliases)
            {
                if (alias.RawValueKey == null || !messageKey.Contains(alias.RawValueKey))
                {
                    continue;
                }

                if (!command.Params.TryGetValue(alias.Field!, out var currentValue) || string.IsNullOrWhiteSpace(currentValue))
                {
                    command.Params[alias.Field!] = alias.NormalizedValue;
                }
            }
        }

        public string BuildPromptLessons(int userId)
        {
            var items = ReadAll()
                .Where(x => x.UserId == userId && x.Kind != "value_alias" && x.CorrectedIntent != null)
                .OrderByDescending(x => x.CreatedAt)
                .Take(8)
                .ToList();

            var correctionLessons = string.Join("\n", items.Select(item =>
                $"- If user says similar to \"{item.CorrectionMessage}\", prefer intent {item.CorrectedIntent} with params {JsonSerializer.Serialize(item.CorrectedParams, JsonOptions)}. Avoid previous rejected intent {item.RejectedIntent}."));

            var aliases = ReadAll()
                .Where(x => x.UserId == userId && x.Kind == "value_alias" && x.Field != null && x.RawValue != null && x.NormalizedValue != null)
                .OrderByDescending(x => x.CreatedAt)
                .Take(12)
                .Select(x => $"- Interpret \"{x.RawValue}\" as {x.Field}={x.NormalizedValue} for intent {x.Intent}.")
                .ToList();

            var aliasLessons = string.Join("\n", aliases);
            var lessons = string.Join("\n", new[] { correctionLessons, aliasLessons }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return string.IsNullOrWhiteSpace(lessons) ? "No user-specific correction history." : lessons;
        }

        private static string NormalizeKey(string value)
        {
            return new string(value.Trim().ToLowerInvariant().Where(c => !char.IsWhiteSpace(c)).ToArray());
        }

        private List<AssistantLearningItem> ReadAll()
        {
            lock (_lock)
            {
                if (!File.Exists(_filePath))
                {
                    return new List<AssistantLearningItem>();
                }

                var json = File.ReadAllText(_filePath);
                return string.IsNullOrWhiteSpace(json)
                    ? new List<AssistantLearningItem>()
                    : JsonSerializer.Deserialize<List<AssistantLearningItem>>(json, JsonOptions) ?? new List<AssistantLearningItem>();
            }
        }

        private void WriteAll(List<AssistantLearningItem> items)
        {
            lock (_lock)
            {
                var trimmed = items
                    .OrderByDescending(x => x.CreatedAt)
                    .Take(500)
                    .OrderBy(x => x.CreatedAt)
                    .ToList();

                File.WriteAllText(_filePath, JsonSerializer.Serialize(trimmed, JsonOptions));
            }
        }
    }

    public class AssistantLearningItem
    {
        public string Kind { get; set; } = "intent_correction";
        public int UserId { get; set; }
        public string RawMessage { get; set; } = string.Empty;
        public string RejectedIntent { get; set; } = string.Empty;
        public Dictionary<string, string?> RejectedParams { get; set; } = new();
        public string? CorrectionMessage { get; set; }
        public string? CorrectedIntent { get; set; }
        public Dictionary<string, string?>? CorrectedParams { get; set; }
        public string? Intent { get; set; }
        public string? Field { get; set; }
        public string? RawValue { get; set; }
        public string? RawValueKey { get; set; }
        public string? NormalizedValue { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
