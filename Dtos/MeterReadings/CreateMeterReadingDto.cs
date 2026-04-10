using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.MeterReadings
{
    public class CreateMeterReadingDto
    {
        [Required]
        public int RoomId { get; set; }

        [Required]
        public int ContractId { get; set; }

        [Required]
        public DateOnly BillingMonth { get; set; } // ví dụ: 2026-03-01

        [Required]
        public int CurrentReading { get; set; }
    }
}