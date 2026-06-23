using System.Text.Json;
using System.Globalization;
using System.Text;
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

        public bool TryGetCorrectedIntent(int userId, string message, out string intent)
        {
            intent = string.Empty;
            var messageKey = NormalizeKey(message);
            if (string.IsNullOrWhiteSpace(messageKey))
            {
                return false;
            }

            var corrections = ReadAll()
                .Where(x =>
                    x.UserId == userId
                    && x.Kind != "value_alias"
                    && !string.IsNullOrWhiteSpace(x.RawMessage)
                    && !string.IsNullOrWhiteSpace(x.CorrectedIntent))
                .OrderByDescending(x => x.CreatedAt)
                .ToList();

            foreach (var correction in corrections)
            {
                var learnedKey = NormalizeKey(correction.RawMessage);
                if (messageKey == learnedKey
                    || messageKey.Contains(learnedKey)
                    || learnedKey.Contains(messageKey)
                    || Similarity(messageKey, learnedKey) >= 0.82)
                {
                    intent = correction.CorrectedIntent!;
                    return true;
                }
            }

            return false;
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
                $"- If user says similar to \"{item.RawMessage}\", prefer intent {item.CorrectedIntent} with params {JsonSerializer.Serialize(item.CorrectedParams, JsonOptions)}. Avoid previous rejected intent {item.RejectedIntent}."));

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

        public IReadOnlyList<AssistantSemanticMemoryCandidate> BuildSemanticCorrectionCandidates(int userId)
        {
            return ReadAll()
                .Where(x =>
                    x.UserId == userId
                    && x.Kind != "value_alias"
                    && !string.IsNullOrWhiteSpace(x.RawMessage)
                    && !string.IsNullOrWhiteSpace(x.CorrectedIntent))
                .OrderByDescending(x => x.CreatedAt)
                .Take(100)
                .Select(x => new AssistantSemanticMemoryCandidate(
                    x.UserId,
                    "learned_correction",
                    $"learned:{x.UserId}:{NormalizeKey(x.RawMessage)}:{x.CorrectedIntent}",
                    x.CorrectedIntent!,
                    $"User phrase: {x.RawMessage}. Correct intent: {x.CorrectedIntent}. Correct params: {JsonSerializer.Serialize(x.CorrectedParams, JsonOptions)}"))
                .ToList();
        }

        private static string NormalizeKey(string value)
        {
            var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(normalized.Length);

            foreach (var c in normalized)
            {
                var category = CharUnicodeInfo.GetUnicodeCategory(c);
                if (category == UnicodeCategory.NonSpacingMark)
                {
                    continue;
                }

                if (char.IsLetterOrDigit(c))
                {
                    builder.Append(c == 'đ' ? 'd' : c);
                }
            }

            return builder.ToString().Normalize(NormalizationForm.FormC);
        }

        private static double Similarity(string left, string right)
        {
            if (left.Length == 0 || right.Length == 0)
            {
                return 0;
            }

            var distance = LevenshteinDistance(left, right);
            return 1d - (double)distance / Math.Max(left.Length, right.Length);
        }

        private static int LevenshteinDistance(string left, string right)
        {
            var costs = new int[right.Length + 1];
            for (var j = 0; j <= right.Length; j++)
            {
                costs[j] = j;
            }

            for (var i = 1; i <= left.Length; i++)
            {
                var previousDiagonal = costs[0];
                costs[0] = i;

                for (var j = 1; j <= right.Length; j++)
                {
                    var previousAbove = costs[j];
                    var cost = left[i - 1] == right[j - 1] ? 0 : 1;
                    costs[j] = Math.Min(
                        Math.Min(costs[j] + 1, costs[j - 1] + 1),
                        previousDiagonal + cost);
                    previousDiagonal = previousAbove;
                }
            }

            return costs[right.Length];
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
