using NhaTro.Dtos.Rooms;

namespace NhaTro.Interfaces.Services
{
    public interface IRoomService
    {
        Task<List<RoomDto>> GetAllAsync(string? status = null);
        Task<RoomDto?> GetByIdAsync(int roomId);
        Task<RoomDto> CreateAsync(CreateRoomDto dto);
        Task<RoomDto?> GetByRoomCodeAsync(string roomCode);
        Task<RoomDto?> UpdateAsync(int roomId, UpdateRoomDto dto);
        Task<RoomDto?> UpdateStatusAsync(int roomId, UpdateRoomStatusDto dto);
    }
}