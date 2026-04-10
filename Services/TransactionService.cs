using NhaTro.Dtos.Transactions;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class TransactionService : ITransactionService
    {
        private readonly ITransactionRepository _transactionRepository;
        private readonly IInvoiceRepository _invoiceRepository;

        private static readonly HashSet<string> AllowedDirections = new() { "income", "expense" };
        private static readonly HashSet<string> AllowedCategories = new() { "operating", "other" };

        public TransactionService(
            ITransactionRepository transactionRepository,
            IInvoiceRepository invoiceRepository)
        {
            _transactionRepository = transactionRepository;
            _invoiceRepository = invoiceRepository;
        }

        public async Task<List<TransactionDto>> GetAllAsync(DateOnly? month = null, string? type = null)
        {
            if (!string.IsNullOrWhiteSpace(type))
            {
                ValidateDirection(type);
            }

            var data = await _transactionRepository.GetAllAsync(month, type);
            return data.Select(MapToDto).ToList();
        }

        public async Task<TransactionDto?> GetByIdAsync(int transactionId)
        {
            var transaction = await _transactionRepository.GetByIdAsync(transactionId);
            return transaction == null ? null : MapToDto(transaction);
        }

        public async Task<TransactionDto> CreateAsync(CreateTransactionDto dto)
        {
            ValidateDirection(dto.TransactionDirection);
            ValidateCategory(dto.Category);

            if (dto.RelatedInvoiceId.HasValue)
            {
                var invoice = await _invoiceRepository.GetByIdAsync(dto.RelatedInvoiceId.Value);
                if (invoice == null)
                {
                    throw new InvalidOperationException("RelatedInvoiceId không hợp lệ.");
                }
            }

            var transaction = new Transaction
            {
                TransactionDirection = dto.TransactionDirection.Trim().ToLower(),
                Category = dto.Category.Trim().ToLower(),
                ItemName = string.IsNullOrWhiteSpace(dto.ItemName) ? null : dto.ItemName.Trim(),
                Amount = dto.Amount,
                TransactionDate = dto.TransactionDate,
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                RelatedInvoiceId = dto.RelatedInvoiceId,
                CreatedAt = DateTime.UtcNow
            };

            await _transactionRepository.AddAsync(transaction);
            await _transactionRepository.SaveChangesAsync();

            return MapToDto(transaction);
        }

        public async Task<TransactionDto?> UpdateAsync(int transactionId, UpdateTransactionDto dto)
        {
            ValidateDirection(dto.TransactionDirection);
            ValidateCategory(dto.Category);

            var transaction = await _transactionRepository.GetByIdAsync(transactionId);
            if (transaction == null)
            {
                return null;
            }

            if (dto.RelatedInvoiceId.HasValue)
            {
                var invoice = await _invoiceRepository.GetByIdAsync(dto.RelatedInvoiceId.Value);
                if (invoice == null)
                {
                    throw new InvalidOperationException("RelatedInvoiceId không hợp lệ.");
                }
            }

            transaction.TransactionDirection = dto.TransactionDirection.Trim().ToLower();
            transaction.Category = dto.Category.Trim().ToLower();
            transaction.ItemName = string.IsNullOrWhiteSpace(dto.ItemName) ? null : dto.ItemName.Trim();
            transaction.Amount = dto.Amount;
            transaction.TransactionDate = dto.TransactionDate;
            transaction.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            transaction.RelatedInvoiceId = dto.RelatedInvoiceId;

            _transactionRepository.Update(transaction);
            await _transactionRepository.SaveChangesAsync();

            return MapToDto(transaction);
        }

        public async Task<bool> DeleteAsync(int transactionId)
        {
            var transaction = await _transactionRepository.GetByIdAsync(transactionId);
            if (transaction == null)
            {
                return false;
            }

            _transactionRepository.Delete(transaction);
            await _transactionRepository.SaveChangesAsync();

            return true;
        }

        private static void ValidateDirection(string direction)
        {
            var normalized = direction.Trim().ToLower();
            if (!AllowedDirections.Contains(normalized))
            {
                throw new ArgumentException("TransactionDirection chỉ được là 'income' hoặc 'expense'.");
            }
        }

        private static void ValidateCategory(string category)
        {
            var normalized = category.Trim().ToLower();
            if (!AllowedCategories.Contains(normalized))
            {
                throw new ArgumentException("Category chỉ được là 'operating' hoặc 'other'.");
            }
        }

        private static TransactionDto MapToDto(Transaction transaction)
        {
            return new TransactionDto
            {
                TransactionId = transaction.TransactionId,
                TransactionDirection = transaction.TransactionDirection,
                Category = transaction.Category,
                ItemName = transaction.ItemName,
                Amount = transaction.Amount,
                TransactionDate = transaction.TransactionDate,
                Description = transaction.Description,
                RelatedInvoiceId = transaction.RelatedInvoiceId,
                CreatedAt = transaction.CreatedAt
            };
        }
    }
}