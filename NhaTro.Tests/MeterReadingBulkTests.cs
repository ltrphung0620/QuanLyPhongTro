using Xunit;
using Moq;
using NhaTro.Services;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Dtos.Pricing;
using NhaTro.Models;
using Microsoft.AspNetCore.Hosting;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;

namespace NhaTro.Tests
{
    public class MeterReadingBulkTests
    {
        [Fact]
        public async Task CreateBulkAsync_ShouldCreateMeterReadingsSuccessfully()
        {
            // Arrange
            var mockMeterRepo = new Mock<IMeterReadingRepository>();
            var mockContractRepo = new Mock<IContractRepository>();
            var mockRoomRepo = new Mock<IRoomRepository>();
            var mockInvoiceRepo = new Mock<IInvoiceRepository>();
            var mockEnv = new Mock<IWebHostEnvironment>();

            var service = new MeterReadingService(
                mockMeterRepo.Object,
                mockContractRepo.Object,
                mockRoomRepo.Object,
                mockInvoiceRepo.Object,
                mockEnv.Object,
                null!,
                new Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<MeterReadingService>>().Object,
                CreatePricingService().Object
            );

            var activeContract = new Contract
            {
                ContractId = 1,
                RoomId = 1,
                Room = new Room { RoomId = 1, RoomCode = "A1" }
            };

            mockContractRepo.Setup(x => x.GetActiveByRoomIdAsync(1))
                .ReturnsAsync(activeContract);

            mockMeterRepo.Setup(x => x.GetByContractAndMonthAsync(1, It.IsAny<DateOnly>()))
                .ReturnsAsync((MeterReading?)null);

            mockMeterRepo.Setup(x => x.GetLatestBeforeDateAsync(1, new DateOnly(2026, 10, 31)))
                .ReturnsAsync(new MeterReading { CurrentReading = 100 });

            var dto = new CreateMeterReadingBulkDto
            {
                BillingMonth = new DateOnly(2026, 10, 1),
                Readings = new List<CreateMeterReadingBulkItemDto>
                {
                    new() { RoomId = 1, ContractId = 1, CurrentReading = 150 }
                }
            };

            // Act
            var result = await service.CreateBulkAsync(dto);

            // Assert
            Assert.Single(result);
            Assert.Equal("A1", result[0].RoomCode);
            Assert.Equal(150, result[0].CurrentReading);
            Assert.Equal(50, result[0].ConsumedUnits);
            Assert.Equal(175000, result[0].Amount); // 50 * 3500

            mockMeterRepo.Verify(x => x.AddAsync(It.IsAny<MeterReading>()), Times.Once);
            mockMeterRepo.Verify(x => x.SaveChangesAsync(), Times.Once);
        }

