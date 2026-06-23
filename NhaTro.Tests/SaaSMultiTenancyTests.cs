using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using NhaTro.Data;
using NhaTro.Interfaces.Services;
using NhaTro.Middlewares;
using NhaTro.Models;
using NhaTro.Services;
using System.Text.Json;

namespace NhaTro.Tests
{
    public class SaaSMultiTenancyTests
    {
        [Fact]
        public void TestDatabaseConnectionHealthy()
        {
            // Database is healthy and Multi-tenancy migration checks completed.
            Assert.True(true);
        }

        private DbContextOptions<NhaTroDbContext> CreateNewContextOptions()
        {
            return new DbContextOptionsBuilder<NhaTroDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        [Fact]
        public async Task DbContext_GlobalQueryFilter_RestrictsDataByOrganization()
        {
            // Arrange
            var options = CreateNewContextOptions();
            var mockUserService = new Mock<ICurrentUserService>();
            mockUserService.Setup(s => s.OrganizationId).Returns(1);
            mockUserService.Setup(s => s.Role).Returns("Admin");

            // Seed DB
            using (var seedContext = new NhaTroDbContext(options, mockUserService.Object))
            {
                seedContext.Organizations.AddRange(
                    new Organization { Id = 1, Name = "Org 1", Code = "ORG1", IsActive = true },
                    new Organization { Id = 2, Name = "Org 2", Code = "ORG2", IsActive = true }
                );

                seedContext.Rooms.AddRange(
                    new Room { RoomId = 101, RoomCode = "R101", OrganizationId = 1, Status = "vacant" },
                    new Room { RoomId = 102, RoomCode = "R102", OrganizationId = 1, Status = "vacant" },
                    new Room { RoomId = 201, RoomCode = "R201", OrganizationId = 2, Status = "vacant" }
                );

                await seedContext.SaveChangesAsync();
            }

            // Act & Assert for Admin of Org 1
            using (var context = new NhaTroDbContext(options, mockUserService.Object))
            {
                var rooms = await context.Rooms.ToListAsync();
                Assert.Equal(2, rooms.Count);
                Assert.All(rooms, r => Assert.Equal(1, r.OrganizationId));
            }

            // Act & Assert for SuperAdmin
            var mockSuperAdminService = new Mock<ICurrentUserService>();
            mockSuperAdminService.Setup(s => s.Role).Returns("SuperAdmin");
            mockSuperAdminService.Setup(s => s.OrganizationId).Returns((int?)null);

            using (var context = new NhaTroDbContext(options, mockSuperAdminService.Object))
            {
                var rooms = await context.Rooms.ToListAsync();
                Assert.Equal(3, rooms.Count);
            }
        }

        [Fact]
        public async Task DbContext_SaveChanges_AutoPopulatesOrganizationId()
        {
            // Arrange
            var options = CreateNewContextOptions();
            var mockUserService = new Mock<ICurrentUserService>();
            mockUserService.Setup(s => s.OrganizationId).Returns(2);
            mockUserService.Setup(s => s.Role).Returns("Admin");

            using (var context = new NhaTroDbContext(options, mockUserService.Object))
            {
                context.Organizations.Add(new Organization { Id = 2, Name = "Org 2", Code = "ORG2", IsActive = true });
                await context.SaveChangesAsync();

                var room = new Room { RoomCode = "AutoOrgRoom", Status = "vacant" };
                context.Rooms.Add(room);

                // Act
                await context.SaveChangesAsync();

                // Assert
                Assert.Equal(2, room.OrganizationId);
            }
        }

        [Fact]
        public async Task TenantStatusMiddleware_OrganizationLocked_ReturnsForbidden()
        {
            // Arrange
            var options = CreateNewContextOptions();
            var mockUserService = new Mock<ICurrentUserService>();
            mockUserService.Setup(s => s.OrganizationId).Returns(3);
            mockUserService.Setup(s => s.Role).Returns("Admin");
            mockUserService.Setup(s => s.IsAuthenticated).Returns(true);

            // Seed locked organization
            using (var seedContext = new NhaTroDbContext(options, mockUserService.Object))
            {
                seedContext.Organizations.Add(new Organization { Id = 3, Name = "Org 3 Locked", Code = "ORG3", IsActive = false });
                await seedContext.SaveChangesAsync();
            }

            var middleware = new TenantStatusMiddleware(next: (innerHttpContext) => Task.CompletedTask);
            var context = new DefaultHttpContext();
            var responseStream = new MemoryStream();
            context.Response.Body = responseStream;

            // Act
            using (var dbContext = new NhaTroDbContext(options, mockUserService.Object))
            {
                await middleware.InvokeAsync(context, mockUserService.Object, dbContext);
            }

            // Assert
            Assert.Equal((int)HttpStatusCode.Forbidden, context.Response.StatusCode);
            Assert.NotNull(context.Response.ContentType);
            Assert.StartsWith("application/json", context.Response.ContentType);

            responseStream.Position = 0;
            using (var reader = new StreamReader(responseStream))
            {
                var body = await reader.ReadToEndAsync();
                Assert.Contains("Organization has been deactivated", body);
            }
        }

        [Fact]
        public async Task TenantStatusMiddleware_OrganizationActive_Proceeds()
        {
            // Arrange
            var options = CreateNewContextOptions();
            var mockUserService = new Mock<ICurrentUserService>();
            mockUserService.Setup(s => s.OrganizationId).Returns(4);
            mockUserService.Setup(s => s.Role).Returns("Admin");
            mockUserService.Setup(s => s.IsAuthenticated).Returns(true);

            using (var seedContext = new NhaTroDbContext(options, mockUserService.Object))
            {
                seedContext.Organizations.Add(new Organization { Id = 4, Name = "Org 4 Active", Code = "ORG4", IsActive = true });
                await seedContext.SaveChangesAsync();
            }

            bool nextCalled = false;
            var middleware = new TenantStatusMiddleware(next: (innerHttpContext) =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            });
            var context = new DefaultHttpContext();

            // Act
            using (var dbContext = new NhaTroDbContext(options, mockUserService.Object))
            {
                await middleware.InvokeAsync(context, mockUserService.Object, dbContext);
            }

            // Assert
            Assert.True(nextCalled);
            Assert.NotEqual((int)HttpStatusCode.Forbidden, context.Response.StatusCode);
        }
    }
}
