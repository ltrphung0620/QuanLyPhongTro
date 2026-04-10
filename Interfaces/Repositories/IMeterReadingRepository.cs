using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface IMeterReadingRepository
    {
        Task<List<MeterReading>> GetAllAsync(int? roomId = null, DateOnly? month = null);
        Task<List<MeterReading>> GetByContractIdAsync(int contractId);
        Task<MeterReading?> GetByRoomAndMonthAsync(int roomId, DateOnly billingMonth);
        Task<List<MeterReading>> GetByRoomFromMonthAsync(int roomId, DateOnly billingMonth);
        Task<MeterReading?> GetLatestByRoomAsync(int roomId);
        Task AddAsync(MeterReading meterReading);
        void UpdateRange(IEnumerable<MeterReading> meterReadings);
        void DeleteRange(IEnumerable<MeterReading> meterReadings);
        Task<bool> SaveChangesAsync();
        Task<MeterReading?> GetLatestBeforeMonthAsync(int roomId, DateOnly billingMonth);
    }
}