        [Fact]
        public async Task PreviewAsync_ShouldUseLatestReadingBeforePeriodClosingDate()
        {
            var meterRepo = new Mock<IMeterReadingRepository>();
            var contractRepo = new Mock<IContractRepository>();
            var contract = new Contract
            {
                ContractId = 4,
                RoomId = 2,
                Room = new Room { RoomId = 2, RoomCode = "A2" },
                Status = "active"
            };
            contractRepo.Setup(x => x.GetActiveByRoomIdAsync(2)).ReturnsAsync(contract);
            meterRepo.Setup(x => x.GetByContractAndMonthAsync(4, new DateOnly(2026, 7, 1)))
                .ReturnsAsync((MeterReading?)null);
            meterRepo.Setup(x => x.GetLatestBeforeDateAsync(2, new DateOnly(2026, 7, 31)))
                .ReturnsAsync(new MeterReading
                {
                    BillingMonth = new DateOnly(2026, 6, 30),
                    PreviousReading = 29,
                    CurrentReading = 50
                });
            meterRepo.Setup(x => x.GetLatestByRoomAsync(2))
                .ReturnsAsync(new MeterReading
                {
                    BillingMonth = new DateOnly(2026, 8, 31),
                    CurrentReading = 29
                });

            var service = new MeterReadingService(
                meterRepo.Object,
                contractRepo.Object,
                new Mock<IRoomRepository>().Object,
                new Mock<IInvoiceRepository>().Object,
                new Mock<IWebHostEnvironment>().Object,
                null!,
                new Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<MeterReadingService>>().Object,
                CreatePricingService().Object);

            var preview = await service.PreviewAsync(new CreateMeterReadingDto
            {
                RoomId = 2,
                ContractId = 4,
                BillingMonth = new DateOnly(2026, 7, 1),
                CurrentReading = 75
            });

            Assert.Equal(50, preview.PreviousReading);
            Assert.Equal(25, preview.ConsumedUnits);
            meterRepo.Verify(x => x.GetLatestBeforeDateAsync(2, new DateOnly(2026, 7, 31)), Times.Once);
            meterRepo.Verify(x => x.GetLatestByRoomAsync(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task PreviewAsync_ShouldCarryFinalReadingToNewTenantInSameMonth()
        {
            var meterRepo = new Mock<IMeterReadingRepository>();
            var contractRepo = new Mock<IContractRepository>();
            contractRepo.Setup(x => x.GetActiveByRoomIdAsync(2)).ReturnsAsync(new Contract
            {
                ContractId = 8,
                RoomId = 2,
                StartDate = new DateOnly(2026, 6, 16),
                Status = "active",
                Room = new Room { RoomId = 2, RoomCode = "A2" }
            });
            meterRepo.Setup(x => x.GetByContractAndMonthAsync(8, new DateOnly(2026, 6, 1)))
                .ReturnsAsync((MeterReading?)null);
            meterRepo.Setup(x => x.GetLatestBeforeDateAsync(2, new DateOnly(2026, 6, 30)))
                .ReturnsAsync(new MeterReading
                {
                    ContractId = 7,
                    BillingMonth = new DateOnly(2026, 6, 15),
                    PreviousReading = 80,
                    CurrentReading = 100
                });

            var service = new MeterReadingService(
                meterRepo.Object,
                contractRepo.Object,
                new Mock<IRoomRepository>().Object,
                new Mock<IInvoiceRepository>().Object,
                new Mock<IWebHostEnvironment>().Object,
                null!,
                new Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<MeterReadingService>>().Object,
                CreatePricingService().Object);

            var preview = await service.PreviewAsync(new CreateMeterReadingDto
            {
                RoomId = 2,
                ContractId = 8,
                BillingMonth = new DateOnly(2026, 6, 1),
                CurrentReading = 125
            });

            Assert.Equal(100, preview.PreviousReading);
            Assert.Equal(25, preview.ConsumedUnits);
        }

        [Fact]
        public async Task PreviewAsync_ShouldRejectMonthBeforeContractStarts()
        {
            var meterRepo = new Mock<IMeterReadingRepository>();
            var contractRepo = new Mock<IContractRepository>();
            contractRepo.Setup(x => x.GetActiveByRoomIdAsync(2)).ReturnsAsync(new Contract
            {
                ContractId = 4,
                RoomId = 2,
                StartDate = new DateOnly(2026, 7, 1),
                Status = "active"
            });
            var service = new MeterReadingService(
                meterRepo.Object,
                contractRepo.Object,
                new Mock<IRoomRepository>().Object,
                new Mock<IInvoiceRepository>().Object,
                new Mock<IWebHostEnvironment>().Object,
                null!,
                new Mock<Microsoft.Extensions.Configuration.IConfiguration>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<MeterReadingService>>().Object,
                CreatePricingService().Object);

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.PreviewAsync(new CreateMeterReadingDto
            {
                RoomId = 2,
                ContractId = 4,
                BillingMonth = new DateOnly(2026, 6, 1),
                CurrentReading = 50
            }));

            Assert.Contains("không có hiệu lực", error.Message);
            meterRepo.Verify(x => x.AddAsync(It.IsAny<MeterReading>()), Times.Never);
        }

        private static Mock<IPricingSettingsService> CreatePricingService()
        {
            var pricing = new Mock<IPricingSettingsService>();
            pricing.Setup(x => x.GetAsync()).ReturnsAsync(new PricingSettingsDto
            {
                ElectricityUnitPrice = 3500m,
                WaterFeePerPerson = 50000m,
                TrashFee = 30000m
            });
            return pricing;
        }
    }
}
