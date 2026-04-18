using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Transactions
{
    public class UpdateTransactionDto
    {
        [Required]
        [MaxLength(20)]
        public string TransactionDirection { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? ItemName { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal Amount { get; set; }

        [Required]
        public DateOnly TransactionDate { get; set; }

        public string? Description { get; set; }

        public int? RelatedRoomId { get; set; }
    }
}
