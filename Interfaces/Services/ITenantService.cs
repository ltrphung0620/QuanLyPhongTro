using NhaTro.Dtos.Tenants;

namespace NhaTro.Interfaces.Services
{
    public interface ITenantService
    {
        Task<List<TenantDto>> GetAllAsync();
        Task<TenantDto?> GetByIdAsync(int tenantId);
        Task<TenantDto> CreateAsync(CreateTenantDto dto);
        Task<TenantDto?> UpdateAsync(int tenantId, UpdateTenantDto dto);
    }
}