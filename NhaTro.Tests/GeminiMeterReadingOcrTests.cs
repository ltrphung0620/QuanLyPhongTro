using Xunit;
using Moq;
using Moq.Protected;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using System;
using System.IO;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NhaTro.Services;
using NhaTro.Dtos.MeterReadings;

namespace NhaTro.Tests
{
    public class GeminiMeterReadingOcrTests
    {
        private Mock<IConfiguration> CreateMockConfig(string apiKey = "fake-api-key", string model = "gemini-3.5-flash")
        {
            var mockConfig = new Mock<IConfiguration>();
            mockConfig.Setup(c => c["Gemini:ApiKey"]).Returns(apiKey);
            mockConfig.Setup(c => c["Gemini:Model"]).Returns(model);
            return mockConfig;
        }

        private Mock<ILogger<GeminiMeterReadingOcrService>> CreateMockLogger()
        {
            return new Mock<ILogger<GeminiMeterReadingOcrService>>();
        }

        private IFormFile CreateMockFile(string fileName, long length, byte[]? content = null)
        {
            var fileMock = new Mock<IFormFile>();
            var ms = new MemoryStream(content ?? new byte[length]);
            fileMock.Setup(f => f.FileName).Returns(fileName);
            fileMock.Setup(f => f.Length).Returns(length);
            fileMock.Setup(f => f.OpenReadStream()).Returns(ms);
            fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Callback<Stream, CancellationToken>((stream, token) =>
                {
                    ms.Position = 0;
                    ms.CopyTo(stream);
                })
                .Returns(Task.CompletedTask);
            return fileMock.Object;
        }

        private HttpClient CreateMockHttpClient(HttpResponseMessage responseMessage)
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
               .Protected()
               .Setup<Task<HttpResponseMessage>>(
                  "SendAsync",
                  ItExpr.IsAny<HttpRequestMessage>(),
                  ItExpr.IsAny<CancellationToken>()
               )
               .ReturnsAsync(responseMessage)
               .Verifiable();

            return new HttpClient(handlerMock.Object);
        }

        private HttpClient CreateTimeoutHttpClient()
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
               .Protected()
               .Setup<Task<HttpResponseMessage>>(
                  "SendAsync",
                  ItExpr.IsAny<HttpRequestMessage>(),
                  ItExpr.IsAny<CancellationToken>()
               )
               .ThrowsAsync(new TaskCanceledException("HttpClient request timed out"))
               .Verifiable();

