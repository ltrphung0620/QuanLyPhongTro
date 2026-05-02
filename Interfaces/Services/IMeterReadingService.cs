using NhaTro.Dtos.MeterReadings;

namespace NhaTro.Interfaces.Services
{
    public interface IMeterReadingService
    {
        Task<List<MeterReadingDto>> GetAllAsync(int? roomId = null, DateOnly? month = null);
        Task<MeterReadingDto> CreateAsync(CreateMeterReadingDto dto);
        Task<MeterReadingDto?> UploadImageAsync(int meterReadingId, IFormFile image);
        Task<MeterReadingPreviewDto> PreviewAsync(CreateMeterReadingDto dto);
        Task<List<MeterReadingDto>> UpdateOriginalReadingAsync(UpdateOriginalMeterReadingDto dto);
        Task<bool> DeleteAsync(int meterReadingId);
        Task<DeleteMeterReadingsByEndedContractDto?> DeleteByEndedContractAsync(int contractId);
        Task<List<MissingMeterDto>> GetMissingAsync(DateOnly month);
    }
}
