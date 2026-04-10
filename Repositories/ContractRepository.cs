using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class ContractRepository : IContractRepository
    {
        private readonly NhaTroDbContext _context;

        public ContractRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<Contract>> GetAllAsync(string? status = null, int? roomId = null)
        {
            var query = _context.Contracts
                .Include(c => c.Room)
                .Include(c => c.Tenant)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                var normalizedStatus = status.Trim().ToLower();
                query = query.Where(c => c.Status != null && c.Status.Trim().ToLower() == normalizedStatus);
            }

            if (roomId.HasValue)
            {
                query = query.Where(c => c.RoomId == roomId.Value);
            }

            return await query
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<Contract?> GetByIdAsync(int contractId)
        {
            return await _context.Contracts
                .Include(c => c.Room)
                .Include(c => c.Tenant)
                .FirstOrDefaultAsync(c => c.ContractId == contractId);
        }

        public async Task<Contract?> GetActiveByRoomIdAsync(int roomId)
        {
            return await _context.Contracts
                .Include(c => c.Room)
                .Include(c => c.Tenant)
                .FirstOrDefaultAsync(c =>
                    c.RoomId == roomId &&
                    c.Status != null &&
                    c.Status.Trim().ToLower() == "active");
        }

        public async Task AddAsync(Contract contract)
        {
            await _context.Contracts.AddAsync(contract);
        }

        public void Delete(Contract contract)
        {
            _context.Contracts.Remove(contract);
        }

        public void Update(Contract contract)
        {
            _context.Contracts.Update(contract);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
        public async Task<Contract?> GetActiveByRoomCodeAsync(string roomCode)
        {
            var normalized = roomCode.Trim().ToLower();

            return await _context.Contracts
                .Include(c => c.Room)
                .Include(c => c.Tenant)
                .FirstOrDefaultAsync(c =>
                    c.Room != null &&
                    c.Room.RoomCode != null &&
                    c.Room.RoomCode.Trim().ToLower() == normalized &&
                    c.Status != null &&
                    c.Status.Trim().ToLower() == "active");
        }
    }
}
