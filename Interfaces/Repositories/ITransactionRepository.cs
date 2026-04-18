using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface ITransactionRepository
    {
        Task<List<Transaction>> GetAllAsync(DateOnly? month = null, string? type = null);
        Task<Transaction?> GetByIdAsync(int transactionId);
        Task<List<Transaction>> GetByRelatedInvoiceIdAsync(int invoiceId);
        Task<List<Transaction>> GetPendingRoomChargeTransactionsAsync(int roomId, DateOnly month);
        Task AddAsync(Transaction transaction);
        void Update(Transaction transaction);
        void Delete(Transaction transaction);
        Task<bool> SaveChangesAsync();
    }
}
