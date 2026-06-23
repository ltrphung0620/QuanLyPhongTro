namespace NhaTro.Dtos.MeterReadings
{
    public class OcrResultDto
    {
        public bool Success { get; set; }
        public string? RawDigits { get; set; }
        public int? Reading { get; set; }
        public int IntegerWheelCount { get; set; }
        public string? DecimalDigitExcluded { get; set; }
        public double Confidence { get; set; }
        public bool RequiresManualConfirmation { get; set; }
        public string? Reason { get; set; }
    }
}
