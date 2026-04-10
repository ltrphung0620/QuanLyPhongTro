using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IContractRepository
    {
        Task<List<Contract>> GetAllAsync(string? status = null, int? roomId = null);
        Task<Contract?> GetByIdAsync(int contractId);
        Task<Contract?> GetActiveByRoomIdAsync(int roomId);
        Task AddAsync(Contract contract);
        void Delete(Contract contract);
        void Update(Contract contract);
        Task<bool> SaveChangesAsync();
        Task<Contract?> GetActiveByRoomCodeAsync(string roomCode);
    }
}
