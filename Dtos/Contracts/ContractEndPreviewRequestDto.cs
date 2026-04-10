using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Contracts
{
    public class ContractEndPreviewRequestDto
    {
        [Required]
        public DateOnly ActualEndDate { get; set; }

        public int? CurrentReading { get; set; }
    }
}