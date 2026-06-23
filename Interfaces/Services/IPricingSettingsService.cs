using NhaTro.Dtos.Pricing;

namespace NhaTro.Interfaces.Services
{
    public interface IPricingSettingsService
    {
        Task<PricingSettingsDto> GetAsync();
        Task<PricingSettingsDto> UpdateAsync(PricingSettingsDto dto);
    }
}
