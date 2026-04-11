using NhaTro.Dtos.MeterReadings;

namespace NhaTro.Interfaces.Services
{
    public interface IMeterReadingService
    {
        Task<List<MeterReadingDto>> GetAllAsync(int? roomId = null, DateOnly? month = null);
        Task<MeterReadingDto> CreateAsync(CreateMeterReadingDto dto);
        Task<MeterReadingPreviewDto> PreviewAsync(CreateMeterReadingDto dto);
        Task<List<MeterReadingDto>> UpdateOriginalReadingAsync(UpdateOriginalMeterReadingDto dto);
        Task<bool> DeleteAsync(int meterReadingId);
        Task<DeleteMeterReadingsByEndedContractDto?> DeleteByEndedContractAsync(int contractId);
        Task<MeterReadingImageResultDto> ReadFromImageAsync(IFormFile file);
        Task<List<MissingMeterDto>> GetMissingAsync(DateOnly month);
    }
}
