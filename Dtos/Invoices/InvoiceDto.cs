namespace NhaTro.Dtos.Invoices
{
    public class InvoiceDto
    {
        public int InvoiceId { get; set; }

        public int RoomId { get; set; }
        public string? RoomCode { get; set; }
        public int? ContractId { get; set; }

        public string InvoiceType { get; set; } = string.Empty;

        public DateOnly? BillingMonth { get; set; }
        public DateOnly? FromDate { get; set; }
        public DateOnly? ToDate { get; set; }

        public decimal RoomFee { get; set; }
        public decimal ElectricityFee { get; set; }
        public int? PreviousReading { get; set; }
        public int? CurrentReading { get; set; }
        public int? ConsumedUnits { get; set; }
        public string? MeterImagePath { get; set; }
        public decimal WaterFee { get; set; }
        public decimal TrashFee { get; set; }
        public decimal ExtraFee { get; set; }

        public decimal DiscountAmount { get; set; }
        public decimal DebtAmount { get; set; }

        public decimal TotalAmount { get; set; }

        public string Status { get; set; } = string.Empty;

        public string? PaymentCode { get; set; }
        public DateTime? PaidAt { get; set; }
        public decimal? PaidAmount { get; set; }
        public string? PaymentMethod { get; set; }
        public string? PaymentReference { get; set; }

        public string? ExtraFeeNote { get; set; }
        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
