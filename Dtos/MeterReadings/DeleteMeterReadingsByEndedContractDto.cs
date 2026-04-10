namespace NhaTro.Dtos.MeterReadings
{
    public class DeleteMeterReadingsByEndedContractDto
    {
        public int ContractId { get; set; }
        public int RoomId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public int DeletedCount { get; set; }
    }
}
