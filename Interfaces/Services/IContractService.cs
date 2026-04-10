using NhaTro.Dtos.Contracts;

namespace NhaTro.Interfaces.Services
{
    public interface IContractService
    {
        Task<List<ContractDto>> GetAllAsync(string? status = null, int? roomId = null);
        Task<ContractDto?> GetByIdAsync(int contractId);
        Task<ContractDto> CreateAsync(CreateContractDto dto);
        Task<ContractDto?> UpdateAsync(int contractId, UpdateContractDto dto);
        Task<bool> DeleteEndedAsync(int contractId);
        Task<ContractEndPreviewDto> EndPreviewAsync(int contractId, ContractEndPreviewRequestDto dto);
        Task<ContractDto?> EndAsync(int contractId, ContractEndExecuteDto dto);
        Task<ContractDto?> GetActiveByRoomCodeAsync(string roomCode);
    }
}
