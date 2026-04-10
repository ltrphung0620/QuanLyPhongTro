using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.MeterReadings
{
    public class UpdateOriginalMeterReadingDto
    {
        [Required]
        public string RoomCode { get; set; } = string.Empty;

        [Required]
        public DateOnly BillingMonth { get; set; }

        [Required]
        [Range(0, int.MaxValue)]
        public int CurrentReading { get; set; }
    }
}
