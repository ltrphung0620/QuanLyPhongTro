using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using Microsoft.EntityFrameworkCore;
using NhaTro.Utils;

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
        private readonly ITenantRoomAccountService _tenantRoomAccountService;
        private readonly IPricingSettingsService _pricingSettingsService;

        private static readonly HashSet<string> AllowedStatuses = new()
        {
            "active",
            "ended",
            "cancelled"
        };

        public ContractService(
            IContractRepository contractRepository,
            IRoomRepository roomRepository,
            ITenantRepository tenantRepository,
            IMeterReadingRepository meterReadingRepository,
            IInvoiceRepository invoiceRepository,
            IDepositSettlementRepository depositSettlementRepository,
            ITransactionRepository transactionRepository,
            ITenantRoomAccountService tenantRoomAccountService,
            IPricingSettingsService pricingSettingsService)
        {
            _contractRepository = contractRepository;
            _roomRepository = roomRepository;
            _tenantRepository = tenantRepository;
            _meterReadingRepository = meterReadingRepository;
            _invoiceRepository = invoiceRepository;
            _depositSettlementRepository = depositSettlementRepository;
            _transactionRepository = transactionRepository;
            _tenantRoomAccountService = tenantRoomAccountService;
            _pricingSettingsService = pricingSettingsService;
        }

        public async Task<List<ContractDto>> GetAllAsync(string? status = null, int? roomId = null, bool includeArchived = false)
        {
            if (!string.IsNullOrWhiteSpace(status))
            {
                ValidateStatus(status);
            }

            var contracts = await _contractRepository.GetAllAsync(status, roomId, includeArchived);
            return contracts
                .Select(MapToDto)
                .OrderBy(x => RoomCodeSort.GetGroup(x.RoomCode))
                .ThenBy(x => RoomCodeSort.GetNumber(x.RoomCode))
                .ThenBy(x => x.RoomCode)
                .ThenByDescending(x => x.CreatedAt)
                .ToList();
        }

        public async Task<ContractDto?> GetByIdAsync(int contractId)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            return contract == null ? null : MapToDto(contract);
        }

        public async Task<ContractDto> CreateAsync(CreateContractDto dto)
        {
            ValidateContractDates(dto.StartDate, dto.ExpectedEndDate);

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

            var depositPaidAmount = dto.DepositPaidAmount ?? dto.DepositAmount;
            if (depositPaidAmount > dto.DepositAmount)
            {
                throw new InvalidOperationException("Tiền cọc đã nhận không được lớn hơn tiền cọc phải thu.");
            }

            var pricing = await _pricingSettingsService.GetAsync();
            var trashFee = dto.TrashFee ?? pricing.TrashFee;
            if (trashFee < 0)
            {
                throw new InvalidOperationException("Tiền rác không hợp lệ.");
            }

            var contract = new Contract
            {
                RoomId = dto.RoomId,
                TenantId = dto.TenantId,
                StartDate = dto.StartDate,
                ExpectedEndDate = dto.ExpectedEndDate,
                DepositAmount = dto.DepositAmount,
                DepositPaidAmount = depositPaidAmount,
                OccupantCount = dto.OccupantCount,
                ActualRoomPrice = dto.ActualRoomPrice,
                TrashFee = trashFee,
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
            if (createdContract != null)
            {
                await _tenantRoomAccountService.EnsureRoomAccountAsync(createdContract);
                await _contractRepository.SaveChangesAsync();
            }

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

            ValidateContractDates(dto.StartDate, dto.ExpectedEndDate);
            if (dto.StartDate != contract.StartDate && await HasRelatedBusinessDataAsync(contract.ContractId))
            {
                throw new InvalidOperationException("Không thể đổi ngày bắt đầu vì hợp đồng đã phát sinh chỉ số, hóa đơn hoặc quyết toán.");
            }

            var depositChanged = dto.DepositAmount != contract.DepositAmount
                || (dto.DepositPaidAmount.HasValue && dto.DepositPaidAmount.Value != contract.DepositPaidAmount);
            if (depositChanged && (await _invoiceRepository.GetByContractIdAsync(contract.ContractId)).Count > 0)
            {
                throw new InvalidOperationException("Không thể đổi tiền cọc vì hợp đồng đã phát sinh hóa đơn. Hãy điều chỉnh công nợ trên hóa đơn nếu cần.");
            }

            contract.StartDate = dto.StartDate;
            contract.ExpectedEndDate = dto.ExpectedEndDate;
            var depositPaidAmount = dto.DepositPaidAmount ?? contract.DepositPaidAmount;
            if (depositPaidAmount > dto.DepositAmount)
            {
                throw new InvalidOperationException("Tiền cọc đã nhận không được lớn hơn tiền cọc phải thu.");
            }

            if (dto.TrashFee.HasValue && dto.TrashFee.Value < 0)
            {
                throw new InvalidOperationException("Tiền rác không hợp lệ.");
            }

            contract.DepositAmount = dto.DepositAmount;
            contract.DepositPaidAmount = depositPaidAmount;
            contract.OccupantCount = dto.OccupantCount;
            contract.ActualRoomPrice = dto.ActualRoomPrice;
            if (dto.TrashFee.HasValue)
            {
                contract.TrashFee = dto.TrashFee.Value;
            }
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

            if (contract.IsArchived)
            {
                return true;
            }

            if (!HasStatus(contract, "ended") && !HasStatus(contract, "cancelled"))
            {
                throw new InvalidOperationException("Chỉ được lưu trữ hợp đồng đã kết thúc hoặc đã hủy. Nếu tạo nhầm hợp đồng đang hiệu lực, hãy hủy hợp đồng trước.");
            }

            ArchiveContract(contract, "Lưu trữ hợp đồng khỏi danh sách chính.");
            _contractRepository.Update(contract);
            await _contractRepository.SaveChangesAsync();
            return true;
        }

        public async Task<ContractDto?> CancelAsync(int contractId, CancelContractDto dto)
        {
            var contract = await _contractRepository.GetByIdAsync(contractId);
            if (contract == null)
            {
                return null;
            }

            if (!HasStatus(contract, "active"))
            {
                throw new InvalidOperationException("Chỉ được hủy hợp đồng đang hiệu lực.");
            }

            if (await HasRelatedBusinessDataAsync(contract.ContractId))
            {
                throw new InvalidOperationException("Hợp đồng đã phát sinh hóa đơn, chỉ số điện hoặc quyết toán cọc nên không thể hủy. Hãy dùng chức năng kết thúc hợp đồng.");
            }

            contract.Status = "cancelled";
            contract.ArchiveReason = string.IsNullOrWhiteSpace(dto.Reason)
                ? "Hủy hợp đồng chưa phát sinh dữ liệu."
                : dto.Reason.Trim();
            contract.UpdatedAt = DateTime.UtcNow;
            _contractRepository.Update(contract);
            await _tenantRoomAccountService.DisableRoomAccountAsync(contract);

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

            var monthStart = new DateOnly(dto.ActualEndDate.Year, dto.ActualEndDate.Month, 1);
            var fromDate = contract.StartDate > monthStart ? contract.StartDate : monthStart;
            int numberOfDays = dto.ActualEndDate.DayNumber - fromDate.DayNumber + 1;
            if (numberOfDays <= 0)
            {
                throw new InvalidOperationException("Số ngày ở không hợp lệ.");
            }

            var daysInMonth = DateTime.DaysInMonth(dto.ActualEndDate.Year, dto.ActualEndDate.Month);
            var roomFee = Math.Round((contract.ActualRoomPrice / daysInMonth) * numberOfDays, 2);
            var pricing = await _pricingSettingsService.GetAsync();

            decimal electricityFee = 0;
            if (dto.CurrentReading.HasValue)
            {
                var latestReading = await _meterReadingRepository.GetLatestBeforeDateAsync(contract.RoomId, dto.ActualEndDate);
                var previousReading = latestReading?.CurrentReading ?? 0;

                if (dto.CurrentReading.Value < previousReading)
                {
                    throw new InvalidOperationException("Số điện mới không hợp lệ.");
                }

                var consumed = dto.CurrentReading.Value - previousReading;
                electricityFee = consumed * pricing.ElectricityUnitPrice;
            }

            var waterFee = Math.Round((pricing.WaterFeePerPerson / daysInMonth) * numberOfDays * contract.OccupantCount, 2);
            var trashFee = contract.TrashFee;

            var finalInvoiceAmount = roomFee + electricityFee + waterFee + trashFee;

            var receivedDepositAmount = await GetReceivedDepositAmountAsync(contract);
            var deductedAmount = Math.Min(receivedDepositAmount, finalInvoiceAmount);
            var refundedAmount = receivedDepositAmount - deductedAmount;
            var remainingAmount = finalInvoiceAmount - deductedAmount;

            return new ContractEndPreviewDto
            {
                ContractId = contract.ContractId,
                RoomId = contract.RoomId,
                RoomCode = contract.Room?.RoomCode ?? string.Empty,
                TenantId = contract.TenantId,
                TenantName = contract.Tenant?.FullName ?? string.Empty,
                StartDate = contract.StartDate,
                FromDate = fromDate,
                ActualEndDate = dto.ActualEndDate,
                NumberOfDays = numberOfDays,
                RoomFee = roomFee,
                ElectricityFee = electricityFee,
                WaterFee = waterFee,
                TrashFee = trashFee,
                FinalInvoiceAmount = finalInvoiceAmount,
                DepositAmount = receivedDepositAmount,
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
                var electricPrice = (await _pricingSettingsService.GetAsync()).ElectricityUnitPrice;
                var existingMeter = await _meterReadingRepository.GetByContractAndMonthAsync(contract.ContractId, dto.ActualEndDate);
                var latestReading = await _meterReadingRepository.GetLatestBeforeDateAsync(contract.RoomId, dto.ActualEndDate);
                var previousReading = latestReading?.CurrentReading ?? 0;
                var consumedUnits = dto.CurrentReading.Value - previousReading;

                if (consumedUnits < 0)
                {
                    throw new InvalidOperationException("Số điện mới không hợp lệ.");
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
                        UnitPrice = electricPrice,
                        Amount = consumedUnits * electricPrice,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    existingMeter.BillingMonth = dto.ActualEndDate;
                    existingMeter.PreviousReading = previousReading;
                    existingMeter.CurrentReading = dto.CurrentReading.Value;
                    existingMeter.ConsumedUnits = consumedUnits;
                    existingMeter.UnitPrice = electricPrice;
                    existingMeter.Amount = consumedUnits * electricPrice;
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
                    FromDate = preview.FromDate,
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
                DepositAmount = preview.DepositAmount,
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
                    ItemName = $"Hoàn cọc hợp đồng phòng {contract.Room?.RoomCode}",
                    Amount = preview.RefundedAmount,
                    TransactionDate = dto.ActualEndDate,
                    Description = $"Hoàn lại tiền cọc cho khách thuê khi kết thúc hợp đồng. Tổng phí cuối: {preview.FinalInvoiceAmount:N0}, cọc: {preview.DepositAmount:N0}.",
                    RelatedRoomId = contract.RoomId,
                    RelatedInvoice = finalInvoice,
                    CreatedAt = DateTime.UtcNow
                };

                await _transactionRepository.AddAsync(refundTransaction);
            }

            contract.ActualEndDate = dto.ActualEndDate;
            contract.Status = "ended";
            contract.UpdatedAt = DateTime.UtcNow;
            _contractRepository.Update(contract);
            await _tenantRoomAccountService.DisableRoomAccountAsync(contract);

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
                throw new ArgumentException("Status chỉ được là 'active', 'ended' hoặc 'cancelled'.");
            }
        }

        private static void ValidateContractDates(DateOnly startDate, DateOnly? expectedEndDate)
        {
            if (expectedEndDate.HasValue && expectedEndDate.Value < startDate)
            {
                throw new InvalidOperationException("Ngày kết thúc dự kiến không được trước ngày bắt đầu hợp đồng.");
            }
        }

        private async Task<bool> HasRelatedBusinessDataAsync(int contractId)
        {
            var invoices = await _invoiceRepository.GetByContractIdAsync(contractId);
            if (invoices.Count > 0)
            {
                return true;
            }

            var meterReadings = await _meterReadingRepository.GetByContractIdAsync(contractId);
            if (meterReadings.Count > 0)
            {
                return true;
            }

            var settlement = await _depositSettlementRepository.GetByContractIdAsync(contractId);
            return settlement != null;
        }

        private static void ArchiveContract(Contract contract, string reason)
        {
            contract.IsArchived = true;
            contract.ArchivedAt = DateTime.UtcNow;
            contract.ArchiveReason = string.IsNullOrWhiteSpace(contract.ArchiveReason)
                ? reason
                : contract.ArchiveReason;
            contract.UpdatedAt = DateTime.UtcNow;
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
                DepositPaidAmount = contract.DepositPaidAmount,
                OccupantCount = contract.OccupantCount,
                ActualRoomPrice = contract.ActualRoomPrice,
                TrashFee = contract.TrashFee,
                Status = contract.Status,
                IsArchived = contract.IsArchived,
                ArchivedAt = contract.ArchivedAt,
                ArchiveReason = contract.ArchiveReason,
                CreatedAt = contract.CreatedAt,
                UpdatedAt = contract.UpdatedAt
            };
        }

        private async Task<decimal> GetReceivedDepositAmountAsync(Contract contract)
        {
            var invoices = await _invoiceRepository.GetByContractIdAsync(contract.ContractId);
            var collectedFromInvoices = invoices
                .Where(x => x.ReplacedByInvoiceId == null && x.PaidAmount.GetValueOrDefault() > 0)
                .Sum(x => Math.Min(x.DepositDebtAmount, x.PaidAmount.GetValueOrDefault()));

            return Math.Min(contract.DepositAmount, contract.DepositPaidAmount + collectedFromInvoices);
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

        private static bool HasStatus(Contract contract, string expectedStatus)
        {
            return string.Equals(contract.Status?.Trim(), expectedStatus, StringComparison.OrdinalIgnoreCase);
        }
    }
}
