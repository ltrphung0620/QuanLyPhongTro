namespace NhaTro.Dtos.MeterReadings
{
    public class MissingMeterDto
    {
        public int RoomId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public int ContractId { get; set; }
        public int PreviousReading { get; set; }
    }
}
