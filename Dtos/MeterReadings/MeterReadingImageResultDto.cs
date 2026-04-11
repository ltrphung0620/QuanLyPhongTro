using System.Collections.Generic;

namespace NhaTro.Dtos.MeterReadings
{
    public class MeterReadingImageResultDto
    {
        public int DetectedReading { get; set; }
        public string? RawText { get; set; }
        public string? ProcessingMode { get; set; }
        public long? ElapsedMs { get; set; }
        public string? ErrorMessage { get; set; }
        public string? DebugDirectory { get; set; }
        public List<string>? DebugImages { get; set; }
    }
}
