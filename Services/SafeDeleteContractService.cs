using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class SafeDeleteContractService : IContractService
    {
        private readonly ContractService _inner;
        private readonly IContractRepository _contractRepository;
        private readonly IInvoiceRepository _invoiceRepository;
        private readonly IMeterReadingRepository _meterReadingRepository;
        private readonly IDepositSettlementRepository _depositSettlementRepository;

        public SafeDeleteContractService(
            ContractService inner,
            IContractRepository contractRepository,
            IInvoiceRepository invoiceRepository,
            IMeterReadingRepository meterReadingRepository,
            IDepositSettlementRepository depositSettlementRepository)
        {
            _inner = inner;
            _contractRepository = contractRepository;
            _invoiceRepository = invoiceRepository;
            _meterReadingRepository = meterReadingRepository;
            _depositSettlementRepository = depositSettlementRepository;
        }

        public Task<List<ContractDto>> GetAllAsync(string? status = null, int? roomId = null)
            => _inner.GetAllAsync(status, roomId);

        public Task<ContractDto?> GetByIdAsync(int contractId)
            => _inner.GetByIdAsync(contractId);

        public Task<ContractDto> CreateAsync(CreateContractDto dto)
            => _inner.CreateAsync(dto);

        public Task<ContractDto?> UpdateAsync(int contractId, UpdateContractDto dto)
            => _inner.UpdateAsync(contractId, dto);

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

            var snapshotJson = BuildContractSnapshotJson(contract);

            // Bước 1: Lưu snapshot vào tất cả dữ liệu liên quan TRƯỚC khi xóa contract.
            // Phải SaveChangesAsync() tại đây để đảm bảo snapshot được ghi vào DB
            // trước khi EF thực hiện xóa contract (OnDelete SetNull sẽ clear ContractId).
            var relatedInvoices = await _invoiceRepository.GetByContractIdAsync(contractId);
            foreach (var invoice in relatedInvoices)
            {
                if (string.IsNullOrWhiteSpace(invoice.ContractSnapshotJson))
                {
                    invoice.ContractSnapshotJson = snapshotJson;
                }

                _invoiceRepository.Update(invoice);
            }

            var relatedMeterReadings = await _meterReadingRepository.GetByContractIdAsync(contractId);
            if (relatedMeterReadings.Count > 0)
            {
                foreach (var meterReading in relatedMeterReadings)
                {
                    if (string.IsNullOrWhiteSpace(meterReading.ContractSnapshotJson))
                    {
                        meterReading.ContractSnapshotJson = snapshotJson;
                    }
                }

                _meterReadingRepository.UpdateRange(relatedMeterReadings);
            }

            var relatedSettlement = await _depositSettlementRepository.GetByContractIdAsync(contractId);
            if (relatedSettlement != null)
            {
                if (string.IsNullOrWhiteSpace(relatedSettlement.ContractSnapshotJson))
                {
                    relatedSettlement.ContractSnapshotJson = snapshotJson;
                }

                _depositSettlementRepository.Update(relatedSettlement);
            }

            // Lưu snapshot trước - bước này phải tách riêng khỏi bước xóa contract
            await _contractRepository.SaveChangesAsync();

            // Bước 2: Sau khi snapshot đã được lưu an toàn, mới tiến hành xóa contract
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

        public Task<ContractEndPreviewDto> EndPreviewAsync(int contractId, ContractEndPreviewRequestDto dto)
            => _inner.EndPreviewAsync(contractId, dto);

        public Task<ContractDto?> EndAsync(int contractId, ContractEndExecuteDto dto)
            => _inner.EndAsync(contractId, dto);

        public Task<ContractDto?> GetActiveByRoomCodeAsync(string roomCode)
            => _inner.GetActiveByRoomCodeAsync(roomCode);

        private static string BuildContractSnapshotJson(Contract contract)
        {
            return JsonSerializer.Serialize(new
            {
                contractId = contract.ContractId,
                roomId = contract.RoomId,
                roomCode = contract.Room?.RoomCode,
                tenantId = contract.TenantId,
                tenantName = contract.Tenant?.FullName,
                startDate = contract.StartDate,
                expectedEndDate = contract.ExpectedEndDate,
                actualEndDate = contract.ActualEndDate,
                depositAmount = contract.DepositAmount,
                occupantCount = contract.OccupantCount,
                actualRoomPrice = contract.ActualRoomPrice,
                status = contract.Status,
                capturedAt = DateTime.UtcNow
            });
        }
    }
}