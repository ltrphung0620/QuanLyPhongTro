using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IPaymentTransactionRepository
    {
        Task<List<PaymentTransaction>> GetAllAsync(string? processStatus = null);
        Task<PaymentTransaction?> GetByIdAsync(int paymentTransactionId);
        Task<PaymentTransaction?> GetByProviderTransactionIdAsync(string providerTransactionId);
        Task AddAsync(PaymentTransaction paymentTransaction);
        void Update(PaymentTransaction paymentTransaction);
        Task<bool> SaveChangesAsync();
    }
}