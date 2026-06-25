using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Services;
using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace NhaTro.Services
{
    public class GeminiMeterReadingOcrService : IGeminiMeterReadingOcrService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeminiMeterReadingOcrService> _logger;

        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
        private const long MaxFileSizeInBytes = 5 * 1024 * 1024; // 5MB

        public GeminiMeterReadingOcrService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GeminiMeterReadingOcrService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _httpClient.Timeout = TimeSpan.FromSeconds(60);
        }

        public async Task<OcrResultDto> ReadMeterImageAsync(IFormFile image, int? previousReading = null)
        {
            if (image == null || image.Length == 0)
            {
                throw new ArgumentException("File ảnh không hợp lệ hoặc bị rỗng.");
            }

            var extension = Path.GetExtension(image.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(extension))
            {
                throw new ArgumentException("Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WEBP.");
            }

            if (image.Length > MaxFileSizeInBytes)
            {
                throw new ArgumentException("Dung lượng ảnh vượt quá giới hạn cho phép (5MB).");
            }

            var apiKey = _configuration["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("Gemini API key is not configured.");
                throw new InvalidOperationException("Chưa cấu hình API Key cho dịch vụ Gemini.");
            }

            var modelCandidates = GetOcrModelCandidates();

            byte[] imageBytes;
            using (var ms = new MemoryStream())
            {
                await image.CopyToAsync(ms);
                imageBytes = ms.ToArray();
            }
            var base64Data = Convert.ToBase64String(imageBytes);

            var systemPrompt = @"You read Vietnamese mechanical electricity meters from photos.

MANDATORY RULES:

1. Focus only on the odometer-style digit window. Ignore room labels, serial numbers,
   inspection stickers, manufacturing years, brand/model text, voltage/current specs,
   and all other printed numbers.
2. Read the wheel digits from left to right.
3. Do not assume every meter has exactly 5 integer wheels. Some meters have:
   - 5 integer wheels and then an optional decimal wheel.
   - 4 integer wheels and then an optional decimal wheel.
   The final answer must include only integer kWh wheels.
4. The decimal wheel is usually the rightmost wheel and may be visually different:
   smaller, red/yellow/tinted, separated by a frame, marked 1/10, or placed after
   the integer scale labels. Exclude that wheel from rawDigits and put it in
   decimalDigitExcluded.
5. If the meter shows integer wheels 7,2,8,3 and the rightmost 3 is the decimal
   wheel, return rawDigits=""7283"", reading=7283, integerWheelCount=4,
   decimalDigitExcluded=""3"". Do not return 72833.
6. If the meter shows integer wheels 1,3,7,8,0 and there is no separate decimal
   wheel after them, return rawDigits=""13780"", reading=13780. Do not drop a final
   zero just because it is the last digit.
7. If there is an extra decimal wheel after 1,3,7,8,0, keep rawDigits=""13780"" and
   put only the extra wheel in decimalDigitExcluded.
8. previousReading is only for plausibility checking. Never modify a visible digit
   just to make it larger than previousReading.
9. If you cannot confidently separate integer wheels from the decimal wheel, return
   requiresManualConfirmation=true and confidence below 0.85 instead of guessing.
10. rawDigits must contain only the integer wheels after excluding the decimal wheel.

Return only JSON:

{
  ""success"": true,
  ""rawDigits"": ""7283"",
  ""reading"": 7283,
  ""integerWheelCount"": 4,
  ""decimalDigitExcluded"": ""3"",
  ""confidence"": 0.95,
  ""requiresManualConfirmation"": false,
  ""reason"": ""Read 4 integer wheels and excluded the rightmost decimal wheel""
}";

            var mimeType = image.ContentType;
            if (string.IsNullOrWhiteSpace(mimeType))
            {
                mimeType = extension == ".png" ? "image/png" : (extension == ".webp" ? "image/webp" : "image/jpeg");
            }

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new
                            {
                                inlineData = new
                                {
                                    mimeType = mimeType,
                                    data = base64Data
                                }
                            },
                            new
                            {
                                text = $"SYSTEM INSTRUCTIONS: {systemPrompt}\n\nUSER REQUEST: Extract the meter reading from this image and return a JSON object exactly matching this schema when successful:\n{{\n  \"success\": true,\n  \"rawDigits\": \"7283\",\n  \"reading\": 7283,\n  \"integerWheelCount\": 4,\n  \"decimalDigitExcluded\": \"3\",\n  \"confidence\": 0.95,\n  \"requiresManualConfirmation\": false,\n  \"reason\": \"Read integer wheels only and excluded the decimal wheel if present\"\n}}\n\nAnd when failed:\n{{\n  \"success\": false,\n  \"rawDigits\": null,\n  \"reading\": null,\n  \"integerWheelCount\": 0,\n  \"decimalDigitExcluded\": null,\n  \"confidence\": 0.0,\n  \"requiresManualConfirmation\": true,\n  \"reason\": \"Lý do lỗi\"\n}}"
                            }
                        }
                    }
                },
                generationConfig = new
                {
                    responseMimeType = "application/json",
                    temperature = 0.0
                }
            };

            var jsonContent = JsonSerializer.Serialize(requestBody);

            try
            {
                HttpResponseMessage response = null!;
                string activeModel = modelCandidates[0];
                var maxRetries = 4;

                foreach (var model in modelCandidates)
                {
                    activeModel = model;
                    var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent";
                    var delayMs = 1500;

                    for (int attempt = 1; attempt <= maxRetries; attempt++)
                    {
                        using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
                        request.Headers.Add("x-goog-api-key", apiKey);
                        request.Content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                        response = await _httpClient.SendAsync(request);

                        if (IsTransientGeminiStatus(response.StatusCode) && attempt < maxRetries)
                        {
                            var retryError = await response.Content.ReadAsStringAsync();
                            _logger.LogWarning(
                                "Gemini OCR API model {Model} returned transient status {StatusCode}. Attempt {Attempt}/{MaxRetries}. Retrying after {Delay}ms. Error: {Error}",
                                model,
                                response.StatusCode,
                                attempt,
                                maxRetries,
                                delayMs,
                                retryError);
                            response.Dispose();
                            await Task.Delay(delayMs);
                            delayMs *= 2;
                            continue;
                        }

                        break;
                    }

                    if (response.IsSuccessStatusCode || !IsTransientGeminiStatus(response.StatusCode))
                    {
                        break;
                    }

                    var finalError = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini OCR API model {Model} failed after retries with transient status {StatusCode}. Trying fallback model if available. Error: {Error}", model, response.StatusCode, finalError);
                }

                using var responseToDispose = response;

                if (!response.IsSuccessStatusCode)
                {
                    var errorResponse = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini API call failed with status code {StatusCode}. Error: {Error}", response.StatusCode, errorResponse);
                    return new OcrResultDto
                    {
                        Success = false,
                        Reason = $"Lỗi kết nối Gemini API (HTTP {response.StatusCode})"
                    };
                }

                var responseText = await response.Content.ReadAsStringAsync();
                
                using var doc = JsonDocument.Parse(responseText);
                var root = doc.RootElement;

                if (root.TryGetProperty("candidates", out var candidates) &&
                    candidates.ValueKind == JsonValueKind.Array &&
                    candidates.GetArrayLength() > 0)
                {
                    var firstCandidate = candidates[0];
                    if (firstCandidate.TryGetProperty("content", out var content) &&
                        content.TryGetProperty("parts", out var parts) &&
                        parts.ValueKind == JsonValueKind.Array &&
                        parts.GetArrayLength() > 0)
                    {
                        var firstPart = parts[0];
                        if (firstPart.TryGetProperty("text", out var text))
                        {
                            var ocrJsonText = text.GetString()?.Trim();
                            if (string.IsNullOrWhiteSpace(ocrJsonText))
                            {
                                return new OcrResultDto { Success = false, Reason = "Kết quả trả về trống" };
                            }

                            var geminiResult = JsonSerializer.Deserialize<OcrResultDto>(ocrJsonText, new JsonSerializerOptions
                            {
                                PropertyNameCaseInsensitive = true
                            });

                            if (geminiResult == null)
                            {
                                return new OcrResultDto { Success = false, Reason = "Không thể parse JSON từ Gemini" };
                            }

                            if (geminiResult.Confidence < 0.85)
                            {
                                geminiResult.RequiresManualConfirmation = true;
                            }

                            if (geminiResult.Success)
                            {
                                if (string.IsNullOrEmpty(geminiResult.RawDigits))
                                {
                                    return new OcrResultDto { Success = false, Reason = "AI không tìm thấy chỉ số điện trên công tơ." };
                                }

                                if (!geminiResult.RawDigits.All(char.IsDigit))
                                {
                                    throw new InvalidOperationException("Chỉ số đọc được chứa ký tự không phải là số.");
                                }

                                NormalizeExcludedDecimalWheel(geminiResult);

                                if (previousReading.HasValue && geminiResult.Reading.HasValue && geminiResult.Reading.Value < previousReading.Value)
                                {
                                    throw new InvalidOperationException($"Chỉ số điện mới đọc được ({geminiResult.Reading.Value}) nhỏ hơn chỉ số cũ ({previousReading.Value}).");
                                }
                            }

                            return geminiResult;
                        }
                    }
                }

                return new OcrResultDto { Success = false, Reason = "Cấu trúc phản hồi Gemini không đúng định dạng" };
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Lỗi phân tích JSON phản hồi từ Gemini.");
                return new OcrResultDto { Success = false, Reason = "JSON phản hồi không hợp lệ" };
            }
            catch (InvalidOperationException)
            {
                throw;
            }
            catch (Exception ex) when (ex is TaskCanceledException || ex is TimeoutException)
            {
                _logger.LogError(ex, "Timeout khi kết nối tới Gemini API.");
                return new OcrResultDto { Success = false, Reason = "Yêu cầu kết nối Gemini bị quá thời gian (timeout)" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi không xác định khi gọi Gemini OCR.");
                return new OcrResultDto { Success = false, Reason = $"Lỗi không xác định: {ex.Message}" };
            }
        }

        private static void NormalizeExcludedDecimalWheel(OcrResultDto result)
        {
            if (!result.Success
                || string.IsNullOrWhiteSpace(result.RawDigits)
                || string.IsNullOrWhiteSpace(result.DecimalDigitExcluded))
            {
                return;
            }

            var rawDigits = new string(result.RawDigits.Where(char.IsDigit).ToArray());
            var decimalDigits = new string(result.DecimalDigitExcluded.Where(char.IsDigit).ToArray());
            if (rawDigits.Length == 0 || decimalDigits.Length == 0)
            {
                return;
            }

            if (!rawDigits.EndsWith(decimalDigits, StringComparison.Ordinal)
                || rawDigits.Length <= decimalDigits.Length)
            {
                return;
            }

            var integerDigits = rawDigits[..^decimalDigits.Length];
            if (integerDigits.Length == 0 || !int.TryParse(integerDigits, out var normalizedReading))
            {
                return;
            }

            result.RawDigits = integerDigits;
            result.Reading = normalizedReading;
            result.IntegerWheelCount = integerDigits.Length;

            const string note = "Da loai banh so thap phan khoi gia tri luu.";
            result.Reason = string.IsNullOrWhiteSpace(result.Reason)
                ? note
                : $"{result.Reason} {note}";
        }

        private string[] GetOcrModelCandidates()
        {
            var primary = _configuration["Gemini:OcrModel"] ?? _configuration["Gemini:Model"] ?? "gemini-3.5-flash";
            var configuredFallbacks = (_configuration["Gemini:OcrFallbackModels"] ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return new[] { primary }
                .Concat(configuredFallbacks)
                .Where(model => !string.IsNullOrWhiteSpace(model))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private static bool IsTransientGeminiStatus(System.Net.HttpStatusCode statusCode)
        {
            return statusCode == System.Net.HttpStatusCode.TooManyRequests
                || statusCode == System.Net.HttpStatusCode.RequestTimeout
                || statusCode == System.Net.HttpStatusCode.InternalServerError
                || statusCode == System.Net.HttpStatusCode.BadGateway
                || statusCode == System.Net.HttpStatusCode.ServiceUnavailable
                || statusCode == System.Net.HttpStatusCode.GatewayTimeout;
        }
    }
}
