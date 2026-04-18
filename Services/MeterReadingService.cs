using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class MeterReadingService : IMeterReadingService
    {
        private readonly IMeterReadingRepository _meterRepo;
        private readonly IContractRepository _contractRepo;
        private readonly IRoomRepository _roomRepo;
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IMeterReadingImageReader _meterReadingImageReader;

        private const decimal ELECTRIC_PRICE = 3500;

        public MeterReadingService(
            IMeterReadingRepository meterRepo,
            IContractRepository contractRepo,
            IRoomRepository roomRepo,
            IInvoiceRepository invoiceRepo,
            IMeterReadingImageReader meterReadingImageReader)
        {
            _meterRepo = meterRepo;
            _contractRepo = contractRepo;
            _roomRepo = roomRepo;
            _invoiceRepo = invoiceRepo;
            _meterReadingImageReader = meterReadingImageReader;
        }

        public async Task<List<MeterReadingDto>> GetAllAsync(int? roomId = null, DateOnly? month = null)
        {
            var data = await _meterRepo.GetAllAsync(roomId, month);
            return data.Select(MapToDto).ToList();
        }

        public async Task<MeterReadingDto> CreateAsync(CreateMeterReadingDto dto)
        {
            var contract = await _contractRepo.GetActiveByRoomIdAsync(dto.RoomId);
            if (contract == null)
            {
                throw new InvalidOperationException("Hợp đồng không hợp lệ.");
            }

            if (dto.ContractId != contract.ContractId)
            {
                throw new InvalidOperationException("Há»£p Ä‘á»“ng ghi chá»‰ sá»‘ khÃ´ng cÃ²n hiá»‡u lá»±c.");
            }

            var normalizedBillingMonth = NormalizeMonth(dto.BillingMonth);
            var existing = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, normalizedBillingMonth);
            if (existing != null)
            {
                throw new InvalidOperationException("Đã nhập điện cho tháng này.");
            }

            var last = await _meterRepo.GetLatestByRoomAsync(dto.RoomId);
            var previous = last?.CurrentReading ?? 0;

            if (dto.CurrentReading < previous)
            {
                throw new InvalidOperationException("Số điện mới không hợp lệ.");
            }

            var consumed = dto.CurrentReading - previous;
            var amount = consumed * ELECTRIC_PRICE;

            var meter = new MeterReading
            {
                RoomId = contract.RoomId,
                ContractId = contract.ContractId,
                BillingMonth = ResolveMonthlyReadingDate(normalizedBillingMonth),
                PreviousReading = previous,
                CurrentReading = dto.CurrentReading,
                ConsumedUnits = consumed,
                UnitPrice = ELECTRIC_PRICE,
                Amount = amount,
                CreatedAt = DateTime.UtcNow,
                Room = contract.Room
            };

            await _meterRepo.AddAsync(meter);
            await _meterRepo.SaveChangesAsync();

            return MapToDto(meter);
        }

        public async Task<MeterReadingPreviewDto> PreviewAsync(CreateMeterReadingDto dto)
        {
            var contract = await _contractRepo.GetActiveByRoomIdAsync(dto.RoomId);
            if (contract == null)
            {
                throw new InvalidOperationException("Hợp đồng không hợp lệ.");
            }

            if (dto.ContractId != contract.ContractId)
            {
                throw new InvalidOperationException("Há»£p Ä‘á»“ng ghi chá»‰ sá»‘ khÃ´ng cÃ²n hiá»‡u lá»±c.");
            }

            var normalizedBillingMonth = NormalizeMonth(dto.BillingMonth);
            var existing = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, normalizedBillingMonth);
            if (existing != null)
            {
                throw new InvalidOperationException("Đã có dữ liệu tháng này.");
            }

            var last = await _meterRepo.GetLatestByRoomAsync(dto.RoomId);
            var previous = last?.CurrentReading ?? 0;

            if (dto.CurrentReading < previous)
            {
                throw new InvalidOperationException("Số điện không hợp lệ.");
            }

            var consumed = dto.CurrentReading - previous;
            var amount = consumed * ELECTRIC_PRICE;

            return new MeterReadingPreviewDto
            {
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                ContractId = contract.ContractId,
                BillingMonth = normalizedBillingMonth,
                PreviousReading = previous,
                CurrentReading = dto.CurrentReading,
                ConsumedUnits = consumed,
                UnitPrice = ELECTRIC_PRICE,
                Amount = amount
            };
        }

        public async Task<List<MeterReadingDto>> UpdateOriginalReadingAsync(UpdateOriginalMeterReadingDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.RoomCode))
                throw new ArgumentException("RoomCode không hợp lệ.");

            var room = await _roomRepo.GetByRoomCodeAsync(dto.RoomCode);
            if (room == null)
                throw new InvalidOperationException("Không tìm thấy phòng theo roomCode.");

            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var readings = await _meterRepo.GetByRoomFromMonthAsync(room.RoomId, billingMonth);
            if (!readings.Any())
                throw new InvalidOperationException("Không tìm thấy chỉ số điện từ tháng cần sửa.");

            var monthReadings = readings
                .Where(x => SameMonth(x.BillingMonth, billingMonth))
                .OrderBy(x => x.BillingMonth)
                .ToList();

            var target = dto.MeterReadingId.HasValue
                ? monthReadings.FirstOrDefault(x => x.MeterReadingId == dto.MeterReadingId.Value)
                : monthReadings.OrderByDescending(x => x.BillingMonth).FirstOrDefault();
            if (target == null)
                throw new InvalidOperationException("Không tìm thấy chỉ số điện của tháng cần sửa.");

            var previousReading = await _meterRepo.GetLatestBeforeDateAsync(room.RoomId, target.BillingMonth);
            var runningPrevious = previousReading?.CurrentReading ?? 0;

            foreach (var reading in readings)
            {
                var desiredCurrentReading = reading.MeterReadingId == target.MeterReadingId
                    ? dto.CurrentReading
                    : reading.CurrentReading;

                if (desiredCurrentReading < runningPrevious)
                {
                    throw new InvalidOperationException(
                        $"Số điện tháng {reading.BillingMonth:yyyy-MM} không hợp lệ vì nhỏ hơn chỉ số tháng trước.");
                }

                reading.PreviousReading = runningPrevious;
                reading.CurrentReading = desiredCurrentReading;
                reading.ConsumedUnits = desiredCurrentReading - runningPrevious;
                reading.UnitPrice = ELECTRIC_PRICE;
                reading.Amount = reading.ConsumedUnits * reading.UnitPrice;

                runningPrevious = desiredCurrentReading;
            }

            _meterRepo.UpdateRange(readings);
            await _meterRepo.SaveChangesAsync();

            if (target.ContractId.HasValue)
            {
                await SyncInvoiceElectricityAsync(target.ContractId.Value, billingMonth, target.Amount);
            }

            return readings.Select(MapToDto).ToList();
        }

        public async Task<DeleteMeterReadingsByEndedContractDto?> DeleteByEndedContractAsync(int contractId)
        {
            var contract = await _contractRepo.GetByIdAsync(contractId);
            if (contract == null)
            {
                return null;
            }

            if (!HasStatus(contract, "ended"))
            {
                throw new InvalidOperationException("Chỉ được xóa chỉ số điện của hợp đồng đã chấm dứt.");
            }

            var meterReadings = await _meterRepo.GetByContractIdAsync(contractId);
            var deletedCount = meterReadings.Count;

            if (deletedCount > 0)
            {
                _meterRepo.DeleteRange(meterReadings);
                await _meterRepo.SaveChangesAsync();
            }

            return new DeleteMeterReadingsByEndedContractDto
            {
                ContractId = contract.ContractId,
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                DeletedCount = deletedCount
            };
        }

        public async Task<bool> DeleteAsync(int meterReadingId)
        {
            var target = await _meterRepo.GetByIdAsync(meterReadingId);
            if (target == null)
            {
                return false;
            }

            var month = NormalizeMonth(target.BillingMonth);
            var readings = await _meterRepo.GetByRoomFromMonthAsync(target.RoomId, month);
            var remainingReadings = readings
                .Where(x => x.MeterReadingId != meterReadingId)
                .OrderBy(x => x.BillingMonth)
                .ToList();

            var previousReading = await _meterRepo.GetLatestBeforeDateAsync(target.RoomId, target.BillingMonth);
            var runningPrevious = previousReading?.CurrentReading ?? 0;
            var changedReadings = new List<MeterReading>();

            foreach (var reading in remainingReadings)
            {
                if (reading.CurrentReading < runningPrevious)
                {
                    throw new InvalidOperationException(
                        $"Không thể xóa vì sẽ làm mốc {reading.BillingMonth:dd/MM/yyyy} nhỏ hơn chỉ số trước đó.");
                }

                if (reading.PreviousReading != runningPrevious || reading.ConsumedUnits != reading.CurrentReading - runningPrevious)
                {
                    reading.PreviousReading = runningPrevious;
                    reading.ConsumedUnits = reading.CurrentReading - runningPrevious;
                    reading.UnitPrice = ELECTRIC_PRICE;
                    reading.Amount = reading.ConsumedUnits * reading.UnitPrice;
                    changedReadings.Add(reading);
                }

                runningPrevious = reading.CurrentReading;
            }

            if (changedReadings.Count > 0)
            {
                _meterRepo.UpdateRange(changedReadings);
            }

            _meterRepo.Delete(target);
            await _meterRepo.SaveChangesAsync();

            if (target.ContractId.HasValue)
            {
                await SyncInvoiceElectricityAsync(target.ContractId.Value, month, 0);
            }

            foreach (var reading in changedReadings)
            {
                if (reading.ContractId.HasValue)
                {
                    await SyncInvoiceElectricityAsync(reading.ContractId.Value, NormalizeMonth(reading.BillingMonth), reading.Amount);
                }
            }

            return true;
        }

        public Task<MeterReadingImageResultDto> ReadFromImageAsync(IFormFile file)
            => _meterReadingImageReader.ReadAsync(file);

        public async Task<List<MissingMeterDto>> GetMissingAsync(DateOnly month)
        {
            var activeContracts = await _contractRepo.GetAllAsync("active", null);
            var readings = await _meterRepo.GetAllAsync(null, month);

            var contractIdsWithReading = readings
                .Where(r => r.ContractId.HasValue)
                .Select(r => r.ContractId!.Value)
                .ToHashSet();

            var missing = activeContracts
                .Where(c => !contractIdsWithReading.Contains(c.ContractId))
                .Select(c => new MissingMeterDto
                {
                    RoomId = c.RoomId,
                    RoomCode = c.Room?.RoomCode ?? string.Empty
                })
                .ToList();

            return missing;
        }

        private static DateOnly NormalizeMonth(DateOnly value)
        {
            return new DateOnly(value.Year, value.Month, 1);
        }

        private static DateOnly ResolveMonthlyReadingDate(DateOnly billingMonth)
        {
            return new DateOnly(billingMonth.Year, billingMonth.Month, 1)
                .AddMonths(1)
                .AddDays(-1);
        }

        private static bool SameMonth(DateOnly left, DateOnly right)
        {
            return left.Year == right.Year && left.Month == right.Month;
        }

        private async Task SyncInvoiceElectricityAsync(int contractId, DateOnly billingMonth, decimal electricityAmount)
        {
            var invoice = await _invoiceRepo.GetByContractAndMonthAsync(contractId, billingMonth);
            if (invoice == null)
                return;

            invoice.ElectricityFee = electricityAmount;
            invoice.TotalAmount = invoice.RoomFee
                + invoice.ElectricityFee
                + invoice.WaterFee
                + invoice.TrashFee
                + invoice.DebtAmount
                - invoice.DiscountAmount;

            if (invoice.TotalAmount < 0)
                invoice.TotalAmount = 0;

            invoice.UpdatedAt = DateTime.UtcNow;
            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();
        }

        private static bool HasStatus(Contract contract, string expectedStatus)
        {
            return string.Equals(contract.Status?.Trim(), expectedStatus, StringComparison.OrdinalIgnoreCase);
        }

        private static MeterReadingDto MapToDto(MeterReading m)
        {
            return new MeterReadingDto
            {
                MeterReadingId = m.MeterReadingId,
                RoomId = m.RoomId,
                RoomCode = m.Room?.RoomCode ?? m.Contract?.Room?.RoomCode ?? string.Empty,
                ContractId = m.ContractId,
                BillingMonth = m.BillingMonth,
                PreviousReading = m.PreviousReading,
                CurrentReading = m.CurrentReading,
                ConsumedUnits = m.ConsumedUnits,
                UnitPrice = m.UnitPrice,
                Amount = m.Amount,
                CreatedAt = m.CreatedAt
            };
        }
    }
}
