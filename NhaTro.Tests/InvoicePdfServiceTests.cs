using Microsoft.AspNetCore.Hosting;
using Moq;
using Moq.Protected;
using NhaTro.Dtos.Invoices;
using NhaTro.Services;
using QuestPDF.Infrastructure;
using System.Net;

namespace NhaTro.Tests;

public class InvoicePdfServiceTests
{
    [Fact]
    public async Task GenerateInvoicePdfAndImagesAsync_WithReceiptTemplate_Renders()
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var service = new InvoicePdfService(CreateHttpClient(), CreateEnvironment());
        var invoice = new InvoiceDto
        {
            InvoiceId = 1,
            RoomId = 1,
            RoomCode = "A1",
            TenantName = "Em Yen",
            BillingMonth = new DateOnly(2026, 7, 1),
            RoomFee = 2300000,
            ElectricityFee = 59500,
            PreviousReading = 1454,
            CurrentReading = 1471,
            ConsumedUnits = 17,
            WaterFee = 80000,
            TrashFee = 50000,
            ExtraFee = 120000,
            ExtraFeeNote = "Gui xe thang 07: 120.000d",
            DiscountAmount = 0,
            DebtAmount = 1000000,
            DepositDebtAmount = 0,
            TotalAmount = 3609500,
            Status = "unpaid"
        };

        var pdf = await service.GenerateInvoicePdfAsync(invoice);
        var images = await service.GenerateInvoiceImagesAsync(invoice);

        Assert.NotEmpty(pdf);
        Assert.NotEmpty(images);
        Assert.All(images, image => Assert.NotEmpty(image));
    }

    private static IWebHostEnvironment CreateEnvironment()
    {
        var environment = new Mock<IWebHostEnvironment>();
        environment.SetupGet(x => x.ContentRootPath).Returns(AppContext.BaseDirectory);
        environment.SetupGet(x => x.WebRootPath).Returns(Path.Combine(AppContext.BaseDirectory, "wwwroot"));
        return environment.Object;
    }

    private static HttpClient CreateHttpClient()
    {
        var handler = new Mock<HttpMessageHandler>();
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.NotFound));

        return new HttpClient(handler.Object);
    }
}
