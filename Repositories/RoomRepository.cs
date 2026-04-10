using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class RoomRepository : IRoomRepository
    {
        private readonly NhaTroDbContext _context;

        public RoomRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<Room>> GetAllAsync(string? status = null)
        {
            var query = _context.Rooms.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                var normalizedStatus = status.Trim().ToLower();
                query = query.Where(r => r.Status.ToLower() == normalizedStatus);
            }

            return await query
                .OrderBy(r => r.RoomCode)
                .ToListAsync();
        }

        public async Task<Room?> GetByIdAsync(int roomId)
        {
            return await _context.Rooms.FirstOrDefaultAsync(r => r.RoomId == roomId);
        }

        public async Task<Room?> GetByRoomCodeAsync(string roomCode)
        {
            var normalizedRoomCode = roomCode.Trim().ToLower();

            return await _context.Rooms
                .FirstOrDefaultAsync(r => r.RoomCode.ToLower() == normalizedRoomCode);
        }

        public async Task AddAsync(Room room)
        {
            await _context.Rooms.AddAsync(room);
        }

        public void Update(Room room)
        {
            _context.Rooms.Update(room);
        }

        public void Delete(Room room)
        {
            _context.Rooms.Remove(room);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}