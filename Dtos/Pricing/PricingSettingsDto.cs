using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Pricing
{
    public class PricingSettingsDto
    {
        [Range(0, double.MaxValue)]
        public decimal ElectricityUnitPrice { get; set; } = 3500m;

        [Range(0, double.MaxValue)]
        public decimal WaterFeePerPerson { get; set; } = 50000m;

        [Range(0, double.MaxValue)]
        public decimal TrashFee { get; set; } = 30000m;

        public List<CustomServicePriceDto> CustomServices { get; set; } = new();
    }

    public class CustomServicePriceDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Range(0, double.MaxValue)]
        public decimal Amount { get; set; }

        [MaxLength(50)]
        public string ChargeUnit { get; set; } = "month";
    }
}
