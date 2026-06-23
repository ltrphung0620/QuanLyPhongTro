using Microsoft.EntityFrameworkCore;
using Moq;
using NhaTro.Data;
using NhaTro.Dtos.Invoices;
using NhaTro.Dtos.TenantDevices;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using NhaTro.Services;

namespace NhaTro.Tests;

public class TenantDeviceNotificationTests
{
    [Fact]
    public async Task RegisterAsync_UsesTenantFromCurrentJwtOnly()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.SetupGet(x => x.Role).Returns("Tenant");
        currentUser.SetupGet(x => x.UserId).Returns(42);
        currentUser.SetupGet(x => x.OrganizationId).Returns(1);
        currentUser.SetupGet(x => x.TenantId).Returns(7);

        await using var context = CreateContext(currentUser.Object);
        var service = new TenantDeviceTokenService(context, currentUser.Object);

        var device = await service.RegisterAsync(new RegisterTenantDeviceTokenDto
        {
            ExpoPushToken = "ExponentPushToken[test]",
            Platform = "android",
            DeviceName = "Tenant phone"
        });

        Assert.Equal(7, device.TenantId);
        Assert.Equal(1, device.OrganizationId);
        Assert.Equal(42, device.AppUserId);
        Assert.True(device.IsActive);
    }

    [Fact]
    public async Task NotifyInvoiceCreatedAsync_SendsOnlyToInvoiceTenant()
    {
        var currentUser = CreateAdminCurrentUser();
        await using var context = CreateContext(currentUser.Object);
        await SeedInvoiceScenarioAsync(context);

        var realtime = new Mock<IRealtimeService>();
        var deviceService = new Mock<ITenantDeviceTokenService>();
        var expo = new Mock<IExpoPushNotificationService>();
        var tenantADevice = new TenantDeviceToken
        {
            TenantId = 10,
            OrganizationId = 1,
            ExpoPushToken = "ExponentPushToken[tenant-a]",
            IsActive = true
        };

        deviceService
            .Setup(x => x.GetActiveTenantDevicesAsync(10, 1))
            .ReturnsAsync(new List<TenantDeviceToken> { tenantADevice });

        var service = new TenantInvoiceNotificationService(
            context,
            realtime.Object,
            deviceService.Object,
            expo.Object);

        await service.NotifyInvoiceCreatedAsync(new InvoiceDto { InvoiceId = 100 });

        realtime.Verify(x => x.PublishToTenantAsync(
            10,
            "tenant.invoice.created",
            It.IsAny<object>(),
            It.IsAny<string[]>()), Times.Once);
        realtime.Verify(x => x.PublishToTenantAsync(
            11,
            It.IsAny<string>(),
            It.IsAny<object>(),
            It.IsAny<string[]>()), Times.Never);
        expo.Verify(x => x.SendAsync(
            It.Is<IReadOnlyCollection<TenantDeviceToken>>(devices =>
                devices.Count == 1 && devices.Single().ExpoPushToken == "ExponentPushToken[tenant-a]"),
            "Hóa đơn mới",
            It.Is<string>(body => body.Contains("06/2026") && body.Contains("2,500,000")),
            It.IsAny<object>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotifyInvoiceCreatedAsync_NoDeviceToken_DoesNotThrow()
    {
        var currentUser = CreateAdminCurrentUser();
        await using var context = CreateContext(currentUser.Object);
        await SeedInvoiceScenarioAsync(context);

        var service = new TenantInvoiceNotificationService(
            context,
            new Mock<IRealtimeService>().Object,
            Mock.Of<ITenantDeviceTokenService>(x =>
                x.GetActiveTenantDevicesAsync(10, 1) == Task.FromResult(new List<TenantDeviceToken>())),
            new Mock<IExpoPushNotificationService>().Object);

        await service.NotifyInvoiceCreatedAsync(new InvoiceDto { InvoiceId = 100 });
    }

    private static NhaTroDbContext CreateContext(ICurrentUserService currentUser)
    {
        var options = new DbContextOptionsBuilder<NhaTroDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new NhaTroDbContext(options, currentUser);
    }

    private static Mock<ICurrentUserService> CreateAdminCurrentUser()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.SetupGet(x => x.Role).Returns("Admin");
        currentUser.SetupGet(x => x.UserId).Returns(1);
        currentUser.SetupGet(x => x.OrganizationId).Returns(1);
        return currentUser;
    }

    private static async Task SeedInvoiceScenarioAsync(NhaTroDbContext context)
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
            RoomId = 20,
            RoomCode = "A1",
            ListedPrice = 2_500_000,
            Status = "occupied",
            AppUserId = 1,
            OrganizationId = 1
        });
        context.Tenants.AddRange(
            new Tenant { TenantId = 10, FullName = "Tenant A", AppUserId = 1, OrganizationId = 1 },
            new Tenant { TenantId = 11, FullName = "Tenant B", AppUserId = 1, OrganizationId = 1 });
        context.Contracts.Add(new Contract
        {
            ContractId = 30,
            RoomId = 20,
            TenantId = 10,
            StartDate = new DateOnly(2026, 6, 1),
            DepositAmount = 2_500_000,
            DepositPaidAmount = 2_500_000,
            OccupantCount = 1,
            ActualRoomPrice = 2_500_000,
            Status = "active",
            AppUserId = 1,
            OrganizationId = 1
        });
        context.Invoices.Add(new Invoice
        {
            InvoiceId = 100,
            RoomId = 20,
            ContractId = 30,
            InvoiceType = "monthly",
            BillingMonth = new DateOnly(2026, 6, 1),
            RoomFee = 2_500_000,
            Status = "unpaid",
            TotalAmount = 2_500_000,
            PaymentCode = "HD-A1-202606",
            AppUserId = 1,
            OrganizationId = 1
        });
        await context.SaveChangesAsync();
    }
}
