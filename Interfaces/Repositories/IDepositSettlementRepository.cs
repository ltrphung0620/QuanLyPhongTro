using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IDepositSettlementRepository
    {
        Task AddAsync(DepositSettlement depositSettlement);
        Task<DepositSettlement?> GetByContractIdAsync(int contractId);
        void Update(DepositSettlement depositSettlement);
        Task<bool> SaveChangesAsync();
    }
}
