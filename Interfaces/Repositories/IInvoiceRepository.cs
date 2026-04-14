using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IInvoiceRepository
    {
        Task<List<Invoice>> GetAllAsync(int? roomId = null, DateOnly? month = null, string? status = null);
        Task<Invoice?> GetByIdAsync(int invoiceId);
        Task<Invoice?> GetByRoomAndMonthAsync(int roomId, DateOnly month);
        Task<Invoice?> GetByContractAndMonthAsync(int contractId, DateOnly month);
        Task<Invoice?> GetLatestBeforeMonthAsync(int roomId, DateOnly month);
        Task<List<Invoice>> GetUnpaidAsync(DateOnly? month = null);
        Task<Invoice?> GetByPaymentCodeAsync(string paymentCode);
        Task<bool> PaymentCodeExistsAsync(string paymentCode);
        Task AddAsync(Invoice invoice);
        void Update(Invoice invoice);
        Task<bool> DeleteAsync(int invoiceId);
        Task<bool> SaveChangesAsync();
    }
}
