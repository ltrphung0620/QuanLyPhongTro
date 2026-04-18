namespace NhaTro.Dtos.MeterReadings
{
    public class MeterReadingDto
    {
        public int MeterReadingId { get; set; }
        public int RoomId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public int? ContractId { get; set; }
        public DateOnly BillingMonth { get; set; }
        public int PreviousReading { get; set; }
        public int CurrentReading { get; set; }
        public int ConsumedUnits { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Amount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
