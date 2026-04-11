using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class OcrSpaceMeterReadingImageReader : IMeterReadingImageReader
    {
        private const string DefaultEndpoint = "https://api.ocr.space/parse/image";
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<OcrSpaceMeterReadingImageReader> _logger;

        public OcrSpaceMeterReadingImageReader(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<OcrSpaceMeterReadingImageReader> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<MeterReadingImageResultDto> ReadAsync(IFormFile file, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
            {
                throw new InvalidOperationException("Vui long tai len anh cong to hop le.");
            }

            var apiKey = _configuration["OcrSpace:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Chua cau hinh OCR.Space API key.");
            }

            var endpoint = _configuration["OcrSpace:Endpoint"] ?? DefaultEndpoint;
            using var form = new MultipartFormDataContent();

            await using var stream = file.OpenReadStream();
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);
            memory.Position = 0;

            var fileContent = new ByteArrayContent(memory.ToArray());
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(
                string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType);
            form.Add(fileContent, "file", file.FileName);
            form.Add(new StringContent("eng", Encoding.UTF8), "language");
            form.Add(new StringContent("true", Encoding.UTF8), "scale");
            form.Add(new StringContent("true", Encoding.UTF8), "detectOrientation");
            form.Add(new StringContent("2", Encoding.UTF8), "OCREngine");
            form.Add(new StringContent("false", Encoding.UTF8), "isOverlayRequired");

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = form
            };
            request.Headers.Add("apikey", apiKey);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var payloadText = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "OCR.Space request failed with status {StatusCode}. Payload={Payload}",
                    response.StatusCode,
                    payloadText);
                throw new InvalidOperationException($"OCR.Space loi HTTP {(int)response.StatusCode}.");
            }

            var payload = JsonSerializer.Deserialize<OcrSpaceResponse>(payloadText, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (payload == null)
            {
                throw new InvalidOperationException("OCR.Space khong tra ve JSON hop le.");
            }

            if (payload.IsErroredOnProcessing)
            {
                var error = JoinErrors(payload.ErrorMessage, payload.ErrorDetails);
                throw new InvalidOperationException(string.IsNullOrWhiteSpace(error)
                    ? "OCR.Space khong doc duoc chi so tu anh."
                    : error);
            }

            var parsedText = string.Join(" ", payload.ParsedResults?
                .Select(x => x.ParsedText?.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x)) ?? Enumerable.Empty<string>());

            var digits = NormalizeMeterDigits(parsedText);
            if (string.IsNullOrWhiteSpace(digits) || !int.TryParse(digits, out var detectedReading))
            {
                throw new InvalidOperationException("OCR.Space khong trich duoc chi so dien hop le.");
            }

            return new MeterReadingImageResultDto
            {
                DetectedReading = detectedReading,
                RawText = parsedText,
                ProcessingMode = "ocr-space",
                ElapsedMs = null
            };
        }

        private static string NormalizeMeterDigits(string? text)
        {
            text ??= string.Empty;
            var candidates = new List<(string Digits, int Score)>();
            var normalizedText = text
                .Replace("ĐÂY", "DAY", StringComparison.OrdinalIgnoreCase)
                .Replace("DÂY", "DAY", StringComparison.OrdinalIgnoreCase)
                .Replace("ĐIỆN", "DIEN", StringComparison.OrdinalIgnoreCase)
                .Replace("CÔNG TƠ", "CONG TO", StringComparison.OrdinalIgnoreCase);

            var meterWindowMatches = System.Text.RegularExpressions.Regex.Matches(
                normalizedText,
                @"(?:PHA|DAY|DIEN)\s*([0-9\s]{4,20})\s*(?:kWh|KWH)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            foreach (System.Text.RegularExpressions.Match match in meterWindowMatches)
            {
                if (match.Groups.Count < 2)
                {
                    continue;
                }

                var meterDigits = new string(match.Groups[1].Value.Where(char.IsDigit).ToArray());
                if (meterDigits.Length is >= 4 and <= 6)
                {
                    var score = ScoreDigitGroup(meterDigits) + 30;
                    if (meterDigits.StartsWith("0", StringComparison.Ordinal))
                    {
                        score += 12;
                    }
                    candidates.Add((meterDigits, score));
                }
            }

            var lines = text
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();

            for (var index = 0; index < lines.Count; index++)
            {
                var line = lines[index];
                if (LooksLikeMeterLine(line))
                {
                    var compact = new string(line.Where(char.IsDigit).ToArray());
                    if (compact.Length is >= 4 and <= 6)
                    {
                        var score = ScoreDigitGroup(compact);
                        if (line.Contains(' '))
                        {
                            score += 8;
                        }
                        if (index > 0 && LooksLikeMeterContext(lines[index - 1]))
                        {
                            score += 10;
                        }
                        if (index < lines.Count - 1 && LooksLikeMeterContext(lines[index + 1]))
                        {
                            score += 6;
                        }
                        candidates.Add((compact, score));
                    }
                }
            }

            for (var index = 0; index < lines.Count - 1; index++)
            {
                if (!LooksLikeMeterLine(lines[index]) || !LooksLikeMeterLine(lines[index + 1]))
                {
                    continue;
                }

                var combined = new string((lines[index] + lines[index + 1]).Where(char.IsDigit).ToArray());
                if (combined.Length is >= 4 and <= 6)
                {
                    var score = ScoreDigitGroup(combined) + 14;
                    if (LooksLikeMeterContext(index > 0 ? lines[index - 1] : string.Empty))
                    {
                        score += 10;
                    }
                    if (LooksLikeMeterContext(index + 2 < lines.Count ? lines[index + 2] : string.Empty))
                    {
                        score += 8;
                    }
                    candidates.Add((combined, score));
                }
            }

            candidates.AddRange(System.Text.RegularExpressions.Regex.Matches(text, @"\d{4,6}")
                .Select(match => match.Value)
                .Select(group => (group, ScoreDigitGroup(group))));

            string digits;
            if (candidates.Count > 0)
            {
                digits = candidates
                    .OrderByDescending(item => item.Score)
                    .ThenByDescending(item => item.Digits.StartsWith("0", StringComparison.Ordinal))
                    .ThenBy(item => item.Digits.Length == 5 ? 0 : 1)
                    .Select(item => item.Digits)
                    .First();
            }
            else
            {
                digits = new string(text.Where(char.IsDigit).ToArray());
            }

            if (string.IsNullOrWhiteSpace(digits))
            {
                return string.Empty;
            }

            if (digits.Length >= 6 && digits.StartsWith("0", StringComparison.Ordinal))
            {
                digits = digits[..^1];
            }

            if (digits.Length > 5)
            {
                digits = digits[^5..];
            }

            if (digits.Length == 5 && !digits.StartsWith("0", StringComparison.Ordinal) && digits.Length > 4)
            {
                var tail = digits[1..];
                if (tail.Length == 4)
                {
                    digits = tail;
                }
            }

            digits = digits.TrimStart('0');
            return string.IsNullOrWhiteSpace(digits) ? "0" : digits;
        }

        private static int ScoreDigitGroup(string group)
        {
            var score = 0;
            if (group.Length == 5)
            {
                score += 20;
            }
            else if (group.Length == 6)
            {
                score += 14;
            }
            else if (group.Length == 4)
            {
                score += 10;
            }

            if (group.StartsWith("0", StringComparison.Ordinal))
            {
                score += 8;
            }

            if (group.Length >= 5)
            {
                score += 2;
            }

            return score;
        }

        private static bool LooksLikeMeterContext(string? line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                return false;
            }

            var normalized = line.Trim().ToLowerInvariant();
            return normalized.Contains("kwh", StringComparison.Ordinal)
                || normalized.Contains("1/10", StringComparison.Ordinal)
                || normalized.Contains("pha", StringComparison.Ordinal)
                || normalized.Contains("day", StringComparison.Ordinal)
                || normalized.Contains("dây", StringComparison.Ordinal)
                || normalized.Contains("điện", StringComparison.Ordinal)
                || normalized.Contains("dien", StringComparison.Ordinal);
        }

        private static bool LooksLikeMeterLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                return false;
            }

            var trimmed = line.Trim();
            if (trimmed.Length > 12)
            {
                return false;
            }

            var allowed = trimmed.All(ch => char.IsDigit(ch) || char.IsWhiteSpace(ch) || ch is '/' or '.' or '-');
            if (!allowed)
            {
                return false;
            }

            var digitCount = trimmed.Count(char.IsDigit);
            return digitCount is >= 1 and <= 6;
        }

        private static string JoinErrors(IEnumerable<string>? messages, string? details)
        {
            var parts = new List<string>();
            if (messages != null)
            {
                parts.AddRange(messages.Where(x => !string.IsNullOrWhiteSpace(x)));
            }

            if (!string.IsNullOrWhiteSpace(details))
            {
                parts.Add(details);
            }

            return string.Join(" ", parts);
        }

        private sealed class OcrSpaceResponse
        {
            public bool IsErroredOnProcessing { get; set; }
            public string? ErrorDetails { get; set; }
            public List<string>? ErrorMessage { get; set; }
            public List<OcrSpaceParsedResult>? ParsedResults { get; set; }
        }

        private sealed class OcrSpaceParsedResult
        {
            public string? ParsedText { get; set; }
        }
    }
}
