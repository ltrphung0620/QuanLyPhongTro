using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using Microsoft.EntityFrameworkCore;

namespace NhaTro.Services
{
    public class ContractService : IContractService
    {
        private readonly IContractRepository _contractRepository;
        private readonly IRoomRepository _roomRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly IMeterReadingRepository _meterReadingRepository;
        private readonly IInvoiceRepository _invoiceRepository;
        private readonly IDepositSettlementRepository _depositSettlementRepository;
        private readonly ITransactionRepository _transactionRepository;

        private const decimal WATER_PER_PERSON = 50000m;
        private const decimal TRASH_FEE = 30000m;
        private const decimal ELECTRIC_PRICE = 3500m;

        private static readonly HashSet<string> AllowedStatuses = new()
        {
            "active",
            "ended"
        };

        public ContractService(
            IContractRepository contractRepository,
            IRoomRepository roomRepository,
            ITenantRepository tenantRepository,
            IMeterReadingRepository meterReadingRepository,
            IInvoiceRepository invoiceRepository,
            IDepositSettlementRepository depositSettlementRepository,
            ITransactionRepository transactionRepository)
        {
            _contractRepository = contractRepository;
            _roomRepository = roomRepository;
            _tenantRepository = tenantRepository;
            _meterReadingRepository = meterReadingRepository;
            _invoiceRepository = invoiceRepository;
            _depositSettlementRepository = depositSettlementRepository;
            _transactionRepository = transactionRepository;
        }

        public async Task<List<ContractDto>> GetAllAsync(string? status = null, int? roomId = null)
        {
            if (!string.IsNullOrWhiteSpace(status))
            {
                ValidateStatus(status);
            }

            var contracts = await _contractRepository.GetAllAsync(status, roomId);
            return contracts.Select(MapToDto).ToList();
        }

        public async Task<ContractDto?> GetByIdAsync(int contractId)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            return contract == null ? null : MapToDto(contract);
        }

