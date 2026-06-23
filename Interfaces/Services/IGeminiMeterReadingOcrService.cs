using Microsoft.AspNetCore.Http;
using NhaTro.Dtos.MeterReadings;
using System.Threading.Tasks;

namespace NhaTro.Interfaces.Services
{
    public interface IGeminiMeterReadingOcrService
    {
        Task<OcrResultDto> ReadMeterImageAsync(IFormFile image, int? previousReading = null);
    }
}
