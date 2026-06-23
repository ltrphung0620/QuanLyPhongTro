using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using System.Net.Http;
using System.Text.Json;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace NhaTro.Services
{
    public class MeterReadingService : IMeterReadingService
    {
        private readonly IMeterReadingRepository _meterRepo;
        private readonly IContractRepository _contractRepo;
        private readonly IRoomRepository _roomRepo;
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IWebHostEnvironment _environment;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MeterReadingService> _logger;
        private readonly IPricingSettingsService _pricingSettingsService;

        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        };

        public MeterReadingService(
            IMeterReadingRepository meterRepo,
            IContractRepository contractRepo,
            IRoomRepository roomRepo,
            IInvoiceRepository invoiceRepo,
            IWebHostEnvironment environment,
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MeterReadingService> logger,
            IPricingSettingsService pricingSettingsService)
        {
            _meterRepo = meterRepo;
            _contractRepo = contractRepo;
            _roomRepo = roomRepo;
            _invoiceRepo = invoiceRepo;
            _environment = environment;
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _pricingSettingsService = pricingSettingsService;
        }

        public async Task<List<MeterReadingDto>> GetAllAsync(int? roomId = null, DateOnly? month = null)
        {
            var data = await _meterRepo.GetAllAsync(roomId, month);
            return data.Select(MapToDto).ToList();
        }

        public async Task<MeterReadingDto> CreateAsync(CreateMeterReadingDto dto)
        {
            var contract = await _contractRepo.GetActiveByRoomIdAsync(dto.RoomId);
            if (contract == null)
            {
                throw new InvalidOperationException("Hợp đồng không hợp lệ.");
            }

            if (dto.ContractId != contract.ContractId)
            {
                throw new InvalidOperationException("Lỗi.");
            }

            var normalizedBillingMonth = NormalizeMonth(dto.BillingMonth);
            EnsureContractCoversMonth(contract, normalizedBillingMonth);
            var existing = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, normalizedBillingMonth);
            if (existing != null)
            {
                throw new InvalidOperationException("Đã nhập điện cho tháng này.");
            }

            var last = await _meterRepo.GetLatestBeforeDateAsync(
                dto.RoomId,
                ResolveMonthlyReadingDate(normalizedBillingMonth));
            var previous = last?.CurrentReading ?? 0;

            if (dto.CurrentReading < previous)
            {
                throw new InvalidOperationException("Số điện mới không hợp lệ.");
            }

            var consumed = dto.CurrentReading - previous;
            var electricPrice = (await _pricingSettingsService.GetAsync()).ElectricityUnitPrice;
            var amount = consumed * electricPrice;

            var meter = new MeterReading
            {
                RoomId = contract.RoomId,
                ContractId = contract.ContractId,
                BillingMonth = ResolveMonthlyReadingDate(normalizedBillingMonth),
                PreviousReading = previous,
                CurrentReading = dto.CurrentReading,
                ConsumedUnits = consumed,
                UnitPrice = electricPrice,
                Amount = amount,
                CreatedAt = DateTime.UtcNow,
                Room = contract.Room
            };

            await _meterRepo.AddAsync(meter);
            await _meterRepo.SaveChangesAsync();

            return MapToDto(meter);
        }

        public async Task<MeterReadingDto?> UploadImageAsync(int meterReadingId, IFormFile image)
        {
            var meter = await _meterRepo.GetByIdAsync(meterReadingId);
            if (meter == null)
            {
                return null;
            }

            if (image == null || image.Length == 0)
            {
                throw new ArgumentException("Vui lòng chọn ảnh công tơ điện.");
            }

            var extension = Path.GetExtension(image.FileName);
            if (string.IsNullOrWhiteSpace(extension) || !AllowedImageExtensions.Contains(extension))
            {
                throw new ArgumentException("Ảnh công tơ chỉ hỗ trợ JPG, PNG hoặc WEBP.");
            }

            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            var uploadDirectory = Path.Combine(webRootPath, "uploads", "meter-readings");
            Directory.CreateDirectory(uploadDirectory);

            DeleteMeterImageIfExists(meter.MeterImagePath);

            var fileName = $"{meter.MeterReadingId}-{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
            var filePath = Path.Combine(uploadDirectory, fileName);
            await using (var stream = File.Create(filePath))
            {
                await image.CopyToAsync(stream);
            }

            meter.MeterImagePath = $"uploads/meter-readings/{fileName}";
            await _meterRepo.SaveChangesAsync();

            return MapToDto(meter);
        }

        public async Task<MeterReadingPreviewDto> PreviewAsync(CreateMeterReadingDto dto)
        {
            var contract = await _contractRepo.GetActiveByRoomIdAsync(dto.RoomId);
            if (contract == null)
            {
                throw new InvalidOperationException("Hợp đồng không hợp lệ.");
            }

            if (dto.ContractId != contract.ContractId)
            {
                throw new InvalidOperationException("Hợp đồng ghi chỉ số không còn hiệu lực.");
            }

            var normalizedBillingMonth = NormalizeMonth(dto.BillingMonth);
            EnsureContractCoversMonth(contract, normalizedBillingMonth);
            var existing = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, normalizedBillingMonth);
            if (existing != null)
            {
                throw new InvalidOperationException("Đã có dữ liệu tháng này.");
            }

            var last = await _meterRepo.GetLatestBeforeDateAsync(
                dto.RoomId,
                ResolveMonthlyReadingDate(normalizedBillingMonth));
            var previous = last?.CurrentReading ?? 0;

            if (dto.CurrentReading < previous)
            {
                throw new InvalidOperationException("Số điện không hợp lệ.");
            }

            var consumed = dto.CurrentReading - previous;
            var electricPrice = (await _pricingSettingsService.GetAsync()).ElectricityUnitPrice;
            var amount = consumed * electricPrice;

            return new MeterReadingPreviewDto
            {
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                ContractId = contract.ContractId,
                BillingMonth = normalizedBillingMonth,
                PreviousReading = previous,
                CurrentReading = dto.CurrentReading,
                ConsumedUnits = consumed,
                UnitPrice = electricPrice,
                Amount = amount
            };
        }

        public async Task<List<MeterReadingDto>> UpdateOriginalReadingAsync(UpdateOriginalMeterReadingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.RoomCode))
                throw new ArgumentException("RoomCode không hợp lệ.");

            var room = await _roomRepo.GetByRoomCodeAsync(dto.RoomCode);
            if (room == null)
                throw new InvalidOperationException("Không tìm thấy phòng theo roomCode.");

            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var readings = await _meterRepo.GetByRoomFromMonthAsync(room.RoomId, billingMonth);
            if (!readings.Any())
                throw new InvalidOperationException("Không tìm thấy chỉ số điện từ tháng cần sửa.");

            var monthReadings = readings
                .Where(x => SameMonth(x.BillingMonth, billingMonth))
                .OrderBy(x => x.BillingMonth)
                .ToList();

            var target = dto.MeterReadingId.HasValue
                ? monthReadings.FirstOrDefault(x => x.MeterReadingId == dto.MeterReadingId.Value)
                : monthReadings.OrderByDescending(x => x.BillingMonth).FirstOrDefault();
            if (target == null)
                throw new InvalidOperationException("Không tìm thấy chỉ số điện của tháng cần sửa.");

            var previousReading = await _meterRepo.GetLatestBeforeDateAsync(room.RoomId, target.BillingMonth);
            var runningPrevious = previousReading?.CurrentReading ?? 0;
            var electricPrice = (await _pricingSettingsService.GetAsync()).ElectricityUnitPrice;

            foreach (var reading in readings)
            {
                var desiredCurrentReading = reading.MeterReadingId == target.MeterReadingId
                    ? dto.CurrentReading
                    : reading.CurrentReading;

                if (desiredCurrentReading < runningPrevious)
                {
                    throw new InvalidOperationException(
                        $"Số điện tháng {reading.BillingMonth:yyyy-MM} không hợp lệ vì nhỏ hơn chỉ số tháng trước.");
                }

                reading.PreviousReading = runningPrevious;
                reading.CurrentReading = desiredCurrentReading;
                reading.ConsumedUnits = desiredCurrentReading - runningPrevious;
                reading.UnitPrice = electricPrice;
                reading.Amount = reading.ConsumedUnits * reading.UnitPrice;

                runningPrevious = desiredCurrentReading;
            }

            _meterRepo.UpdateRange(readings);
            await _meterRepo.SaveChangesAsync();

            if (target.ContractId.HasValue)
            {
                await SyncInvoiceElectricityAsync(target.ContractId.Value, billingMonth, target.Amount);
            }

            return readings.Select(MapToDto).ToList();
        }

        public async Task<DeleteMeterReadingsByEndedContractDto?> DeleteByEndedContractAsync(int contractId)
        {
            var contract = await _contractRepo.GetByIdAsync(contractId);
            if (contract == null)
            {
                return null;
            }

            if (!HasStatus(contract, "ended"))
            {
                throw new InvalidOperationException("Chỉ được xóa chỉ số điện của hợp đồng đã chấm dứt.");
            }

            var meterReadings = await _meterRepo.GetByContractIdAsync(contractId);
            var deletedCount = meterReadings.Count;

            if (deletedCount > 0)
            {
                _meterRepo.DeleteRange(meterReadings);
                await _meterRepo.SaveChangesAsync();
            }

            return new DeleteMeterReadingsByEndedContractDto
            {
                ContractId = contract.ContractId,
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                DeletedCount = deletedCount
            };
        }

        public async Task<bool> DeleteAsync(int meterReadingId)
        {
            var target = await _meterRepo.GetByIdAsync(meterReadingId);
            if (target == null)
            {
                return false;
            }

            var month = NormalizeMonth(target.BillingMonth);
            var readings = await _meterRepo.GetByRoomFromMonthAsync(target.RoomId, month);
            var remainingReadings = readings
                .Where(x => x.MeterReadingId != meterReadingId)
                .OrderBy(x => x.BillingMonth)
                .ToList();

            var previousReading = await _meterRepo.GetLatestBeforeDateAsync(target.RoomId, target.BillingMonth);
            var runningPrevious = previousReading?.CurrentReading ?? 0;
            var changedReadings = new List<MeterReading>();

            foreach (var reading in remainingReadings)
            {
                if (reading.CurrentReading < runningPrevious)
                {
                    throw new InvalidOperationException(
                        $"Không thể xóa vì sẽ làm mốc {reading.BillingMonth:dd/MM/yyyy} nhỏ hơn chỉ số trước đó.");
                }

                if (reading.PreviousReading != runningPrevious || reading.ConsumedUnits != reading.CurrentReading - runningPrevious)
                {
                    reading.PreviousReading = runningPrevious;
                    reading.ConsumedUnits = reading.CurrentReading - runningPrevious;
                    reading.UnitPrice = reading.UnitPrice > 0
                        ? reading.UnitPrice
                        : (await _pricingSettingsService.GetAsync()).ElectricityUnitPrice;
                    reading.Amount = reading.ConsumedUnits * reading.UnitPrice;
                    changedReadings.Add(reading);
                }

                runningPrevious = reading.CurrentReading;
            }

            if (changedReadings.Count > 0)
            {
                _meterRepo.UpdateRange(changedReadings);
            }

            _meterRepo.Delete(target);
            await _meterRepo.SaveChangesAsync();
            DeleteMeterImageIfExists(target.MeterImagePath);

            if (target.ContractId.HasValue)
            {
                await SyncInvoiceElectricityAsync(target.ContractId.Value, month, 0);
            }

            foreach (var reading in changedReadings)
            {
                if (reading.ContractId.HasValue)
                {
                    await SyncInvoiceElectricityAsync(reading.ContractId.Value, NormalizeMonth(reading.BillingMonth), reading.Amount);
                }
            }

            return true;
        }

        public async Task<List<MissingMeterDto>> GetMissingAsync(DateOnly month)
        {
            var activeContracts = await _contractRepo.GetAllAsync("active", null);
            var readings = await _meterRepo.GetAllAsync(null, month);

            var contractIdsWithReading = readings
                .Where(r => r.ContractId.HasValue)
                .Select(r => r.ContractId!.Value)
                .ToHashSet();

            var missingContracts = activeContracts
                .Where(c => ContractCoversMonth(c, NormalizeMonth(month)))
                .Where(c => !contractIdsWithReading.Contains(c.ContractId))
                .ToList();

            var results = new List<MissingMeterDto>();
            foreach (var c in missingContracts)
            {
                var last = await _meterRepo.GetLatestBeforeDateAsync(
                    c.RoomId,
                    ResolveMonthlyReadingDate(NormalizeMonth(month)));
                results.Add(new MissingMeterDto
                {
                    RoomId = c.RoomId,
                    RoomCode = c.Room?.RoomCode ?? string.Empty,
                    ContractId = c.ContractId,
                    PreviousReading = last?.CurrentReading ?? 0
                });
            }

            return results;
        }

        private static DateOnly NormalizeMonth(DateOnly value)
        {
            return new DateOnly(value.Year, value.Month, 1);
        }

        private static DateOnly ResolveMonthlyReadingDate(DateOnly billingMonth)
        {
            return new DateOnly(billingMonth.Year, billingMonth.Month, 1)
                .AddMonths(1)
                .AddDays(-1);
        }

        private static bool SameMonth(DateOnly left, DateOnly right)
        {
            return left.Year == right.Year && left.Month == right.Month;
        }

        private static bool ContractCoversMonth(Contract contract, DateOnly billingMonth)
        {
            var monthStart = NormalizeMonth(billingMonth);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            return contract.StartDate <= monthEnd
                && (!contract.ActualEndDate.HasValue || contract.ActualEndDate.Value >= monthStart);
        }

        private static void EnsureContractCoversMonth(Contract contract, DateOnly billingMonth)
        {
            if (!ContractCoversMonth(contract, billingMonth))
            {
                throw new InvalidOperationException(
                    $"Hợp đồng không có hiệu lực trong tháng {billingMonth:MM/yyyy}.");
            }
        }

        private async Task SyncInvoiceElectricityAsync(int contractId, DateOnly billingMonth, decimal electricityAmount)
        {
            var invoice = await _invoiceRepo.GetByContractAndMonthAsync(contractId, billingMonth);
            if (invoice == null)
                return;

            invoice.ElectricityFee = electricityAmount;
            invoice.TotalAmount = invoice.RoomFee
                + invoice.ElectricityFee
                + invoice.WaterFee
                + invoice.TrashFee
                + invoice.ExtraFee
                + invoice.DebtAmount
                + invoice.DepositDebtAmount
                - invoice.DiscountAmount;

            if (invoice.TotalAmount < 0)
                invoice.TotalAmount = 0;

            invoice.UpdatedAt = DateTime.UtcNow;
            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();
        }

        private static bool HasStatus(Contract contract, string expectedStatus)
        {
            return string.Equals(contract.Status?.Trim(), expectedStatus, StringComparison.OrdinalIgnoreCase);
        }

        private static MeterReadingDto MapToDto(MeterReading m)
        {
            return new MeterReadingDto
            {
                MeterReadingId = m.MeterReadingId,
                RoomId = m.RoomId,
                RoomCode = m.Room?.RoomCode ?? m.Contract?.Room?.RoomCode ?? string.Empty,
                ContractId = m.ContractId,
                BillingMonth = m.BillingMonth,
                PreviousReading = m.PreviousReading,
                CurrentReading = m.CurrentReading,
                ConsumedUnits = m.ConsumedUnits,
                UnitPrice = m.UnitPrice,
                Amount = m.Amount,
                MeterImagePath = m.MeterImagePath,
                CreatedAt = m.CreatedAt
            };
        }

        private void DeleteMeterImageIfExists(string? relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
            {
                return;
            }

            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            var fullPath = Path.GetFullPath(Path.Combine(webRootPath, relativePath.Replace('/', Path.DirectorySeparatorChar)));
            var uploadsRoot = Path.GetFullPath(Path.Combine(webRootPath, "uploads", "meter-readings"));
            var uploadsRootWithSeparator = uploadsRoot.EndsWith(Path.DirectorySeparatorChar)
                ? uploadsRoot
                : uploadsRoot + Path.DirectorySeparatorChar;

            if (!fullPath.StartsWith(uploadsRootWithSeparator, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
            {
                return;
            }

            File.Delete(fullPath);
        }

        public async Task<List<MeterReadingDto>> CreateBulkAsync(CreateMeterReadingBulkDto dto)
        {
            if (dto.Readings == null || !dto.Readings.Any())
            {
                return new List<MeterReadingDto>();
            }

            var normalizedBillingMonth = NormalizeMonth(dto.BillingMonth);
            var results = new List<MeterReading>();

            foreach (var item in dto.Readings)
            {
                var contract = await _contractRepo.GetActiveByRoomIdAsync(item.RoomId);
                if (contract == null)
                {
                    throw new InvalidOperationException($"Hợp đồng không hợp lệ cho phòng ID {item.RoomId}.");
                }

                if (item.ContractId != contract.ContractId)
                {
                    throw new InvalidOperationException($"Lỗi hợp đồng không khớp cho phòng {contract.Room?.RoomCode ?? item.RoomId.ToString()}.");
                }

                EnsureContractCoversMonth(contract, normalizedBillingMonth);

                var existing = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, normalizedBillingMonth);
                if (existing != null)
                {
                    throw new InvalidOperationException($"Phòng {contract.Room?.RoomCode ?? item.RoomId.ToString()} đã có chỉ số điện cho tháng này.");
                }

                var last = await _meterRepo.GetLatestBeforeDateAsync(
                    item.RoomId,
                    ResolveMonthlyReadingDate(normalizedBillingMonth));
                var previous = last?.CurrentReading ?? 0;

                if (item.CurrentReading < previous)
                {
                    throw new InvalidOperationException($"Số điện mới cho phòng {contract.Room?.RoomCode ?? item.RoomId.ToString()} không hợp lệ (phải >= {previous}).");
                }

                var consumed = item.CurrentReading - previous;
                var electricPrice = (await _pricingSettingsService.GetAsync()).ElectricityUnitPrice;
                var amount = consumed * electricPrice;

                var meter = new MeterReading
                {
                    RoomId = contract.RoomId,
                    ContractId = contract.ContractId,
                    BillingMonth = ResolveMonthlyReadingDate(normalizedBillingMonth),
                    PreviousReading = previous,
                    CurrentReading = item.CurrentReading,
                    ConsumedUnits = consumed,
                    UnitPrice = electricPrice,
                    Amount = amount,
                    CreatedAt = DateTime.UtcNow,
                    Room = contract.Room
                };

                await _meterRepo.AddAsync(meter);
                results.Add(meter);
            }

            await _meterRepo.SaveChangesAsync();

            return results.Select(MapToDto).ToList();
        }

        public async Task<int?> ScanMeterImageAsync(IFormFile image)
        {
            var apiKey = _configuration["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("Gemini API key is not configured.");
                return null;
            }

            try
            {
                var model = _configuration["Gemini:Model"] ?? "gemini-1.5-flash";
                var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent";
                
                using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
                request.Headers.Add("x-goog-api-key", apiKey);

                using var ms = new MemoryStream();
                await image.CopyToAsync(ms);
                var imageBytes = ms.ToArray();
                var base64Data = Convert.ToBase64String(imageBytes);

                var body = new
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
                                        mimeType = image.ContentType,
                                        data = base64Data
                                    }
                                },
                                new
                                {
                                    text = "Hãy đọc chỉ số điện (chỉ số tiêu thụ kWh chính, thường là dãy chữ số lớn màu đen/trắng, bỏ qua phần số thập phân nhỏ màu đỏ hoặc ký hiệu khác ở cuối) từ ảnh công tơ điện này. Chỉ trả về duy nhất một số nguyên đại diện cho chỉ số đó, không thêm bất kỳ chữ hay lời giải thích nào khác."
                                }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.0
                    }
                };

                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                using var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorText = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini OCR request failed with status {StatusCode}: {Error}", response.StatusCode, errorText);
                    return null;
                }

                var jsonText = await response.Content.ReadAsStringAsync();
                
                using var doc = JsonDocument.Parse(jsonText);
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
                            var valueStr = text.GetString()?.Trim();
                            if (!string.IsNullOrWhiteSpace(valueStr))
                            {
                                var cleanStr = new string(valueStr.Where(char.IsDigit).ToArray());
                                if (int.TryParse(cleanStr, out var reading))
                                {
                                    return reading;
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini OCR execution failed.");
            }
            return null;
        }
    }
}
