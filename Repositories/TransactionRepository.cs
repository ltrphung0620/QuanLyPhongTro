using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class TransactionRepository : ITransactionRepository
    {
        private readonly NhaTroDbContext _context;

        public TransactionRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<Transaction>> GetAllAsync(DateOnly? month = null, string? type = null)
        {
            var query = _context.Transactions.AsQueryable();

            if (month.HasValue)
            {
                var firstDay = new DateOnly(month.Value.Year, month.Value.Month, 1);
                var lastDay = firstDay.AddMonths(1).AddDays(-1);
                query = query.Where(x => x.TransactionDate >= firstDay && x.TransactionDate <= lastDay);
            }

            if (!string.IsNullOrWhiteSpace(type))
            {
                var normalized = type.Trim().ToLower();
                query = query.Where(x => x.TransactionDirection.ToLower() == normalized);
            }

            return await query
                .OrderByDescending(x => x.TransactionDate)
                .ThenByDescending(x => x.TransactionId)
                .ToListAsync();
        }

        public async Task<Transaction?> GetByIdAsync(int transactionId)
        {
            return await _context.Transactions.FirstOrDefaultAsync(x => x.TransactionId == transactionId);
        }

        public async Task AddAsync(Transaction transaction)
        {
            await _context.Transactions.AddAsync(transaction);
        }

        public void Update(Transaction transaction)
        {
            _context.Transactions.Update(transaction);
        }

        public void Delete(Transaction transaction)
        {
            _context.Transactions.Remove(transaction);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}