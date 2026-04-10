using NhaTro.Dtos.Transactions;

namespace NhaTro.Interfaces.Services
{
    public interface ITransactionService
    {
        Task<List<TransactionDto>> GetAllAsync(DateOnly? month = null, string? type = null);
        Task<TransactionDto?> GetByIdAsync(int transactionId);
        Task<TransactionDto> CreateAsync(CreateTransactionDto dto);
        Task<TransactionDto?> UpdateAsync(int transactionId, UpdateTransactionDto dto);
        Task<bool> DeleteAsync(int transactionId);
    }
}