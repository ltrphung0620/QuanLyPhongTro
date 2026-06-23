using System.IdentityModel.Tokens.Jwt;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using NhaTro.Data;
using NhaTro.Dtos;
using NhaTro.Interfaces.Services;
using NhaTro.Models;
using NhaTro.Services;

namespace NhaTro.Tests;

public class TenantLoginTests
{
    [Fact]
    public async Task LoginAsync_TenantAccount_ReturnsRequiredTenantClaims()
    {
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.SetupGet(x => x.Role).Returns("SuperAdmin");

        var options = new DbContextOptionsBuilder<NhaTroDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new NhaTroDbContext(options, currentUser.Object);
        context.Organizations.Add(new Organization
        {
            Id = 7,
            Name = "Test Organization",
            Code = "TEST-ORG",
            IsActive = true
        });
        context.Users.Add(new AppUser
        {
            Id = 9,
            Username = "tenant-test",
            Email = "tenant-test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Tenant123!"),
            DisplayName = "Tenant Test",
            Role = "Tenant",
            OrganizationId = 7,
            TenantId = 15,
            IsActive = true,
            MustChangePassword = true
        });
        await context.SaveChangesAsync();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "tenant_login_test_secret_key_1234567890",
                ["Jwt:Issuer"] = "NhaTroApp",
                ["Jwt:Audience"] = "NhaTroUsers",
                ["Jwt:ExpireMinutes"] = "10"
            })
            .Build();
        var service = new AuthService(context, new Mock<IEmailService>().Object, configuration);

        var response = await service.LoginAsync(new LoginDto
        {
            Email = "tenant-test",
            Password = "Tenant123!"
        });

        Assert.NotNull(response);
        var token = new JwtSecurityTokenHandler().ReadJwtToken(response.Token);
        Assert.Contains(token.Claims, claim => claim.Type == "role" && claim.Value == "Tenant");
        Assert.Contains(token.Claims, claim => claim.Type == "organizationId" && claim.Value == "7");
        Assert.Contains(token.Claims, claim => claim.Type == "tenantId" && claim.Value == "15");
    }
}
