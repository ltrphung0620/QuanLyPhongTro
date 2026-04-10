namespace NhaTro.Dtos.Contracts
{
    public class ContractEndPreviewDto
    {
        public int ContractId { get; set; }
        public int RoomId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;

        public DateOnly StartDate { get; set; }
        public DateOnly ActualEndDate { get; set; }

        public int NumberOfDays { get; set; }

        public decimal RoomFee { get; set; }
        public decimal ElectricityFee { get; set; }
        public decimal WaterFee { get; set; }
        public decimal TrashFee { get; set; }

        public decimal FinalInvoiceAmount { get; set; }

        public decimal DepositAmount { get; set; }
        public decimal DeductedAmount { get; set; }
        public decimal RefundedAmount { get; set; }
        public decimal RemainingAmount { get; set; }
    }
}
