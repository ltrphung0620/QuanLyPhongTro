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
        public async Task Preview_ShouldUseContractCustomWaterFee()
        {
            var fixture = CreateFixture(existingDepositDebt: 500_000m, customWaterFee: 60_000m, occupantCount: 2);

            var preview = await fixture.Service.PreviewAsync(new CreateInvoiceDto
            {
                RoomId = 1,
                ContractId = 10,
                BillingMonth = new DateOnly(2026, 7, 1)
            });

            Assert.Equal(60_000m, preview.WaterFee);
            Assert.Equal(2_590_000m, preview.TotalAmount);
        }

        [Fact]
        public async Task Preview_ShouldCarryUnpaidPreviousInvoiceIntoNextInvoiceDebt()
        {
            var fixture = CreateFixture(
                existingDepositDebt: 500_000m,
                previousInvoice: new Invoice
                {
                    InvoiceId = 6,
                    ContractId = 10,
                    BillingMonth = new DateOnly(2026, 6, 1),
                    TotalAmount = 2_000_000m,
                    PaidAmount = 0,
                    Status = "unpaid"
                });

            var preview = await fixture.Service.PreviewAsync(new CreateInvoiceDto
            {
                RoomId = 1,
                ContractId = 10,
                BillingMonth = new DateOnly(2026, 7, 1)
            });

            Assert.Equal(2_000_000m, preview.DebtAmount);
            Assert.Equal(4_580_000m, preview.TotalAmount);
        }

        [Fact]
        public async Task MonthlyRevenue_ShouldExcludeCarryOverDebtFromRecognizedRevenue()
        {
            var invoiceRepository = new Mock<IInvoiceRepository>();
            invoiceRepository
                .Setup(x => x.GetAllAsync(null, new DateOnly(2026, 6, 1), null))
                .ReturnsAsync(new List<Invoice>
                {
                    new()
                    {
                        InvoiceId = 6,
                        BillingMonth = new DateOnly(2026, 6, 1),
                        DepositDebtAmount = 500_000m,
                        TotalAmount = 2_500_000m,
                        DebtAmount = 0,
                        Status = "unpaid"
                    }
                });
            invoiceRepository
                .Setup(x => x.GetAllAsync(null, new DateOnly(2026, 7, 1), null))
                .ReturnsAsync(new List<Invoice>
                {
                    new()
                    {
                        InvoiceId = 7,
                        BillingMonth = new DateOnly(2026, 7, 1),
                        RoomFee = 2_500_000m,
                        WaterFee = 50_000m,
                        TrashFee = 30_000m,
                        DebtAmount = 2_000_000m,
                        TotalAmount = 4_580_000m,
                        Status = "unpaid"
                    }
                });

            var transactionRepository = new Mock<ITransactionRepository>();
            transactionRepository
                .Setup(x => x.GetAllAsync(It.IsAny<DateOnly?>(), "income"))
                .ReturnsAsync(new List<Transaction>());

            var contractRepository = new Mock<IContractRepository>();
            contractRepository
                .Setup(x => x.GetAllAsync(null, null, true))
                .ReturnsAsync(new List<Contract>
                {
                    new()
                    {
                        ContractId = 10,
                        StartDate = new DateOnly(2026, 6, 15),
                        DepositAmount = 2_500_000m,
                        DepositPaidAmount = 2_000_000m
                    }
                });

            var service = new ReportService(
                invoiceRepository.Object,
                new Mock<IPaymentTransactionRepository>().Object,
                transactionRepository.Object,
                contractRepository.Object);

            var june = await service.GetMonthlyRevenueAsync(new DateOnly(2026, 6, 1));
            var july = await service.GetMonthlyRevenueAsync(new DateOnly(2026, 7, 1));

            Assert.Equal(2_000_000m, june.PaidInvoicesRevenue);
            Assert.Equal(2_000_000m, june.DepositRevenue);
            Assert.Equal(4_000_000m, june.TotalRevenue);
            Assert.Equal(2_580_000m, july.PaidInvoicesRevenue);
            Assert.Equal(0, july.DepositRevenue);
            Assert.Equal(2_580_000m, july.TotalRevenue);
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

        private static Fixture CreateFixture(
            decimal existingDepositDebt,
            Invoice? previousInvoice = null,
            decimal? customWaterFee = null,
            int occupantCount = 1)
        {
            var invoiceRepository = new Mock<IInvoiceRepository>();
            invoiceRepository.Setup(x => x.GetByRoomAndMonthAsync(1, It.IsAny<DateOnly>()))
                .ReturnsAsync((Invoice?)null);
            invoiceRepository.Setup(x => x.GetLatestBeforeMonthAsync(1, It.IsAny<DateOnly>()))
                .ReturnsAsync((Invoice?)null);
            invoiceRepository.Setup(x => x.GetLatestBeforeMonthByContractAsync(10, It.IsAny<DateOnly>()))
                .ReturnsAsync(previousInvoice);
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
                OccupantCount = occupantCount,
                CustomWaterFee = customWaterFee,
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
