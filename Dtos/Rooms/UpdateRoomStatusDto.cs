using System.ComponentModel.DataAnnotations;

namespace NhaTro.Dtos.Rooms
{
    public class UpdateRoomStatusDto
    {
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = string.Empty;
    }
}