        public async Task<ContractDto> CreateAsync(CreateContractDto dto)
        {
            var room = await _roomRepository.GetByIdAsync(dto.RoomId);
            if (room == null)
            {
                throw new KeyNotFoundException("Không tìm thấy phòng.");
            }

            var tenant = await _tenantRepository.GetByIdAsync(dto.TenantId);
            if (tenant == null)
            {
                throw new KeyNotFoundException("Không tìm thấy người thuê.");
            }

            if (room.Status != "vacant")
            {
                throw new InvalidOperationException("Phòng hiện không ở trạng thái trống.");
            }

            var existingActiveContract = await _contractRepository.GetActiveByRoomIdAsync(dto.RoomId);
            if (existingActiveContract != null)
            {
                throw new InvalidOperationException("Phòng đã có hợp đồng đang hiệu lực.");
            }

            var contract = new Contract
            {
                RoomId = dto.RoomId,
                TenantId = dto.TenantId,
                StartDate = dto.StartDate,
                ExpectedEndDate = dto.ExpectedEndDate,
                DepositAmount = dto.DepositAmount,
                OccupantCount = dto.OccupantCount,
                ActualRoomPrice = dto.ActualRoomPrice,
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _contractRepository.AddAsync(contract);

            room.Status = "occupied";
            room.UpdatedAt = DateTime.UtcNow;
            _roomRepository.Update(room);

            await _contractRepository.SaveChangesAsync();

            var createdContract = await _contractRepository.GetByIdAsync(contract.ContractId);
            return MapToDto(createdContract!);
        }

        public async Task<ContractDto?> UpdateAsync(int contractId, UpdateContractDto dto)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            if (contract == null)
            {
                return null;
            }

            if (!string.Equals(contract.Status?.Trim(), "active", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Chỉ được cập nhật hợp đồng đang hiệu lực.");
            }

            contract.StartDate = dto.StartDate;
            contract.ExpectedEndDate = dto.ExpectedEndDate;
            contract.DepositAmount = dto.DepositAmount;
            contract.OccupantCount = dto.OccupantCount;
            contract.ActualRoomPrice = dto.ActualRoomPrice;
            contract.UpdatedAt = DateTime.UtcNow;

            _contractRepository.Update(contract);
            await _contractRepository.SaveChangesAsync();

            var updatedContract = await _contractRepository.GetByIdAsync(contract.ContractId);
            return MapToDto(updatedContract!);
        }

        public async Task<bool> DeleteEndedAsync(int contractId)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            if (contract == null)
            {
                return false;
            }

            if (!string.Equals(contract.Status?.Trim(), "ended", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Chỉ được xóa hợp đồng đã chấm dứt.");
            }

            try
            {
                _contractRepository.Delete(contract);
                await _contractRepository.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateException)
            {
                throw new InvalidOperationException("Hợp đồng đã có dữ liệu liên quan nên chưa thể xóa.");
            }
        }

        public async Task<ContractEndPreviewDto> EndPreviewAsync(int contractId, ContractEndPreviewRequestDto dto)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            if (contract == null)
            {
                throw new KeyNotFoundException("Không tìm thấy hợp đồng.");
            }

            if (!string.Equals(contract.Status?.Trim(), "active", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Hợp đồng không còn hiệu lực.");
            }

            if (dto.ActualEndDate < contract.StartDate)
            {
                throw new InvalidOperationException("Ngày kết thúc không hợp lệ.");
            }

            int numberOfDays = dto.ActualEndDate.Day;
            if (numberOfDays <= 0)
            {
                throw new InvalidOperationException("Số ngày ở không hợp lệ.");
            }

            var roomFee = Math.Round((contract.ActualRoomPrice / 30m) * numberOfDays, 2);

            decimal electricityFee = 0;
            if (dto.CurrentReading.HasValue)
            {
                var latestReading = await _meterReadingRepository.GetLatestByRoomAsync(contract.RoomId);
                var previousReading = latestReading?.CurrentReading ?? 0;

                if (dto.CurrentReading.Value < previousReading)
                {
                    throw new InvalidOperationException("Số điện mới không hợp lệ.");
                }

                var consumed = dto.CurrentReading.Value - previousReading;
                electricityFee = consumed * ELECTRIC_PRICE;
            }

            var waterFee = Math.Round((WATER_PER_PERSON / 30m) * numberOfDays * contract.OccupantCount, 2);
            var trashFee = TRASH_FEE;

            var finalInvoiceAmount = roomFee + electricityFee + waterFee + trashFee;

            var deductedAmount = Math.Min(contract.DepositAmount, finalInvoiceAmount);
            var refundedAmount = contract.DepositAmount - deductedAmount;
            var remainingAmount = finalInvoiceAmount - deductedAmount;

            return new ContractEndPreviewDto
            {
                ContractId = contract.ContractId,
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                TenantId = contract.TenantId,
                TenantName = contract.Tenant?.FullName ?? string.Empty,
                StartDate = contract.StartDate,
                ActualEndDate = dto.ActualEndDate,
                NumberOfDays = numberOfDays,
                RoomFee = roomFee,
                ElectricityFee = electricityFee,
                WaterFee = waterFee,
                TrashFee = trashFee,
                FinalInvoiceAmount = finalInvoiceAmount,
                DepositAmount = contract.DepositAmount,
                DeductedAmount = deductedAmount,
                RefundedAmount = refundedAmount,
                RemainingAmount = remainingAmount
            };
        }

        public async Task<ContractDto?> EndAsync(int contractId, ContractEndExecuteDto dto)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            if (contract == null)
            {
                return null;
            }

            if (!string.Equals(contract.Status?.Trim(), "active", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Hợp đồng không còn hiệu lực.");
            }

            var preview = await EndPreviewAsync(contractId, new ContractEndPreviewRequestDto
            {
                ActualEndDate = dto.ActualEndDate,
                CurrentReading = dto.CurrentReading
            });

            if (dto.CurrentReading.HasValue)
            {
                var existingMeter = await _meterReadingRepository.GetByContractAndMonthAsync(contract.ContractId, dto.ActualEndDate);
                var latestReading = await _meterReadingRepository.GetLatestBeforeDateAsync(contract.RoomId, dto.ActualEndDate);
                var previousReading = latestReading?.CurrentReading ?? 0;
                var consumedUnits = dto.CurrentReading.Value - previousReading;

                if (consumedUnits < 0)
                {
                    throw new InvalidOperationException("Sá»‘ Ä‘iá»‡n má»›i khÃ´ng há»£p lá»‡.");
                }

                if (existingMeter == null)
                {
                    await _meterReadingRepository.AddAsync(new MeterReading
                    {
                        RoomId = contract.RoomId,
                        ContractId = contract.ContractId,
                        BillingMonth = dto.ActualEndDate,
                        PreviousReading = previousReading,
                        CurrentReading = dto.CurrentReading.Value,
                        ConsumedUnits = consumedUnits,
                        UnitPrice = ELECTRIC_PRICE,
                        Amount = consumedUnits * ELECTRIC_PRICE,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    existingMeter.BillingMonth = dto.ActualEndDate;
                    existingMeter.PreviousReading = previousReading;
                    existingMeter.CurrentReading = dto.CurrentReading.Value;
                    existingMeter.ConsumedUnits = consumedUnits;
                    existingMeter.UnitPrice = ELECTRIC_PRICE;
                    existingMeter.Amount = consumedUnits * ELECTRIC_PRICE;
                }
            }

            Invoice? finalInvoice = null;
            if (preview.RemainingAmount > 0)
            {
                var noteParts = new List<string>();
                if (!string.IsNullOrWhiteSpace(dto.Note))
                {
                    noteParts.Add(dto.Note.Trim());
                }

                noteParts.Add($"Đã cấn trừ tiền cọc: {preview.DeductedAmount:N0}");

                finalInvoice = new Invoice
                {
                    RoomId = contract.RoomId,
                    ContractId = contract.ContractId,
                    InvoiceType = "final",
                    BillingMonth = new DateOnly(dto.ActualEndDate.Year, dto.ActualEndDate.Month, 1),
                    FromDate = new DateOnly(dto.ActualEndDate.Year, dto.ActualEndDate.Month, 1),
                    ToDate = dto.ActualEndDate,
                    RoomFee = preview.RoomFee,
                    ElectricityFee = preview.ElectricityFee,
                    WaterFee = preview.WaterFee,
                    TrashFee = preview.TrashFee,
                    DiscountAmount = 0,
                    DebtAmount = 0,
                    TotalAmount = preview.RemainingAmount,
                    Status = "unpaid",
                    PaymentCode = await GenerateFinalPaymentCodeAsync(contract.Room?.RoomCode, dto.ActualEndDate),
                    Note = string.Join(" | ", noteParts),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _invoiceRepository.AddAsync(finalInvoice);
            }

            var settlement = new DepositSettlement
            {
                ContractId = contract.ContractId,
                DepositAmount = contract.DepositAmount,
                FinalInvoiceAmount = preview.FinalInvoiceAmount,
                DeductedAmount = preview.DeductedAmount,
                RefundedAmount = preview.RefundedAmount,
                SettledAt = DateTime.UtcNow,
                Note = dto.Note
            };

            await _depositSettlementRepository.AddAsync(settlement);

            if (preview.RefundedAmount > 0)
            {
                var refundTransaction = new Transaction
                {
                    TransactionDirection = "expense",
                    Category = "other",
                    ItemName = $"Hoàn cọc hợp đồng #{contract.ContractId}",
                    Amount = preview.RefundedAmount,
                    TransactionDate = dto.ActualEndDate,
                    Description = $"Hoàn lại tiền cọc cho khách thuê khi kết thúc hợp đồng. Tổng phí cuối: {preview.FinalInvoiceAmount:N0}, cọc: {preview.DepositAmount:N0}.",
                    RelatedInvoice = finalInvoice,
                    CreatedAt = DateTime.UtcNow
                };

                await _transactionRepository.AddAsync(refundTransaction);
            }

            contract.ActualEndDate = dto.ActualEndDate;
            contract.Status = "ended";
            contract.UpdatedAt = DateTime.UtcNow;
            _contractRepository.Update(contract);

            var room = await _roomRepository.GetByIdAsync(contract.RoomId);
            if (room != null)
            {
                room.Status = "vacant";
                room.UpdatedAt = DateTime.UtcNow;
                _roomRepository.Update(room);
            }

            await _contractRepository.SaveChangesAsync();

            var updatedContract = await _contractRepository.GetByIdAsync(contract.ContractId);
            return MapToDto(updatedContract!);
        }

        private static void ValidateStatus(string status)
        {
            var normalizedStatus = status.Trim().ToLower();

            if (!AllowedStatuses.Contains(normalizedStatus))
            {
                throw new ArgumentException("Status chỉ được là 'active' hoặc 'ended'.");
            }
        }

        private async Task<string> GenerateFinalPaymentCodeAsync(string? roomCode, DateOnly actualEndDate)
        {
            var monthPart = actualEndDate.Month.ToString("00");
            var roomPart = SanitizePaymentCodePart(roomCode);
            var baseCode = $"FINAL-{monthPart}-{roomPart}";

            if (!await _invoiceRepository.PaymentCodeExistsAsync(baseCode))
            {
                return baseCode;
            }

            for (var suffix = 2; suffix <= 99; suffix++)
            {
                var candidate = $"{baseCode}-{suffix:00}";
                if (!await _invoiceRepository.PaymentCodeExistsAsync(candidate))
                    return candidate;
            }

            throw new InvalidOperationException("Không thể sinh mã hóa đơn chốt duy nhất. Vui lòng thử lại.");
        }

        private static string SanitizePaymentCodePart(string? value)
        {
            var cleaned = new string((value ?? string.Empty)
                .Trim()
                .ToUpperInvariant()
                .Where(char.IsLetterOrDigit)
                .ToArray());

            return string.IsNullOrWhiteSpace(cleaned) ? "ROOM" : cleaned;
        }

        private static ContractDto MapToDto(Contract contract)
        {
            return new ContractDto
            {
                ContractId = contract.ContractId,
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                TenantId = contract.TenantId,
                TenantName = contract.Tenant?.FullName ?? string.Empty,
                StartDate = contract.StartDate,
                ExpectedEndDate = contract.ExpectedEndDate,
                ActualEndDate = contract.ActualEndDate,
                DepositAmount = contract.DepositAmount,
                OccupantCount = contract.OccupantCount,
                ActualRoomPrice = contract.ActualRoomPrice,
                Status = contract.Status,
                CreatedAt = contract.CreatedAt,
                UpdatedAt = contract.UpdatedAt
            };
        }
        public async Task<ContractDto?> GetActiveByRoomCodeAsync(string roomCode)
        {
            if (string.IsNullOrWhiteSpace(roomCode))
                throw new ArgumentException("RoomCode không hợp lệ.");

            var contract = await _contractRepository.GetActiveByRoomCodeAsync(roomCode);

            if (contract == null)
                return null;

            return MapToDto(contract);
        }
    }
}
