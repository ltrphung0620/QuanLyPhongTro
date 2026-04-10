using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class DepositSettlementRepository : IDepositSettlementRepository
    {
        private readonly NhaTroDbContext _context;

        public DepositSettlementRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(DepositSettlement depositSettlement)
        {
            await _context.DepositSettlements.AddAsync(depositSettlement);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}