            return new HttpClient(handlerMock.Object);
        }

        private string CreateGeminiResponseJson(
            bool success, 
            string? rawDigits, 
            int? reading, 
            int integerWheelCount,
            string? decimalDigitExcluded, 
            double confidence, 
            bool requiresManualConfirmation,
            string? reason)
        {
            var geminiResponseObj = new
            {
                candidates = new[]
                {
                    new
                    {
                        content = new
                        {
                            parts = new[]
                            {
                                new
                                {
                                    text = JsonSerializer.Serialize(new
                                    {
                                        success,
                                        rawDigits,
                                        reading,
                                        integerWheelCount,
                                        decimalDigitExcluded,
                                        confidence,
                                        requiresManualConfirmation,
                                        reason
                                    })
                                }
                            }
                        }
                    }
                }
            };
            return JsonSerializer.Serialize(geminiResponseObj);
        }

        [Fact]
        public async Task ReadMeterImageAsync_ValidSampleImage_ReturnsCorrectOcrResult()
        {
            var responseJson = CreateGeminiResponseJson(true, "07009", 7009, 5, "6", 0.98, false, "Đã đọc đủ 5 bánh số nguyên, bao gồm số 0 cuối");
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);

            var result = await service.ReadMeterImageAsync(file);

            Assert.True(result.Success);
            Assert.Equal("07009", result.RawDigits);
            Assert.Equal(7009, result.Reading);
            Assert.Equal(5, result.IntegerWheelCount);
            Assert.Equal("6", result.DecimalDigitExcluded);
            Assert.Equal(0.98, result.Confidence);
            Assert.False(result.RequiresManualConfirmation);
            Assert.Equal("Đã đọc đủ 5 bánh số nguyên, bao gồm số 0 cuối", result.Reason);
        }

        [Fact]
        public async Task ReadMeterImageAsync_ExcludeRedDigit_ExcludesRedDigitFromReading()
        {
            var responseJson = CreateGeminiResponseJson(true, "07009", 7009, 5, "6", 0.98, false, "OK");
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.png", 2048);

            var result = await service.ReadMeterImageAsync(file);

            Assert.True(result.Success);
            Assert.Equal("07009", result.RawDigits);
            Assert.Equal(7009, result.Reading);
            Assert.Equal("6", result.DecimalDigitExcluded);
        }

        [Fact]
        public async Task ReadMeterImageAsync_DoesNotCaptureSerialNumbers_ReturnsValidResult()
        {
            var responseJson = CreateGeminiResponseJson(true, "07009", 7009, 5, "6", 0.95, false, "OK");
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.webp", 3072);

            var result = await service.ReadMeterImageAsync(file);

            Assert.True(result.Success);
            Assert.Equal("07009", result.RawDigits);
            Assert.Equal(7009, result.Reading);
            Assert.DoesNotContain("17052017", result.RawDigits);
            Assert.DoesNotContain("16031209", result.RawDigits);
        }

        [Fact]
        public async Task ReadMeterImageAsync_WhenDecimalDigitStillIncluded_NormalizesReading()
        {
            var responseJson = CreateGeminiResponseJson(true, "72833", 72833, 5, "3", 0.95, false, "Decimal wheel excluded");
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);

            var result = await service.ReadMeterImageAsync(file);

            Assert.True(result.Success);
            Assert.Equal("7283", result.RawDigits);
            Assert.Equal(7283, result.Reading);
            Assert.Equal(4, result.IntegerWheelCount);
            Assert.Equal("3", result.DecimalDigitExcluded);
        }

        [Fact]
        public async Task ReadMeterImageAsync_ConfidenceLow_ForcesManualConfirmation()
        {
            var responseJson = CreateGeminiResponseJson(true, "07009", 7009, 5, "6", 0.65, false, "OK");
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);

            var result = await service.ReadMeterImageAsync(file);

            Assert.True(result.Success);
            Assert.Equal(0.65, result.Confidence);
            Assert.True(result.RequiresManualConfirmation);
        }

        [Fact]
        public async Task ReadMeterImageAsync_ReadingLessThanPrevious_ThrowsInvalidOperationException()
        {
            var responseJson = CreateGeminiResponseJson(true, "07009", 7009, 5, "6", 0.98, false, "OK");
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseJson)
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ReadMeterImageAsync(file, previousReading: 8000)
            );
            Assert.Contains("nhỏ hơn chỉ số cũ", ex.Message);
        }

        [Fact]
        public async Task ReadMeterImageAsync_GeminiReturnsInvalidJson_ReturnsErrorResult()
        {
            var invalidJsonResponse = new
            {
                candidates = new[]
                {
                    new
                    {
                        content = new
                        {
                            parts = new[]
                            {
                                new
                                {
                                    text = "This is not valid JSON"
                                }
                            }
                        }
                    }
                }
            };
            var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(invalidJsonResponse))
            };

            var service = new GeminiMeterReadingOcrService(
                CreateMockHttpClient(httpResponse),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);

            var result = await service.ReadMeterImageAsync(file);

            Assert.False(result.Success);
            Assert.NotNull(result.Reason);
            Assert.Contains("JSON phản hồi không hợp lệ", result.Reason);
        }

        [Fact]
        public async Task ReadMeterImageAsync_TimeoutOccurs_ReturnsTimeoutErrorResult()
        {
            var service = new GeminiMeterReadingOcrService(
                CreateTimeoutHttpClient(),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);

            var result = await service.ReadMeterImageAsync(file);

            Assert.False(result.Success);
            Assert.NotNull(result.Reason);
            Assert.Contains("timeout", result.Reason.ToLower());
        }

        [Fact]
        public async Task ReadMeterImageAsync_InvalidFileExtension_ThrowsArgumentException()
        {
            var service = new GeminiMeterReadingOcrService(
                new HttpClient(),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.pdf", 1024);

            var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
                service.ReadMeterImageAsync(file)
            );
            Assert.Contains("Chỉ chấp nhận file ảnh định dạng", ex.Message);
        }

        [Fact]
        public async Task ReadMeterImageAsync_FileSizeTooLarge_ThrowsArgumentException()
        {
            var service = new GeminiMeterReadingOcrService(
                new HttpClient(),
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("large.jpg", 6 * 1024 * 1024); // 6MB

            var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
                service.ReadMeterImageAsync(file)
            );
            Assert.Contains("Dung lượng ảnh vượt quá giới hạn", ex.Message);
        }

        [Fact]
        public async Task ReadMeterImageAsync_TooManyRequests_RetriesAndSucceeds()
        {
            var responseJson = CreateGeminiResponseJson(true, "07009", 7009, 5, "6", 0.98, false, "OK");
            
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
               .Protected()
               .SetupSequence<Task<HttpResponseMessage>>(
                  "SendAsync",
                  ItExpr.IsAny<HttpRequestMessage>(),
                  ItExpr.IsAny<CancellationToken>()
               )
               .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.TooManyRequests))
               .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(responseJson) });

            var client = new HttpClient(handlerMock.Object);
            var service = new GeminiMeterReadingOcrService(
                client,
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);
            var result = await service.ReadMeterImageAsync(file);

            Assert.True(result.Success);
            Assert.Equal("07009", result.RawDigits);
            Assert.Equal(7009, result.Reading);
        }

        [Fact]
        public async Task ReadMeterImageAsync_TooManyRequestsExceeded_ReturnsErrorResult()
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            handlerMock
               .Protected()
               .Setup<Task<HttpResponseMessage>>(
                  "SendAsync",
                  ItExpr.IsAny<HttpRequestMessage>(),
                  ItExpr.IsAny<CancellationToken>()
               )
               .ReturnsAsync(() => new HttpResponseMessage(HttpStatusCode.TooManyRequests));

            var client = new HttpClient(handlerMock.Object);
            var service = new GeminiMeterReadingOcrService(
                client,
                CreateMockConfig().Object,
                CreateMockLogger().Object
            );

            var file = CreateMockFile("meter.jpg", 1024);
            var result = await service.ReadMeterImageAsync(file);

            Assert.False(result.Success);
            Assert.Contains("TooManyRequests", result.Reason);
        }
    }
}
