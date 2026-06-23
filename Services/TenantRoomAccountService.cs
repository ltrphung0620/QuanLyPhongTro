using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class TenantRoomAccountService : ITenantRoomAccountService
    {
        private const string DefaultPassword = "123456";

        private readonly NhaTroDbContext _context;

        public TenantRoomAccountService(NhaTroDbContext context)
        {
            _context = context;
        }

        public async Task EnsureRoomAccountAsync(Contract contract)
        {
            var room = contract.Room ?? await _context.Rooms
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.RoomId == contract.RoomId);
            var tenant = contract.Tenant ?? await _context.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.TenantId == contract.TenantId);

            if (room == null || tenant == null)
            {
                return;
            }

            var roomUsername = NormalizeRoomUsername(room.RoomCode);
            if (string.IsNullOrWhiteSpace(roomUsername))
            {
                return;
            }

            var account = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Role == "Tenant" && u.TenantId == contract.TenantId);

            var usernameOwner = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Role == "Tenant" && u.Username == roomUsername);

            if (usernameOwner != null && usernameOwner.Id != account?.Id)
            {
                if (usernameOwner.IsActive)
                {
                    throw new InvalidOperationException($"Tài khoản phòng {roomUsername} đang được khách thuê khác sử dụng.");
                }

                ArchiveAccount(usernameOwner);
            }

            if (account == null)
            {
                account = new AppUser
                {
                    Role = "Tenant",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(account);
            }

            account.Username = roomUsername;
            account.Email = BuildRoomEmail(roomUsername, contract.TenantId);
            account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(DefaultPassword);
            account.DisplayName = tenant.FullName;
            account.OrganizationId = contract.OrganizationId;
            account.TenantId = contract.TenantId;
            account.IsActive = true;
            account.MustChangePassword = true;
        }

        public async Task DisableRoomAccountAsync(Contract contract)
        {
            var account = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Role == "Tenant" && u.TenantId == contract.TenantId);

            if (account == null)
            {
                return;
            }

            ArchiveAccount(account);
        }

        private static void ArchiveAccount(AppUser account)
        {
            var suffix = account.Id > 0
                ? account.Id.ToString()
                : Guid.NewGuid().ToString("N")[..8];
            var archivedAt = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

            account.Username = $"{account.Username}__old__{suffix}__{archivedAt}";
            account.Email = $"archived-{suffix}-{archivedAt}@tenant.local";
            account.TenantId = null;
            account.IsActive = false;
            account.MustChangePassword = false;
        }

        private static string NormalizeRoomUsername(string roomCode)
        {
            return Regex.Replace(roomCode.Trim().ToUpperInvariant(), @"\s+", "");
        }

        private static string BuildRoomEmail(string roomUsername, int tenantId)
        {
            var safeRoom = Regex.Replace(roomUsername.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
            if (string.IsNullOrWhiteSpace(safeRoom))
            {
                safeRoom = "room";
            }

            return $"{safeRoom}.tenant.{tenantId}@tenant.local";
        }
    }
}
