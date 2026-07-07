using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Contracts
{
    public class ContractEndExecuteDto
    {
        [Required]
        public DateOnly ActualEndDate { get; set; }

        public int? CurrentReading { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DiscountAmount { get; set; }

        public string? Note { get; set; }
    }
}
