using Microsoft.EntityFrameworkCore;
using Moq;
using NhaTro.Data;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using NhaTro.Services;

namespace NhaTro.Tests;

public class TenantRoomAccountServiceTests
{
    [Fact]
    public async Task EnsureRoomAccountAsync_CreatesAccountUsingRoomCodeAndDefaultPassword()
    {
        await using var context = CreateContext();
        SeedBaseData(context);
        await context.SaveChangesAsync();

        var service = new TenantRoomAccountService(context);
        await service.EnsureRoomAccountAsync(new Contract
        {
            ContractId = 10,
            RoomId = 1,
            TenantId = 2,
            OrganizationId = 1
        });
        await context.SaveChangesAsync();

        var account = await context.Users.IgnoreQueryFilters().SingleAsync(u => u.Role == "Tenant");
        Assert.Equal("A1", account.Username);
        Assert.Equal(2, account.TenantId);
        Assert.True(account.IsActive);
        Assert.True(account.MustChangePassword);
        Assert.True(BCrypt.Net.BCrypt.Verify("123456", account.PasswordHash));
    }

    [Fact]
    public async Task DisableRoomAccountAsync_ArchivesAccountSoRoomCodeCanBeReused()
    {
        await using var context = CreateContext();
        SeedBaseData(context);
        context.Users.Add(new AppUser
        {
            Id = 7,
            Username = "A1",
            Email = "a1.tenant.2@tenant.local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
            DisplayName = "Tenant A",
            Role = "Tenant",
            OrganizationId = 1,
            TenantId = 2,
            IsActive = true,
            MustChangePassword = true
        });
        await context.SaveChangesAsync();

        var service = new TenantRoomAccountService(context);
        await service.DisableRoomAccountAsync(new Contract
        {
            ContractId = 10,
            RoomId = 1,
            TenantId = 2,
            OrganizationId = 1
        });
        await context.SaveChangesAsync();

        var oldAccount = await context.Users.IgnoreQueryFilters().SingleAsync(u => u.Role == "Tenant");
        Assert.False(oldAccount.IsActive);
        Assert.Null(oldAccount.TenantId);
        Assert.StartsWith("A1__old__", oldAccount.Username);

        context.Tenants.Add(new Tenant
        {
            TenantId = 3,
            FullName = "Tenant B",
            AppUserId = 1,
            OrganizationId = 1
        });
        await context.SaveChangesAsync();

        await service.EnsureRoomAccountAsync(new Contract
        {
            ContractId = 11,
            RoomId = 1,
            TenantId = 3,
            OrganizationId = 1
        });
        await context.SaveChangesAsync();

        var newAccount = await context.Users.IgnoreQueryFilters().SingleAsync(u => u.TenantId == 3);
        Assert.Equal("A1", newAccount.Username);
        Assert.True(newAccount.IsActive);
    }

    private static NhaTroDbContext CreateContext()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.SetupGet(x => x.Role).Returns("Admin");
        currentUser.SetupGet(x => x.OrganizationId).Returns(1);

        var options = new DbContextOptionsBuilder<NhaTroDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new NhaTroDbContext(options, currentUser.Object);
    }

    private static void SeedBaseData(NhaTroDbContext context)
    {
        context.Organizations.Add(new Organization
        {
            Id = 1,
            Name = "Org",
            Code = "ORG",
            IsActive = true
        });
        context.Users.Add(new AppUser
        {
            Id = 1,
            Username = "admin",
            Email = "admin@example.com",
            PasswordHash = "hash",
            DisplayName = "Admin",
            Role = "Admin",
            OrganizationId = 1,
            IsActive = true
        });
        context.Rooms.Add(new Room
        {
            RoomId = 1,
            RoomCode = "A1",
            ListedPrice = 2_500_000,
            Status = "vacant",
            AppUserId = 1,
            OrganizationId = 1
        });
        context.Tenants.Add(new Tenant
        {
            TenantId = 2,
            FullName = "Tenant A",
            AppUserId = 1,
            OrganizationId = 1
        });
    }
}
