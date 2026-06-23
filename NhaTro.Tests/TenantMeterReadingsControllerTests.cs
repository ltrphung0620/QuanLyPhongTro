using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using NhaTro.Controllers;
using NhaTro.Data;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Tests;

public class TenantMeterReadingsControllerTests
{
    [Fact]
    public async Task GetMyMeterReadings_ReturnsSerializableTenantReadings()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.SetupGet(x => x.Role).Returns("Tenant");
        currentUser.SetupGet(x => x.OrganizationId).Returns(1);
        currentUser.SetupGet(x => x.TenantId).Returns(5);

        var options = new DbContextOptionsBuilder<NhaTroDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new NhaTroDbContext(options, currentUser.Object);
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
            RoomId = 10,
            RoomCode = "A1",
            ListedPrice = 2_500_000,
            Status = "occupied",
            AppUserId = 1,
            OrganizationId = 1
        });
        context.Tenants.Add(new Tenant
        {
            TenantId = 5,
            FullName = "Hung",
            AppUserId = 1,
            OrganizationId = 1
        });
        context.Contracts.Add(new Contract
        {
            ContractId = 20,
            RoomId = 10,
            TenantId = 5,
            StartDate = new DateOnly(2026, 6, 1),
            DepositAmount = 2_500_000,
            DepositPaidAmount = 2_500_000,
            OccupantCount = 1,
            ActualRoomPrice = 2_500_000,
            Status = "active",
            AppUserId = 1,
            OrganizationId = 1
        });
        context.MeterReadings.Add(new MeterReading
        {
            MeterReadingId = 30,
            RoomId = 10,
            ContractId = 20,
            BillingMonth = new DateOnly(2026, 6, 1),
            PreviousReading = 29,
            CurrentReading = 50,
            ConsumedUnits = 21,
            UnitPrice = 3_500,
            Amount = 73_500,
            AppUserId = 1,
            OrganizationId = 1
        });
        await context.SaveChangesAsync();

        var controller = new TenantMeterReadingsController(context, currentUser.Object);

        var result = await controller.GetMyMeterReadings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("\"RoomCode\":\"A1\"", json);
        Assert.DoesNotContain("Contracts", json);
        Assert.DoesNotContain("MeterReadings", json);
    }
}
