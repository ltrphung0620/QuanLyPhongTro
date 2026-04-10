using NhaTro.Dtos.Tenants;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class TenantService : ITenantService
    {
        private readonly ITenantRepository _tenantRepository;

        public TenantService(ITenantRepository tenantRepository)
        {
            _tenantRepository = tenantRepository;
        }

        public async Task<List<TenantDto>> GetAllAsync()
        {
            var tenants = await _tenantRepository.GetAllAsync();
            return tenants.Select(MapToDto).ToList();
        }

        public async Task<TenantDto?> GetByIdAsync(int tenantId)
        {
            var tenant = await _tenantRepository.GetByIdAsync(tenantId);
            return tenant == null ? null : MapToDto(tenant);
        }

        public async Task<TenantDto> CreateAsync(CreateTenantDto dto)
        {
            var tenant = new Tenant
            {
                FullName = dto.FullName.Trim(),
                Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
                CCCD = string.IsNullOrWhiteSpace(dto.CCCD) ? null : dto.CCCD.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _tenantRepository.AddAsync(tenant);
            await _tenantRepository.SaveChangesAsync();

            return MapToDto(tenant);
        }

        public async Task<TenantDto?> UpdateAsync(int tenantId, UpdateTenantDto dto)
        {
            var tenant = await _tenantRepository.GetByIdAsync(tenantId);
            if (tenant == null)
            {
                return null;
            }

            tenant.FullName = dto.FullName.Trim();
            tenant.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
            tenant.CCCD = string.IsNullOrWhiteSpace(dto.CCCD) ? null : dto.CCCD.Trim();
            tenant.UpdatedAt = DateTime.UtcNow;

            _tenantRepository.Update(tenant);
            await _tenantRepository.SaveChangesAsync();

            return MapToDto(tenant);
        }

        private static TenantDto MapToDto(Tenant tenant)
        {
            return new TenantDto
            {
                TenantId = tenant.TenantId,
                FullName = tenant.FullName,
                Phone = tenant.Phone,
                CCCD = tenant.CCCD,
                CreatedAt = tenant.CreatedAt,
                UpdatedAt = tenant.UpdatedAt
            };
        }
    }
}