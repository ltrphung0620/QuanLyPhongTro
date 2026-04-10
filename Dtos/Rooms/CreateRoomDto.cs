using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Rooms
{
    public class CreateRoomDto
    {
        [Required]
        [MaxLength(50)]
        public string RoomCode { get; set; } = string.Empty;

        [Range(0, double.MaxValue)]
        public decimal ListedPrice { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "vacant";
    }
}