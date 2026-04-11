using NhaTro.Dtos.MeterReadings;

namespace NhaTro.Interfaces.Services
{
    public interface IMeterReadingImageReader
    {
        Task<MeterReadingImageResultDto> ReadAsync(IFormFile file, CancellationToken cancellationToken = default);
    }
}
