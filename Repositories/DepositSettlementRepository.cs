using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;
using Microsoft.EntityFrameworkCore;

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

        public async Task<DepositSettlement?> GetByContractIdAsync(int contractId)
        {
            return await _context.DepositSettlements.FirstOrDefaultAsync(x => x.ContractId == contractId);
        }

        public void Update(DepositSettlement depositSettlement)
        {
            _context.DepositSettlements.Update(depositSettlement);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
