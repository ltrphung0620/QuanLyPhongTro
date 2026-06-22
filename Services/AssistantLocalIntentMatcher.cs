using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace NhaTro.Services
{
    public class AssistantLocalIntentMatcher
    {
        private const double MinimumScore = 0.66;
        private const double MinimumMargin = 0.05;
        private readonly IReadOnlyList<TrainingPhrase> _phrases;

        public AssistantLocalIntentMatcher(
            AssistantActionRegistry actionRegistry,
            AssistantTrainingPhraseCatalog phraseCatalog)
        {
            _phrases = actionRegistry.Actions
                .Where(x => x.CanExecute)
                .SelectMany(action => phraseCatalog
                    .GetPhrases(action.Intent, action.Examples)
                    .Select(phrase => new TrainingPhrase(action.Intent, Prepare(phrase))))
                .ToList();
        }

        public bool TryMatch(string message, out string intent, out double confidence)
        {
            intent = AssistantActionRegistry.AssistantUnknown;
            confidence = 0;
            var query = Prepare(message);
            if (query.Tokens.Count == 0)
            {
                return false;
            }

            var ranked = _phrases
                .Select(x => new { x.Intent, Score = Similarity(query, x.Prepared) })
                .GroupBy(x => x.Intent, StringComparer.OrdinalIgnoreCase)
                .Select(group => new { Intent = group.Key, Score = group.Max(x => x.Score) })
                .OrderByDescending(x => x.Score)
                .Take(2)
                .ToList();
            if (ranked.Count == 0)
            {
                return false;
            }

            var best = ranked[0];
            var secondScore = ranked.Count > 1 ? ranked[1].Score : 0;
            if (best.Score < MinimumScore || best.Score - secondScore < MinimumMargin)
            {
                return false;
            }

            intent = best.Intent;
            confidence = Math.Min(0.89, best.Score);
            return true;
        }

        private static double Similarity(PreparedText left, PreparedText right)
        {
            var tokenScore = Dice(left.Tokens, right.Tokens);
            var trigramScore = Dice(left.Trigrams, right.Trigrams);
            return tokenScore * 0.7 + trigramScore * 0.3;
        }

        private static double Dice(IReadOnlySet<string> left, IReadOnlySet<string> right)
        {
            if (left.Count == 0 || right.Count == 0)
            {
                return 0;
            }

            var overlap = left.Count <= right.Count
                ? left.Count(right.Contains)
                : right.Count(left.Contains);
            return 2d * overlap / (left.Count + right.Count);
        }

        private static PreparedText Prepare(string value)
        {
            var normalized = Normalize(value);
            var tokens = Regex.Matches(normalized, @"[a-z0-9]+")
                .Select(x => x.Value)
                .Where(x => x.Length > 1)
                .ToHashSet(StringComparer.Ordinal);
            var compact = Regex.Replace(normalized, @"\s+", " ").Trim();
            var trigrams = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i <= compact.Length - 3; i++)
            {
                trigrams.Add(compact.Substring(i, 3));
            }

            return new PreparedText(tokens, trigrams);
        }

        private static string Normalize(string value)
        {
            var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(decomposed.Length);
            foreach (var character in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(character == 'đ' ? 'd' : character);
                }
            }

            return builder.ToString().Normalize(NormalizationForm.FormC);
        }

        private record TrainingPhrase(string Intent, PreparedText Prepared);
        private record PreparedText(IReadOnlySet<string> Tokens, IReadOnlySet<string> Trigrams);
    }
}
