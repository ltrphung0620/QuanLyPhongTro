using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class InvoiceRepository : IInvoiceRepository
    {
        private readonly NhaTroDbContext _context;

        public InvoiceRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<Invoice>> GetAllAsync(int? roomId = null, DateOnly? month = null, string? status = null)
        {
            var query = _context.Invoices
                .Include(x => x.Room)
                .Where(x => x.ReplacedByInvoiceId == null)
                .AsQueryable();

            if (roomId.HasValue)
                query = query.Where(x => x.RoomId == roomId.Value);

            if (month.HasValue)
                query = query.Where(x => x.BillingMonth == month.Value);

            if (!string.IsNullOrWhiteSpace(status))
            {
                var normalized = status.Trim().ToLower();
                query = query.Where(x => x.Status.ToLower() == normalized);
            }

            return await query
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<Invoice?> GetByIdAsync(int invoiceId)
        {
            return await _context.Invoices
                .Include(x => x.Room)
                .FirstOrDefaultAsync(x => x.InvoiceId == invoiceId);
        }

        public async Task<Invoice?> GetByRoomAndMonthAsync(int roomId, DateOnly month)
        {
            return await _context.Invoices
                .Include(x => x.Room)
                .FirstOrDefaultAsync(x =>
                    x.RoomId == roomId &&
                    x.BillingMonth == month &&
                    x.InvoiceType == "monthly" &&
                    x.ReplacedByInvoiceId == null);
        }

        public async Task<Invoice?> GetByContractAndMonthAsync(int contractId, DateOnly month)
        {
            return await _context.Invoices
                .Include(x => x.Room)
                .FirstOrDefaultAsync(x =>
                    x.ContractId == contractId &&
                    x.BillingMonth == month &&
                    x.ReplacedByInvoiceId == null);
        }

        public async Task<List<Invoice>> GetByContractIdAsync(int contractId)
        {
            return await _context.Invoices
                .Include(x => x.Room)
                .Where(x => x.ContractId == contractId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<Invoice?> GetLatestBeforeMonthAsync(int roomId, DateOnly month)
        {
            return await _context.Invoices
                .Include(x => x.Room)
                .Where(x =>
                    x.RoomId == roomId &&
                    x.BillingMonth.HasValue &&
                    x.BillingMonth.Value < month &&
                    x.ReplacedByInvoiceId == null)
                .OrderByDescending(x => x.BillingMonth)
                .ThenByDescending(x => x.InvoiceId)
                .FirstOrDefaultAsync();
        }

        public async Task<List<Invoice>> GetUnpaidAsync(DateOnly? month = null)
        {
            var query = _context.Invoices
                .Include(x => x.Room)
                .Where(x => x.Status == "unpaid" && x.ReplacedByInvoiceId == null);

            if (month.HasValue)
                query = query.Where(x => x.BillingMonth == month.Value);

            return await query
                .OrderBy(x => x.RoomId)
                .ToListAsync();
        }

        public async Task<Invoice?> GetByPaymentCodeAsync(string paymentCode)
        {
            var normalized = paymentCode.Trim();
            return await _context.Invoices
                .Include(x => x.Room)
                .FirstOrDefaultAsync(x => x.PaymentCode == normalized && x.ReplacedByInvoiceId == null);
        }

        public async Task<bool> PaymentCodeExistsAsync(string paymentCode)
        {
            var normalized = paymentCode.Trim();
            if (string.IsNullOrWhiteSpace(normalized))
                return false;

            return await _context.Invoices.AnyAsync(x => x.PaymentCode == normalized);
        }

        public async Task AddAsync(Invoice invoice)
        {
            await _context.Invoices.AddAsync(invoice);
        }

        public void Update(Invoice invoice)
        {
            _context.Invoices.Update(invoice);
        }

        public async Task<bool> DeleteAsync(int invoiceId)
        {
            var invoice = await GetByIdAsync(invoiceId);
            if (invoice == null)
                return false;

            _context.Invoices.Remove(invoice);
            return true;
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
