using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.MeterReadings
{
    public class CreateMeterReadingBulkDto
    {
        [Required]
        public DateOnly BillingMonth { get; set; }

        [Required]
        public List<CreateMeterReadingBulkItemDto> Readings { get; set; } = new();
    }

    public class CreateMeterReadingBulkItemDto
    {
        [Required]
        public int RoomId { get; set; }

        [Required]
        public int ContractId { get; set; }

        [Required]
        public int CurrentReading { get; set; }
    }
}
