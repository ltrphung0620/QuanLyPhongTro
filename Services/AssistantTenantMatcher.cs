using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using NhaTro.Dtos.Tenants;

namespace NhaTro.Services
{
    public static class AssistantTenantMatcher
    {
        private static readonly Regex LeadingRolePattern = new(
            @"^(?:(?:khach(?:\s+thue)?|nguoi\s+thue|anh|chi|ong|ba|co|chu|em|ban)\s+)+",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public static IReadOnlyList<TenantDto> FindMatches(IEnumerable<TenantDto> tenants, string query)
        {
            var normalizedQuery = NormalizeReference(query);
            if (string.IsNullOrWhiteSpace(normalizedQuery))
            {
                return Array.Empty<TenantDto>();
            }

            var candidates = tenants
                .Select(tenant => new
                {
                    Tenant = tenant,
                    Name = Normalize(tenant.FullName),
                    Phone = NormalizeIdentifier(tenant.Phone),
                    Cccd = NormalizeIdentifier(tenant.CCCD)
                })
                .ToList();

            var identifier = NormalizeIdentifier(query);
            var identifierMatches = candidates
                .Where(x => !string.IsNullOrEmpty(identifier)
                    && (x.Phone == identifier || x.Cccd == identifier))
                .Select(x => x.Tenant)
                .ToList();
            if (identifierMatches.Count > 0)
            {
                return identifierMatches;
            }

            var exactMatches = candidates
                .Where(x => x.Name == normalizedQuery)
                .Select(x => x.Tenant)
                .ToList();
            if (exactMatches.Count > 0)
            {
                return exactMatches;
            }

            var queryTokens = normalizedQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return candidates
                .Where(x => queryTokens.All(token =>
                    x.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Contains(token)))
                .Select(x => x.Tenant)
                .ToList();
        }

        public static string NormalizeReference(string value)
        {
            return LeadingRolePattern.Replace(Normalize(value), string.Empty).Trim();
        }

        public static string CleanReference(string value)
        {
            var cleaned = Regex.Replace(
                value.Trim(),
                @"^(?:(?:khách(?:\s+thuê)?|khach(?:\s+thue)?|người\s+thuê|nguoi\s+thue|anh|chị|chi|ông|ong|bà|ba|cô|co|chú|chu|em|bạn|ban)\s+)+",
                string.Empty,
                RegexOptions.IgnoreCase).Trim();
            return string.IsNullOrWhiteSpace(cleaned) ? value.Trim() : cleaned;
        }

        private static string Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(decomposed.Length);
            foreach (var character in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(character == 'đ' ? 'd' : character);
                }
            }

            return Regex.Replace(builder.ToString().Normalize(NormalizationForm.FormC), @"[^a-z0-9]+", " ").Trim();
        }

        private static string NormalizeIdentifier(string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? string.Empty
                : new string(value.Where(char.IsDigit).ToArray());
        }
    }
}
