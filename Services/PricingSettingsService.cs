using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos.Pricing;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class PricingSettingsService : IPricingSettingsService
    {
        public const string ElectricityUnitPriceKey = "Pricing.ElectricityUnitPrice";
        public const string WaterFeePerPersonKey = "Pricing.WaterFeePerPerson";
        public const string TrashFeeKey = "Pricing.TrashFee";
        public const string CustomServicesKey = "Pricing.CustomServices";

        private readonly NhaTroDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public PricingSettingsService(NhaTroDbContext context, ICurrentUserService currentUserService)
        {
            _context = context;
            _currentUserService = currentUserService;
        }

        public async Task<PricingSettingsDto> GetAsync()
        {
            var organizationId = GetOrganizationId();
            var settings = await _context.SystemSettings
                .AsNoTracking()
                .Where(x => x.OrganizationId == organizationId)
                .ToDictionaryAsync(x => x.SettingKey, x => x.SettingValue);

            return new PricingSettingsDto
            {
                ElectricityUnitPrice = ReadDecimal(settings, ElectricityUnitPriceKey, 3500m),
                WaterFeePerPerson = ReadDecimal(settings, WaterFeePerPersonKey, 50000m),
                TrashFee = ReadDecimal(settings, TrashFeeKey, 30000m),
                CustomServices = ReadCustomServices(settings)
            };
        }

        public async Task<PricingSettingsDto> UpdateAsync(PricingSettingsDto dto)
        {
            dto.CustomServices ??= new List<CustomServicePriceDto>();
            Validate(dto);
            dto.CustomServices = dto.CustomServices
                .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                .Select(x => new CustomServicePriceDto
                {
                    Name = x.Name.Trim(),
                    Amount = x.Amount,
                    ChargeUnit = string.IsNullOrWhiteSpace(x.ChargeUnit) ? "month" : x.ChargeUnit.Trim()
                })
                .ToList();

            var organizationId = GetOrganizationId();

            await UpsertAsync(
                organizationId,
                ElectricityUnitPriceKey,
                dto.ElectricityUnitPrice.ToString(CultureInfo.InvariantCulture),
                "Giá điện trên mỗi kWh.");
            await UpsertAsync(
                organizationId,
                WaterFeePerPersonKey,
                dto.WaterFeePerPerson.ToString(CultureInfo.InvariantCulture),
                "Tiền nước tính theo mỗi người mỗi tháng.");
            await UpsertAsync(
                organizationId,
                TrashFeeKey,
                dto.TrashFee.ToString(CultureInfo.InvariantCulture),
                "Tiền rác cố định mỗi phòng mỗi tháng.");
            await UpsertAsync(
                organizationId,
                CustomServicesKey,
                JsonSerializer.Serialize(dto.CustomServices),
                "Danh sách loại phí dịch vụ khác để tham khảo khi lập hóa đơn.");

            await _context.SaveChangesAsync();
            return await GetAsync();
        }

        private async Task UpsertAsync(int organizationId, string key, string value, string description)
        {
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(x => x.OrganizationId == organizationId && x.SettingKey == key);

            if (setting == null)
            {
                setting = new SystemSetting
                {
                    OrganizationId = organizationId,
                    SettingKey = key
                };
                _context.SystemSettings.Add(setting);
            }

            setting.SettingValue = value;
            setting.Description = description;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        private int GetOrganizationId()
        {
            return _currentUserService.OrganizationId
                ?? throw new InvalidOperationException("Không xác định được tổ chức hiện tại.");
        }

        private static decimal ReadDecimal(Dictionary<string, string> settings, string key, decimal fallback)
        {
            return settings.TryGetValue(key, out var value) &&
                   decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : fallback;
        }

        private static List<CustomServicePriceDto> ReadCustomServices(Dictionary<string, string> settings)
        {
            if (!settings.TryGetValue(CustomServicesKey, out var value) || string.IsNullOrWhiteSpace(value))
            {
                return new List<CustomServicePriceDto>();
            }

            try
            {
                return JsonSerializer.Deserialize<List<CustomServicePriceDto>>(value) ?? new List<CustomServicePriceDto>();
            }
            catch
            {
                return new List<CustomServicePriceDto>();
            }
        }

        private static void Validate(PricingSettingsDto dto)
        {
            if (dto.ElectricityUnitPrice < 0 ||
                dto.WaterFeePerPerson < 0 ||
                dto.TrashFee < 0 ||
                (dto.CustomServices?.Any(x => x.Amount < 0) ?? false))
            {
                throw new InvalidOperationException("Bảng giá không hợp lệ.");
            }
        }
    }
}
