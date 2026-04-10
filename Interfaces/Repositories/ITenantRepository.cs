using NhaTro.Models;

namespace NhaTro.Interfaces.Repositories
{
    public interface ITenantRepository
    {
        Task<List<Tenant>> GetAllAsync();
        Task<Tenant?> GetByIdAsync(int tenantId);
        Task AddAsync(Tenant tenant);
        void Update(Tenant tenant);
        void Delete(Tenant tenant);
        Task<bool> SaveChangesAsync();
    }
}