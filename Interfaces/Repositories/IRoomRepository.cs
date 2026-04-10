using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IRoomRepository
    {
        Task<List<Room>> GetAllAsync(string? status = null);
        Task<Room?> GetByIdAsync(int roomId);
        Task<Room?> GetByRoomCodeAsync(string roomCode);
        Task AddAsync(Room room);
        void Update(Room room);
        void Delete(Room room);
        Task<bool> SaveChangesAsync();
    }
}