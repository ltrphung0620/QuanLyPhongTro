using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class MeterReadingRepository : IMeterReadingRepository
    {
        private readonly NhaTroDbContext _context;

        public MeterReadingRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<MeterReading>> GetAllAsync(int? roomId = null, DateOnly? month = null)
        {
            var query = _context.MeterReadings
                .Include(x => x.Room)
                .Include(x => x.Contract)
                .AsQueryable();

            if (roomId.HasValue)
                query = query.Where(x => x.RoomId == roomId.Value);

            if (month.HasValue)
            {
                var startOfMonth = new DateOnly(month.Value.Year, month.Value.Month, 1);
                var startOfNextMonth = startOfMonth.AddMonths(1);

                query = query.Where(x => x.BillingMonth >= startOfMonth &&
                                         x.BillingMonth < startOfNextMonth);
            }

            return await query
                .OrderByDescending(x => x.BillingMonth)
                .ToListAsync();
        }

        public async Task<List<MeterReading>> GetByContractIdAsync(int contractId)
        {
            return await _context.MeterReadings
                .Where(x => x.ContractId == contractId)
                .OrderByDescending(x => x.BillingMonth)
                .ToListAsync();
        }

        public async Task<MeterReading?> GetByIdAsync(int meterReadingId)
        {
            return await _context.MeterReadings
                .Include(x => x.Room)
                .Include(x => x.Contract)
                .FirstOrDefaultAsync(x => x.MeterReadingId == meterReadingId);
        }

        public async Task<MeterReading?> GetByRoomAndMonthAsync(int roomId, DateOnly billingMonth)
        {
            var startOfMonth = new DateOnly(billingMonth.Year, billingMonth.Month, 1);
            var startOfNextMonth = startOfMonth.AddMonths(1);

            return await _context.MeterReadings
                .Where(x => x.RoomId == roomId &&
                            x.BillingMonth >= startOfMonth &&
                            x.BillingMonth < startOfNextMonth)
                .OrderByDescending(x => x.BillingMonth)
                .FirstOrDefaultAsync();
        }

        public async Task<MeterReading?> GetByContractAndMonthAsync(int contractId, DateOnly billingMonth)
        {
            var startOfMonth = new DateOnly(billingMonth.Year, billingMonth.Month, 1);
            var startOfNextMonth = startOfMonth.AddMonths(1);

            return await _context.MeterReadings
                .Where(x => x.ContractId == contractId &&
                            x.BillingMonth >= startOfMonth &&
                            x.BillingMonth < startOfNextMonth)
                .OrderByDescending(x => x.BillingMonth)
                .FirstOrDefaultAsync();
        }

        public async Task<List<MeterReading>> GetByRoomFromMonthAsync(int roomId, DateOnly billingMonth)
        {
            var startOfMonth = new DateOnly(billingMonth.Year, billingMonth.Month, 1);

            return await _context.MeterReadings
                .Include(x => x.Room)
                .Include(x => x.Contract)
                .Where(x => x.RoomId == roomId && x.BillingMonth >= startOfMonth)
                .OrderBy(x => x.BillingMonth)
                .ToListAsync();
        }

        public async Task<MeterReading?> GetLatestByRoomAsync(int roomId)
        {
            return await _context.MeterReadings
                .Where(x => x.RoomId == roomId)
                .OrderByDescending(x => x.BillingMonth)
                .FirstOrDefaultAsync();
        }

        public async Task<MeterReading?> GetLatestBeforeMonthAsync(int roomId, DateOnly billingMonth)
        {
            var startOfMonth = new DateOnly(billingMonth.Year, billingMonth.Month, 1);

            return await _context.MeterReadings
                .Where(x => x.RoomId == roomId &&
                            x.BillingMonth < startOfMonth)
                .OrderByDescending(x => x.BillingMonth)
                .FirstOrDefaultAsync();
        }

        public async Task<MeterReading?> GetLatestBeforeDateAsync(int roomId, DateOnly date)
        {
            return await _context.MeterReadings
                .Where(x => x.RoomId == roomId &&
                            x.BillingMonth < date)
                .OrderByDescending(x => x.BillingMonth)
                .FirstOrDefaultAsync();
        }

        public async Task AddAsync(MeterReading meterReading)
        {
            await _context.MeterReadings.AddAsync(meterReading);
        }

        public void UpdateRange(IEnumerable<MeterReading> meterReadings)
        {
            _context.MeterReadings.UpdateRange(meterReadings);
        }

        public void Delete(MeterReading meterReading)
        {
            _context.MeterReadings.Remove(meterReading);
        }

        public void DeleteRange(IEnumerable<MeterReading> meterReadings)
        {
            _context.MeterReadings.RemoveRange(meterReadings);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
