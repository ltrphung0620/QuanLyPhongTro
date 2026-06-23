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
            _httpClient.Timeout = TimeSpan.FromSeconds(15);
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

            var model = _configuration["Gemini:Model"] ?? "gemini-3.5-flash";
            var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent";

            byte[] imageBytes;
            using (var ms = new MemoryStream())
            {
                await image.CopyToAsync(ms);
                imageBytes = ms.ToArray();
            }
            var base64Data = Convert.ToBase64String(imageBytes);

            var systemPrompt = @"Bạn đọc chỉ số công tơ điện cơ từ ảnh.

QUY TẮC BẮT BUỘC:

1. Phóng to và chỉ tập trung vào cửa sổ chứa các bánh số công tơ.
2. Đọc riêng từng bánh số từ trái sang phải.
3. Công tơ trong hệ thống thường có:
   - 5 bánh số nguyên nền đen/chữ trắng.
   - Có thể có thêm 1 bánh thập phân ngoài cùng bên phải, thường màu đỏ,
     có khung/màu khác hoặc ký hiệu 1/10.
4. Phải giữ đủ 5 chữ số nguyên, kể cả chữ số 0 ở đầu hoặc cuối.
5. Chỉ loại bánh thập phân có đặc điểm khác với 5 bánh số nguyên.
6. Tuyệt đối không được loại chữ số cuối chỉ vì nó là số 0.
7. Không đọc số serial, tem kiểm định, năm sản xuất, nhãn phòng hoặc
   thông số kỹ thuật.
8. previousReading chỉ dùng để kiểm tra tính hợp lý, không dùng để tự ý
   sửa chữ số trong ảnh.
9. Nếu không nhìn rõ đủ 5 bánh số nguyên, phải yêu cầu xác nhận thủ công,
   không được trả một kết quả có 4 chữ số với độ tin cậy cao.

Ví dụ bắt buộc:
- Năm bánh số nguyên hiển thị 1, 3, 7, 8, 0
  => rawDigits=""13780"", reading=13780.
- Số 0 cuối thuộc nhóm 5 bánh số nguyên nên phải giữ lại.
- Nếu có thêm bánh đỏ sau số 0 thì chỉ loại bánh đỏ đó.
- Không được trả 1378 hoặc 1379.

Chỉ trả JSON:

{
  ""success"": true,
  ""rawDigits"": ""13780"",
  ""reading"": 13780,
  ""integerWheelCount"": 5,
  ""decimalDigitExcluded"": null,
  ""confidence"": 0.95,
  ""requiresManualConfirmation"": false,
  ""reason"": ""Đã đọc đủ 5 bánh số nguyên, bao gồm số 0 cuối""
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
                                text = $"SYSTEM INSTRUCTIONS: {systemPrompt}\n\nUSER REQUEST: Extract the meter reading from this image and return a JSON object exactly matching this schema when successful:\n{{\n  \"success\": true,\n  \"rawDigits\": \"13780\",\n  \"reading\": 13780,\n  \"integerWheelCount\": 5,\n  \"decimalDigitExcluded\": null,\n  \"confidence\": 0.95,\n  \"requiresManualConfirmation\": false,\n  \"reason\": \"Đã đọc đủ 5 bánh số nguyên, bao gồm số 0 cuối\"\n}}\n\nAnd when failed:\n{{\n  \"success\": false,\n  \"rawDigits\": null,\n  \"reading\": null,\n  \"integerWheelCount\": 0,\n  \"decimalDigitExcluded\": null,\n  \"confidence\": 0.0,\n  \"requiresManualConfirmation\": true,\n  \"reason\": \"Lý do lỗi\"\n}}"
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
                int maxRetries = 3;
                int delayMs = 2000;

                for (int attempt = 1; attempt <= maxRetries; attempt++)
                {
                    var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
                    request.Headers.Add("x-goog-api-key", apiKey);
                    request.Content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                    response = await _httpClient.SendAsync(request);

                    if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && attempt < maxRetries)
                    {
                        _logger.LogWarning("Gemini API returned 429 (TooManyRequests). Retrying attempt {Attempt} after {Delay}ms...", attempt, delayMs);
                        response.Dispose();
                        await Task.Delay(delayMs);
                        delayMs *= 2;
                        continue;
                    }

                    break;
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
    }
}
