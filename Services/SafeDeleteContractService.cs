using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class SafeDeleteContractService : IContractService
    {
        private readonly ContractService _inner;

        public SafeDeleteContractService(ContractService inner)
        {
            _inner = inner;
        }

        public Task<List<ContractDto>> GetAllAsync(string? status = null, int? roomId = null, bool includeArchived = false)
            => _inner.GetAllAsync(status, roomId, includeArchived);

        public Task<ContractDto?> GetByIdAsync(int contractId)
            => _inner.GetByIdAsync(contractId);

        public Task<ContractDto> CreateAsync(CreateContractDto dto)
            => _inner.CreateAsync(dto);

        public Task<ContractDto?> UpdateAsync(int contractId, UpdateContractDto dto)
            => _inner.UpdateAsync(contractId, dto);

        public Task<bool> DeleteEndedAsync(int contractId)
            => _inner.DeleteEndedAsync(contractId);

        public Task<ContractDto?> CancelAsync(int contractId, CancelContractDto dto)
            => _inner.CancelAsync(contractId, dto);

        public Task<ContractEndPreviewDto> EndPreviewAsync(int contractId, ContractEndPreviewRequestDto dto)
            => _inner.EndPreviewAsync(contractId, dto);

        public Task<ContractDto?> EndAsync(int contractId, ContractEndExecuteDto dto)
            => _inner.EndAsync(contractId, dto);

        public Task<ContractDto?> GetActiveByRoomCodeAsync(string roomCode)
            => _inner.GetActiveByRoomCodeAsync(roomCode);
    }
}
