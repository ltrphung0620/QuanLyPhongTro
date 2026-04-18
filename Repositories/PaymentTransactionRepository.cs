using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class PaymentTransactionRepository : IPaymentTransactionRepository
    {
        private readonly NhaTroDbContext _context;

        public PaymentTransactionRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<PaymentTransaction>> GetAllAsync(string? processStatus = null)
        {
            var query = _context.PaymentTransactions
                .Include(x => x.MatchedInvoice)
                .ThenInclude(x => x!.Room)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(processStatus))
            {
                var normalized = processStatus.Trim().ToLower();
                query = query.Where(x => x.ProcessStatus != null && x.ProcessStatus.ToLower() == normalized);
            }

            return await query
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<PaymentTransaction?> GetByIdAsync(int paymentTransactionId)
        {
            return await _context.PaymentTransactions
                .Include(x => x.MatchedInvoice)
                .ThenInclude(x => x!.Room)
                .FirstOrDefaultAsync(x => x.PaymentTransactionId == paymentTransactionId);
        }

        public async Task<PaymentTransaction?> GetByProviderTransactionIdAsync(string providerTransactionId)
        {
            var normalized = providerTransactionId.Trim();
            return await _context.PaymentTransactions
                .Include(x => x.MatchedInvoice)
                .ThenInclude(x => x!.Room)
                .FirstOrDefaultAsync(x => x.ProviderTransactionId == normalized);
        }

        public async Task AddAsync(PaymentTransaction paymentTransaction)
        {
            await _context.PaymentTransactions.AddAsync(paymentTransaction);
        }

        public void Delete(PaymentTransaction paymentTransaction)
        {
            _context.PaymentTransactions.Remove(paymentTransaction);
        }

        public void Update(PaymentTransaction paymentTransaction)
        {
            _context.PaymentTransactions.Update(paymentTransaction);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
