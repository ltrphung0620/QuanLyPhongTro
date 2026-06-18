using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Contracts
{
    public class CancelContractDto
    {
        [MaxLength(500)]
        public string? Reason { get; set; }
    }
}
