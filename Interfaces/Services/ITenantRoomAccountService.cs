using NhaTro.Models;

namespace NhaTro.Interfaces.Services
{
    public interface ITenantRoomAccountService
    {
        Task EnsureRoomAccountAsync(Contract contract);
        Task DisableRoomAccountAsync(Contract contract);
    }
}
