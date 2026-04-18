using System.Globalization;
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
        private readonly IRoomRepository _roomRepository;

        private static readonly HashSet<string> AllowedDirections = new() { "income", "expense" };
        private static readonly HashSet<string> AllowedCategories = new() { "operating", "other" };

        public TransactionService(
            ITransactionRepository transactionRepository,
            IInvoiceRepository invoiceRepository,
            IRoomRepository roomRepository)
        {
            _transactionRepository = transactionRepository;
            _invoiceRepository = invoiceRepository;
            _roomRepository = roomRepository;
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

            var room = await GetValidatedRelatedRoomAsync(dto.RelatedRoomId);
            var relatedInvoiceId = await ResolveRelatedInvoiceIdAsync(room?.RoomId, dto.TransactionDate);

            var transaction = new Transaction
            {
                TransactionDirection = dto.TransactionDirection.Trim().ToLowerInvariant(),
                Category = dto.Category.Trim().ToLowerInvariant(),
                ItemName = string.IsNullOrWhiteSpace(dto.ItemName) ? null : dto.ItemName.Trim(),
                Amount = dto.Amount,
                TransactionDate = dto.TransactionDate,
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                RelatedRoomId = room?.RoomId,
                RelatedInvoiceId = relatedInvoiceId,
                CreatedAt = DateTime.UtcNow
            };

            await _transactionRepository.AddAsync(transaction);
            await _transactionRepository.SaveChangesAsync();
            await RefreshLinkedInvoiceAsync(transaction.RelatedInvoiceId);

            var created = await _transactionRepository.GetByIdAsync(transaction.TransactionId) ?? transaction;
            return MapToDto(created);
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

            var room = await GetValidatedRelatedRoomAsync(dto.RelatedRoomId);
            var relatedInvoiceId = await ResolveRelatedInvoiceIdAsync(room?.RoomId, dto.TransactionDate);
            var previousRelatedInvoiceId = transaction.RelatedInvoiceId;

            transaction.TransactionDirection = dto.TransactionDirection.Trim().ToLowerInvariant();
            transaction.Category = dto.Category.Trim().ToLowerInvariant();
            transaction.ItemName = string.IsNullOrWhiteSpace(dto.ItemName) ? null : dto.ItemName.Trim();
            transaction.Amount = dto.Amount;
            transaction.TransactionDate = dto.TransactionDate;
            transaction.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            transaction.RelatedRoomId = room?.RoomId;
            transaction.RelatedInvoiceId = relatedInvoiceId;

            _transactionRepository.Update(transaction);
            await _transactionRepository.SaveChangesAsync();
            await RefreshLinkedInvoiceAsync(previousRelatedInvoiceId);
            await RefreshLinkedInvoiceAsync(transaction.RelatedInvoiceId);

            var updated = await _transactionRepository.GetByIdAsync(transaction.TransactionId) ?? transaction;
            return MapToDto(updated);
        }

        public async Task<bool> DeleteAsync(int transactionId)
        {
            var transaction = await _transactionRepository.GetByIdAsync(transactionId);
            if (transaction == null)
            {
                return false;
            }

            var relatedInvoiceId = transaction.RelatedInvoiceId;
            _transactionRepository.Delete(transaction);
            await _transactionRepository.SaveChangesAsync();
            await RefreshLinkedInvoiceAsync(relatedInvoiceId);

            return true;
        }

        private async Task<Room?> GetValidatedRelatedRoomAsync(int? relatedRoomId)
        {
            if (!relatedRoomId.HasValue)
            {
                return null;
            }

            var room = await _roomRepository.GetByIdAsync(relatedRoomId.Value);
            if (room == null)
            {
                throw new InvalidOperationException("Phòng liên quan không hợp lệ.");
            }

            return room;
        }

        private async Task<int?> ResolveRelatedInvoiceIdAsync(int? relatedRoomId, DateOnly transactionDate)
        {
            if (!relatedRoomId.HasValue)
            {
                return null;
            }

            var billingMonth = new DateOnly(transactionDate.Year, transactionDate.Month, 1);
            var invoice = await _invoiceRepository.GetByRoomAndMonthAsync(relatedRoomId.Value, billingMonth);
            return invoice?.InvoiceId;
        }

        private async Task RefreshLinkedInvoiceAsync(int? invoiceId)
        {
            if (!invoiceId.HasValue)
            {
                return;
            }

            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId.Value);
            if (invoice == null)
            {
                return;
            }

            var linkedTransactions = await _transactionRepository.GetByRelatedInvoiceIdAsync(invoiceId.Value);
            var linkedIncomeTransactions = linkedTransactions
                .Where(IsInvoiceExtraIncomeTransaction)
                .ToList();

            invoice.ExtraFee = linkedIncomeTransactions.Sum(x => x.Amount);
            invoice.ExtraFeeNote = BuildExtraFeeNote(linkedIncomeTransactions);
            invoice.TotalAmount = CalculateInvoiceTotal(invoice);
            invoice.UpdatedAt = DateTime.UtcNow;

            _invoiceRepository.Update(invoice);
            await _invoiceRepository.SaveChangesAsync();
        }

        private static void ValidateDirection(string direction)
        {
            var normalized = direction.Trim().ToLowerInvariant();
            if (!AllowedDirections.Contains(normalized))
            {
                throw new ArgumentException("TransactionDirection chỉ được là 'income' hoặc 'expense'.");
            }
        }

        private static void ValidateCategory(string category)
        {
            var normalized = category.Trim().ToLowerInvariant();
            if (!AllowedCategories.Contains(normalized))
            {
                throw new ArgumentException("Category chỉ được là 'operating' hoặc 'other'.");
            }
        }

        private static bool IsInvoiceExtraIncomeTransaction(Transaction transaction)
        {
            return transaction.RelatedInvoiceId.HasValue &&
                string.Equals(transaction.TransactionDirection, "income", StringComparison.OrdinalIgnoreCase);
        }

        private static decimal CalculateInvoiceTotal(Invoice invoice)
        {
            var total =
                invoice.RoomFee +
                invoice.ElectricityFee +
                invoice.WaterFee +
                invoice.TrashFee +
                invoice.ExtraFee +
                invoice.DebtAmount -
                invoice.DiscountAmount;

            return total < 0 ? 0 : total;
        }

        public static string? BuildExtraFeeNote(IEnumerable<Transaction> transactions)
        {
            var notes = transactions
                .Select(BuildExtraFeeLine)
                .Where(text => !string.IsNullOrWhiteSpace(text))
                .Distinct()
                .ToList();

            return notes.Count == 0 ? null : string.Join(" | ", notes);
        }

        private static string? BuildExtraFeeLine(Transaction transaction)
        {
            var baseText = string.IsNullOrWhiteSpace(transaction.Description)
                ? transaction.ItemName
                : transaction.Description;

            var normalizedBaseText = string.IsNullOrWhiteSpace(baseText)
                ? "Thu phí phát sinh"
                : baseText.Trim();

            if (!normalizedBaseText.StartsWith("Thu", StringComparison.OrdinalIgnoreCase))
            {
                normalizedBaseText = $"Thu tiền {normalizedBaseText}";
            }

            return $"{normalizedBaseText} {FormatCompactMoney(transaction.Amount)}";
        }

        private static string FormatCompactMoney(decimal amount)
        {
            var roundedAmount = decimal.Round(amount, 0, MidpointRounding.AwayFromZero);
            if (roundedAmount == 0)
            {
                return "0đ";
            }

            if (roundedAmount % 1_000_000 == 0)
            {
                return $"{(roundedAmount / 1_000_000).ToString("0.#", CultureInfo.InvariantCulture)}tr";
            }

            if (roundedAmount % 1_000 == 0)
            {
                return $"{(roundedAmount / 1_000).ToString("0.#", CultureInfo.InvariantCulture)}k";
            }

            return $"{roundedAmount.ToString("N0", CultureInfo.GetCultureInfo("vi-VN"))}đ";
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
                RelatedRoomId = transaction.RelatedRoomId ?? transaction.RelatedInvoice?.RoomId,
                RelatedRoomCode = transaction.RelatedRoom?.RoomCode ?? transaction.RelatedInvoice?.Room?.RoomCode,
                RelatedInvoiceId = transaction.RelatedInvoiceId,
                CreatedAt = transaction.CreatedAt
            };
        }
    }
}
