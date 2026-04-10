using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;

namespace NhaTro.Repositories
{
    public class TenantRepository : ITenantRepository
    {
        private readonly NhaTroDbContext _context;

        public TenantRepository(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task<List<Tenant>> GetAllAsync()
        {
            return await _context.Tenants
                .OrderBy(t => t.FullName)
                .ToListAsync();
        }

        public async Task<Tenant?> GetByIdAsync(int tenantId)
        {
            return await _context.Tenants
                .FirstOrDefaultAsync(t => t.TenantId == tenantId);
        }

        public async Task AddAsync(Tenant tenant)
        {
            await _context.Tenants.AddAsync(tenant);
        }

        public void Update(Tenant tenant)
        {
            _context.Tenants.Update(tenant);
        }

        public void Delete(Tenant tenant)
        {
            _context.Tenants.Remove(tenant);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}