using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IDepositSettlementRepository
    {
        Task AddAsync(DepositSettlement depositSettlement);
        Task<bool> SaveChangesAsync();
    }
}
