using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Contracts
{
    public class CreateContractDto
    {
        [Required]
        public int RoomId { get; set; }

        [Required]
        public int TenantId { get; set; }

        [Required]
        public DateOnly StartDate { get; set; }

        public DateOnly? ExpectedEndDate { get; set; }

        [Range(0, double.MaxValue)]
        public decimal DepositAmount { get; set; }

        [Range(1, int.MaxValue)]
        public int OccupantCount { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal ActualRoomPrice { get; set; }
    }
}