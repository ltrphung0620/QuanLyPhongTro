namespace NhaTro.Dtos.Contracts
{
    public class ContractDto
    {
        public int ContractId { get; set; }
        public int RoomId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly? ExpectedEndDate { get; set; }
        public DateOnly? ActualEndDate { get; set; }
        public decimal DepositAmount { get; set; }
        public int OccupantCount { get; set; }
        public decimal ActualRoomPrice { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}