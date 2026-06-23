using Moq;
using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Dtos.Pricing;
using NhaTro.Models;
using NhaTro.Services;

namespace NhaTro.Tests
{
    public class ContractConsistencyTests
    {
        [Fact]
        public async Task Create_ShouldRejectExpectedEndBeforeStart()
        {
            var fixture = CreateFixture();

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Service.CreateAsync(new CreateContractDto
            {
                RoomId = 1,
                TenantId = 1,
                StartDate = new DateOnly(2026, 7, 1),
                ExpectedEndDate = new DateOnly(2026, 6, 30),
                DepositAmount = 2_500_000,
                OccupantCount = 1,
                ActualRoomPrice = 2_500_000
            }));

            Assert.Contains("không được trước", error.Message);
            fixture.ContractRepository.Verify(x => x.AddAsync(It.IsAny<Contract>()), Times.Never);
        }

        [Fact]
        public async Task EndPreview_ShouldProrateFromContractStartAndUseReadingBeforeEndDate()
        {
            var fixture = CreateFixture();
            fixture.ContractRepository.Setup(x => x.GetByIdAsync(7)).ReturnsAsync(new Contract
            {
                ContractId = 7,
                RoomId = 2,
                TenantId = 3,
                StartDate = new DateOnly(2026, 6, 22),
                ActualRoomPrice = 2_500_000,
                OccupantCount = 1,
                DepositAmount = 0,
                DepositPaidAmount = 0,
                Status = "active",
                Room = new Room { RoomId = 2, RoomCode = "A2" },
                Tenant = new Tenant { TenantId = 3, FullName = "Hùng" }
            });
            fixture.MeterRepository
                .Setup(x => x.GetLatestBeforeDateAsync(2, new DateOnly(2026, 6, 30)))
                .ReturnsAsync(new MeterReading { CurrentReading = 50 });
            fixture.InvoiceRepository.Setup(x => x.GetByContractIdAsync(7)).ReturnsAsync(new List<Invoice>());

            var preview = await fixture.Service.EndPreviewAsync(7, new ContractEndPreviewRequestDto
            {
                ActualEndDate = new DateOnly(2026, 6, 30),
                CurrentReading = 70
            });

            Assert.Equal(new DateOnly(2026, 6, 22), preview.FromDate);
            Assert.Equal(9, preview.NumberOfDays);
            Assert.Equal(750_000m, preview.RoomFee);
            Assert.Equal(70_000m, preview.ElectricityFee);
            Assert.Equal(15_000m, preview.WaterFee);
            Assert.Equal(865_000m, preview.FinalInvoiceAmount);
            fixture.MeterRepository.Verify(x => x.GetLatestByRoomAsync(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task Update_ShouldAllowRoomPriceChangeWithoutTouchingExistingInvoices()
        {
            var fixture = CreateFixture();
            fixture.ContractRepository.Setup(x => x.GetByIdAsync(7)).ReturnsAsync(new Contract
            {
                ContractId = 7,
                RoomId = 2,
                TenantId = 3,
                StartDate = new DateOnly(2026, 1, 1),
                ExpectedEndDate = null,
                DepositAmount = 2_200_000m,
                DepositPaidAmount = 2_200_000m,
                ActualRoomPrice = 2_200_000m,
                OccupantCount = 1,
                Status = "active",
                Room = new Room { RoomId = 2, RoomCode = "A2" },
                Tenant = new Tenant { TenantId = 3, FullName = "Hung" }
            });
            fixture.InvoiceRepository.Setup(x => x.GetByContractIdAsync(7)).ReturnsAsync(new List<Invoice>
            {
                new()
                {
                    InvoiceId = 11,
                    ContractId = 7,
                    BillingMonth = new DateOnly(2026, 1, 1),
                    RoomFee = 2_200_000m,
                    TotalAmount = 2_200_000m,
                    Status = "paid"
                }
            });
            fixture.ContractRepository.Setup(x => x.SaveChangesAsync()).ReturnsAsync(true);

            var result = await fixture.Service.UpdateAsync(7, new UpdateContractDto
            {
                StartDate = new DateOnly(2026, 1, 1),
                ExpectedEndDate = null,
                DepositAmount = 2_200_000m,
                DepositPaidAmount = 2_200_000m,
                OccupantCount = 1,
                ActualRoomPrice = 2_300_000m
            });

            Assert.NotNull(result);
            Assert.Equal(2_300_000m, result.ActualRoomPrice);
            fixture.ContractRepository.Verify(x => x.Update(It.Is<Contract>(contract =>
                contract.ContractId == 7 &&
                contract.ActualRoomPrice == 2_300_000m)), Times.Once);
            fixture.InvoiceRepository.Verify(x => x.Update(It.IsAny<Invoice>()), Times.Never);
            fixture.InvoiceRepository.Verify(x => x.SaveChangesAsync(), Times.Never);
        }

        private static Fixture CreateFixture()
        {
            var contracts = new Mock<IContractRepository>();
            var meters = new Mock<IMeterReadingRepository>();
            var invoices = new Mock<IInvoiceRepository>();
            return new Fixture(
                new ContractService(
                    contracts.Object,
                    new Mock<IRoomRepository>().Object,
                    new Mock<ITenantRepository>().Object,
                    meters.Object,
                    invoices.Object,
                    new Mock<IDepositSettlementRepository>().Object,
                    new Mock<ITransactionRepository>().Object,
                    new Mock<ITenantRoomAccountService>().Object,
                    CreatePricingService().Object),
                contracts,
                meters,
                invoices);
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

        private sealed record Fixture(
            ContractService Service,
            Mock<IContractRepository> ContractRepository,
            Mock<IMeterReadingRepository> MeterRepository,
            Mock<IInvoiceRepository> InvoiceRepository);
    }
}
