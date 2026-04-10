namespace NhaTro.Dtos.Rooms
{
    public class RoomDto
    {
        public int RoomId { get; set; }
        public string RoomCode { get; set; } = string.Empty;
        public decimal ListedPrice { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}