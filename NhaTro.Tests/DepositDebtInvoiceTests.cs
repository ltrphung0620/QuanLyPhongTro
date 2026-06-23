using Moq;
using NhaTro.Interfaces.Repositories;
using NhaTro.Models;
using NhaTro.Services;
using NhaTro.Dtos.Invoices;
using NhaTro.Dtos.Pricing;
using NhaTro.Interfaces.Services;

namespace NhaTro.Tests
{
    public class DepositDebtInvoiceTests
    {
        [Fact]
        public async Task Preview_ShouldAddUnpaidDepositToFirstInvoice()
        {
            var fixture = CreateFixture(existingDepositDebt: 0);

            var preview = await fixture.Service.PreviewAsync(new CreateInvoiceDto
            {
                RoomId = 1,
                ContractId = 10,
                BillingMonth = new DateOnly(2026, 6, 1)
            });

            Assert.Equal(500_000m, preview.DepositDebtAmount);
            Assert.Equal(3_080_000m, preview.TotalAmount);
        }

        [Fact]
        public async Task Preview_ShouldNotBillDepositDebtAgain()
        {
            var fixture = CreateFixture(existingDepositDebt: 500_000m);

            var preview = await fixture.Service.PreviewAsync(new CreateInvoiceDto
            {
                RoomId = 1,
                ContractId = 10,
                BillingMonth = new DateOnly(2026, 7, 1)
            });

            Assert.Equal(0, preview.DepositDebtAmount);
            Assert.Equal(2_580_000m, preview.TotalAmount);
        }

        [Fact]
        public async Task Preview_ShouldRejectMismatchedContractId()
        {
            var fixture = CreateFixture(existingDepositDebt: 0);

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Service.PreviewAsync(new CreateInvoiceDto
            {
                RoomId = 1,
                ContractId = 999,
                BillingMonth = new DateOnly(2026, 6, 1)
            }));

            Assert.Contains("không khớp", error.Message);
        }

        private static Fixture CreateFixture(decimal existingDepositDebt)
        {
            var invoiceRepository = new Mock<IInvoiceRepository>();
            invoiceRepository.Setup(x => x.GetByRoomAndMonthAsync(1, It.IsAny<DateOnly>()))
                .ReturnsAsync((Invoice?)null);
            invoiceRepository.Setup(x => x.GetLatestBeforeMonthAsync(1, It.IsAny<DateOnly>()))
                .ReturnsAsync((Invoice?)null);
            invoiceRepository.Setup(x => x.GetByContractIdAsync(10))
                .ReturnsAsync(existingDepositDebt == 0
                    ? new List<Invoice>()
                    : new List<Invoice> { new() { ContractId = 10, DepositDebtAmount = existingDepositDebt } });

            var contractRepository = new Mock<IContractRepository>();
            contractRepository.Setup(x => x.GetActiveByRoomIdAsync(1)).ReturnsAsync(new Contract
            {
                ContractId = 10,
                RoomId = 1,
                StartDate = new DateOnly(2026, 6, 1),
                ActualRoomPrice = 2_500_000m,
                OccupantCount = 1,
                DepositAmount = 2_500_000m,
                DepositPaidAmount = 2_000_000m,
                Status = "active"
            });

            var meterRepository = new Mock<IMeterReadingRepository>();
            meterRepository.Setup(x => x.GetByContractAndMonthAsync(10, It.IsAny<DateOnly>()))
                .ReturnsAsync((MeterReading?)null);

            var transactionRepository = new Mock<ITransactionRepository>();
            transactionRepository.Setup(x => x.GetPendingRoomChargeTransactionsAsync(1, It.IsAny<DateOnly>()))
                .ReturnsAsync(new List<Transaction>());

            return new Fixture(new InvoiceService(
                invoiceRepository.Object,
                contractRepository.Object,
                meterRepository.Object,
                new Mock<IRoomRepository>().Object,
                transactionRepository.Object,
                CreatePricingService().Object));
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

        private sealed record Fixture(InvoiceService Service);
    }
}
