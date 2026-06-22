using Moq;
using NhaTro.Dtos.Contracts;
using NhaTro.Interfaces.Repositories;
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
                    new Mock<ITransactionRepository>().Object),
                contracts,
                meters,
                invoices);
        }

        private sealed record Fixture(
            ContractService Service,
            Mock<IContractRepository> ContractRepository,
            Mock<IMeterReadingRepository> MeterRepository,
            Mock<IInvoiceRepository> InvoiceRepository);
    }
}
