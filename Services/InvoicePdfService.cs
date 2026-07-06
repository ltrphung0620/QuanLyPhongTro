using System.Globalization;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;
using NhaTro.Utils;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace NhaTro.Services
{
    public class InvoicePdfService : IInvoicePdfService
    {
        private const string BankCode = "acb";
        private static readonly BankQrAccount KimLoanAccount = new("226448", "Trinh Thi Kim Loan");
        private static readonly BankQrAccount PhamSaiAccount = new("194218449", "Phạm Thị Sại");
        private static readonly object FontRegistrationLock = new();
        private static bool _fontsRegistered;

        private readonly HttpClient _httpClient;
        private readonly IWebHostEnvironment _environment;

        public InvoicePdfService(HttpClient httpClient, IWebHostEnvironment environment)
        {
            _httpClient = httpClient;
            _environment = environment;
            EnsurePdfFontsRegistered();
        }

        public async Task<byte[]> GenerateInvoicePdfAsync(InvoiceDto invoice)
        {
            using var stream = new MemoryStream();
            var document = await CreateInvoiceDocumentAsync(invoice);
            document.GeneratePdf(stream);

            return stream.ToArray();
        }

        public async Task<IReadOnlyList<byte[]>> GenerateInvoiceImagesAsync(InvoiceDto invoice)
        {
            var document = await CreateInvoiceDocumentAsync(invoice);
            return document.GenerateImages(new ImageGenerationSettings
            {
                RasterDpi = 144
            }).ToList();
        }

        public string BuildInvoicePdfFileName(InvoiceDto invoice)
        {
            var paymentCode = SanitizeFilePart(GetPaymentCode(invoice));
            var roomCode = SanitizeFilePart(invoice.RoomCode ?? $"Phong{invoice.RoomId}");
            return $"HoaDon-{roomCode}-{paymentCode}.pdf";
        }

        public string BuildInvoiceImageFileName(InvoiceDto invoice, int? pageNumber = null)
        {
            var paymentCode = SanitizeFilePart(GetPaymentCode(invoice));
            var roomCode = SanitizeFilePart(invoice.RoomCode ?? $"Phong{invoice.RoomId}");
            var pageSuffix = pageNumber.HasValue ? $"-trang-{pageNumber.Value}" : string.Empty;
            return $"HoaDon-{roomCode}-{paymentCode}{pageSuffix}.png";
        }

        private async Task<IDocument> CreateInvoiceDocumentAsync(InvoiceDto invoice)
        {
            var qrBytes = await TryGetQrBytesAsync(invoice);
            var meterImageBytes = TryGetMeterImageBytes(invoice);
            var bankAccount = ResolveBankQrAccount(invoice.RoomCode);
            var paymentContent = InvoicePaymentContent.Build(invoice);
            var carriedDebt = invoice.DebtAmount + invoice.DepositDebtAmount;
            var currentMonthTotal = invoice.TotalAmount - carriedDebt;

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(28);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(TextStyle.Default.FontSize(11).FontFamily("Lato", "Arial").FontColor(Colors.Grey.Darken4));

                    page.Content().AlignCenter().MaxWidth(500).Column(column =>
                    {
                        column.Spacing(18);

                        column.Item().AlignCenter().Text("H\u00D3A \u0110\u01A0N TI\u1EC0N PH\u00D2NG")
                            .FontSize(30)
                            .Bold()
                            .FontColor(Colors.Brown.Darken4);
                        column.Item().AlignCenter().Text(FormatBillingMonth(invoice.BillingMonth).ToUpperInvariant())
                            .FontSize(20)
                            .Bold()
                            .FontColor(Colors.Brown.Darken3);

                        column.Item().Element(SoftCard).Row(row =>
                        {
                            row.RelativeItem().Element(container => AddInvoiceIdentity(container, "P", "PH\u00D2NG", FormatRoomCode(invoice)));
                            row.ConstantItem(1).Height(68).Background(Colors.Grey.Lighten2);
                            row.RelativeItem().Element(container => AddInvoiceIdentity(container, "N", "NG\u01AF\u1EDCI THU\u00CA", FormatTenantName(invoice)));
                        });

                        column.Item().Element(SoftCard).Column(items =>
                        {
                            items.Spacing(0);
                            items.Item().Element(container => AddReceiptLine(container, "P", "Ti\u1EC1n ph\u00F2ng", null, invoice.RoomFee));
                            items.Item().Element(container => AddReceiptLine(container, "D", "Ti\u1EC1n \u0111i\u1EC7n", BuildElectricityReadingText(invoice), invoice.ElectricityFee));
                            items.Item().Element(container => AddReceiptLine(container, "N", "Ti\u1EC1n n\u01B0\u1EDBc", null, invoice.WaterFee));
                            items.Item().Element(container => AddReceiptLine(container, "R", "Ph\u00ED r\u00E1c", null, invoice.TrashFee));
                            items.Item().Element(container => AddReceiptLine(container, "X", "Ph\u00ED ph\u00E1t sinh", NullIfWhiteSpace(invoice.ExtraFeeNote), invoice.ExtraFee));
                            items.Item().Element(container => AddReceiptLine(container, "G", "Gi\u1EA3m gi\u00E1", NullIfWhiteSpace(invoice.Note), invoice.DiscountAmount));
                            items.Item().Element(container => AddReceiptLine(container, "C", "N\u1EE3 c\u0169", BuildDebtNote(invoice), carriedDebt, showDivider: false));
                        });

                        column.Item().Element(TotalCard).Column(total =>
                        {
                            total.Spacing(0);
                            total.Item().Element(container => AddTotalLine(container, "T\u1ED5ng ti\u1EC1n th\u00E1ng n\u00E0y", currentMonthTotal));
                            total.Item().PaddingVertical(8).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                            total.Item().Element(container => AddTotalLine(container, "N\u1EE3 c\u0169", carriedDebt));
                            total.Item().PaddingTop(12).BorderTop(1).BorderColor(Colors.Brown.Lighten2).PaddingTop(14).Row(row =>
                            {
                                row.RelativeItem().AlignMiddle().Text("T\u1ED4NG C\u1EA6N THANH TO\u00C1N")
                                    .FontSize(16)
                                    .Bold()
                                    .FontColor(Colors.Brown.Darken4);
                                row.ConstantItem(210).AlignRight().Text(FormatMoney(invoice.TotalAmount))
                                    .FontSize(24)
                                    .Bold()
                                    .FontColor(Colors.Brown.Darken4);
                            });
                        });

                        column.Item().Element(SoftCard).Row(row =>
                        {
                            row.RelativeItem().Column(bank =>
                            {
                                bank.Spacing(12);
                                bank.Item().Row(title =>
                                {
                                    title.ConstantItem(42).Element(container => AddIconBadge(container, "B"));
                                    title.RelativeItem().AlignMiddle().Text("THANH TO\u00C1N CHUY\u1EC2N KHO\u1EA2N")
                                        .Bold()
                                        .FontSize(13)
                                        .FontColor(Colors.Brown.Darken4);
                                });

                                AddBankInfoRow(bank, "Ng\u00E2n h\u00E0ng", "ACB");
                                AddBankInfoRow(bank, "Ch\u1EE7 t\u00E0i kho\u1EA3n", bankAccount.AccountName);
                                AddBankInfoRow(bank, "S\u1ED1 t\u00E0i kho\u1EA3n", bankAccount.AccountNumber);
                                AddBankInfoRow(bank, "N\u1ED9i dung CK", paymentContent);
                            });

                            row.ConstantItem(1).PaddingHorizontal(10).Height(190).Background(Colors.Grey.Lighten2);

                            row.ConstantItem(190).Column(qr =>
                            {
                                qr.Spacing(8);
                                qr.Item().AlignCenter().Text("QU\u00C9T M\u00C3 QR \u0110\u1EC2 THANH TO\u00C1N")
                                    .Bold()
                                    .FontSize(10)
                                    .FontColor(Colors.Brown.Darken4);

                                if (qrBytes != null)
                                {
                                    qr.Item().AlignCenter().Width(150).Height(150).Image(qrBytes).FitArea();
                                }
                                else
                                {
                                    qr.Item().Width(150).Height(150).Border(1).BorderColor(Colors.Grey.Lighten2)
                                        .AlignCenter().AlignMiddle().Text("QR").FontSize(18).Bold();
                                }

                                qr.Item().AlignCenter().Text("Qu\u00E9t m\u00E3 b\u1EB1ng \u1EE9ng d\u1EE5ng ng\u00E2n h\u00E0ng")
                                    .FontSize(8)
                                    .FontColor(Colors.Grey.Darken1);
                            });
                        });

                        if (meterImageBytes != null)
                        {
                            column.Item().Element(SoftCard).Column(meterImage =>
                            {
                                meterImage.Spacing(8);
                                meterImage.Item().Text("\u1EA2nh c\u00F4ng t\u01A1 \u0111i\u1EC7n").SemiBold().FontSize(13);
                                meterImage.Item().AlignCenter().MaxHeight(220).Image(meterImageBytes).FitArea();
                            });
                        }
                    });
                });
            });
        }

        private static IContainer Card(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Grey.Lighten2)
                .Padding(14)
                .Background(Colors.White);
        }

        private static IContainer SoftCard(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Grey.Lighten2)
                .Padding(18)
                .Background(Colors.White);
        }

        private static IContainer TotalCard(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Brown.Lighten2)
                .Padding(18)
                .Background(Colors.Brown.Lighten5);
        }

        private static void AddInvoiceIdentity(IContainer container, string iconText, string label, string value)
        {
            container.Row(row =>
            {
                row.ConstantItem(58).Element(item => AddIconBadge(item, iconText));
                row.RelativeItem().AlignMiddle().Column(column =>
                {
                    column.Spacing(4);
                    column.Item().Text(label).FontSize(10).SemiBold().FontColor(Colors.Grey.Darken1);
                    column.Item().Text(value).FontSize(18).Bold().FontColor(Colors.Grey.Darken4);
                });
            });
        }

        private static void AddReceiptLine(IContainer container, string iconText, string title, string? detail, decimal amount, bool showDivider = true)
        {
            var lineContainer = container.PaddingVertical(12);
            if (showDivider)
            {
                lineContainer = lineContainer.BorderBottom(1).BorderColor(Colors.Grey.Lighten3);
            }

            lineContainer.Row(row =>
            {
                row.ConstantItem(48).Element(item => AddIconBadge(item, iconText, 34, 11));
                row.RelativeItem().AlignMiddle().Column(text =>
                {
                    text.Spacing(4);
                    text.Item().Text(title).FontSize(13).Bold().FontColor(Colors.Grey.Darken4);

                    if (!string.IsNullOrWhiteSpace(detail))
                    {
                        text.Item().Text(detail).FontSize(9).FontColor(Colors.Grey.Darken1);
                    }
                });
                row.ConstantItem(150).AlignMiddle().AlignRight().Text(FormatMoney(amount)).FontSize(15).Bold();
            });
        }

        private static void AddTotalLine(IContainer container, string label, decimal amount)
        {
            container.Row(row =>
            {
                row.RelativeItem().Text(label).FontSize(13).Bold();
                row.ConstantItem(180).AlignRight().Text(FormatMoney(amount)).FontSize(14).Bold();
            });
        }

        private static void AddBankInfoRow(ColumnDescriptor column, string label, string value)
        {
            column.Item().Row(row =>
            {
                row.ConstantItem(88).Text(label).FontSize(9).FontColor(Colors.Grey.Darken2);
                row.ConstantItem(10).Text(":").FontSize(9).FontColor(Colors.Grey.Darken2);
                row.RelativeItem().Text(value).FontSize(9).SemiBold().FontColor(Colors.Grey.Darken4);
            });
        }

        private static void AddIconBadge(IContainer container, string text, float size = 42, float fontSize = 14)
        {
            container
                .Width(size)
                .Height(size)
                .Background(Colors.Brown.Lighten5)
                .AlignCenter()
                .AlignMiddle()
                .Text(text)
                .FontSize(fontSize)
                .Bold()
                .FontColor(Colors.Brown.Darken4);
        }

        private static IContainer CellLabel(IContainer container)
        {
            return container.PaddingVertical(4);
        }

        private static IContainer CellValue(IContainer container)
        {
            return container.PaddingVertical(4).AlignRight();
        }

        private static void AddMoneyRow(TableDescriptor table, string label, decimal amount)
        {
            table.Cell().Element(CellLabel).Text(label).SemiBold().FontColor(Colors.Grey.Darken1);
            table.Cell().Element(CellValue).Text(FormatMoney(amount));
        }

        private static void AddElectricityReadingRow(TableDescriptor table, InvoiceDto invoice)
        {
            if (!invoice.PreviousReading.HasValue || !invoice.CurrentReading.HasValue)
            {
                return;
            }

            table.Cell()
                .ColumnSpan(2)
                .PaddingBottom(4)
                .Text(BuildElectricityReadingText(invoice))
                .FontSize(9)
                .FontColor(Colors.Grey.Darken1);
        }

        private static void EnsurePdfFontsRegistered()
        {
            if (_fontsRegistered)
            {
                return;
            }

            lock (FontRegistrationLock)
            {
                if (_fontsRegistered)
                {
                    return;
                }

                var fontDirectory = Path.Combine(AppContext.BaseDirectory, "LatoFont");
                RegisterFontIfExists(fontDirectory, "Lato-Regular.ttf");
                RegisterFontIfExists(fontDirectory, "Lato-Bold.ttf");
                RegisterFontIfExists(fontDirectory, "Lato-Italic.ttf");
                RegisterFontIfExists(fontDirectory, "Lato-BoldItalic.ttf");
                RegisterFontIfExists(fontDirectory, "Lato-SemiBold.ttf");
                RegisterFontIfExists(fontDirectory, "Lato-SemiBoldItalic.ttf");

                _fontsRegistered = true;
            }
        }

        private static void RegisterFontIfExists(string fontDirectory, string fileName)
        {
            var fontPath = Path.Combine(fontDirectory, fileName);
            if (!File.Exists(fontPath))
            {
                return;
            }

            using var stream = File.OpenRead(fontPath);
            FontManager.RegisterFont(stream);
        }

        private async Task<byte[]?> TryGetQrBytesAsync(InvoiceDto invoice)
        {
            var qrUrl = BuildQrUrl(invoice);
            if (string.IsNullOrWhiteSpace(qrUrl))
            {
                return null;
            }

            try
            {
                return await _httpClient.GetByteArrayAsync(qrUrl);
            }
            catch
            {
                return null;
            }
        }

        private byte[]? TryGetMeterImageBytes(InvoiceDto invoice)
        {
            if (string.IsNullOrWhiteSpace(invoice.MeterImagePath))
            {
                return null;
            }

            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrWhiteSpace(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            var fullPath = Path.GetFullPath(Path.Combine(webRootPath, invoice.MeterImagePath.Replace('/', Path.DirectorySeparatorChar)));
            var uploadsRoot = Path.GetFullPath(Path.Combine(webRootPath, "uploads", "meter-readings"));
            var uploadsRootWithSeparator = uploadsRoot.EndsWith(Path.DirectorySeparatorChar)
                ? uploadsRoot
                : uploadsRoot + Path.DirectorySeparatorChar;

            if (!fullPath.StartsWith(uploadsRootWithSeparator, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
            {
                return null;
            }

            return File.ReadAllBytes(fullPath);
        }

        private static string BuildQrUrl(InvoiceDto invoice)
        {
            var amount = Math.Max(0, Math.Round(invoice.TotalAmount));
            var paymentContent = InvoicePaymentContent.Build(invoice);
            if (amount <= 0 || string.IsNullOrWhiteSpace(paymentContent))
            {
                return string.Empty;
            }

            var account = ResolveBankQrAccount(invoice.RoomCode);
            var query = $"amount={amount.ToString("0", CultureInfo.InvariantCulture)}&addInfo={Uri.EscapeDataString(paymentContent)}&accountName={Uri.EscapeDataString(account.AccountName)}";
            return $"https://img.vietqr.io/image/{BankCode}-{account.AccountNumber}-compact2.jpg?{query}";
        }

        private static BankQrAccount ResolveBankQrAccount(string? roomCode)
        {
            return RoomLedgerOwner.ResolveOwnerKey(roomCode) == RoomLedgerOwner.KimLoanKey
                ? KimLoanAccount
                : PhamSaiAccount;
        }

        private static string GetPaymentCode(InvoiceDto invoice)
        {
            if (!string.IsNullOrWhiteSpace(invoice.PaymentCode))
            {
                return invoice.PaymentCode.Trim();
            }

            return $"HD{invoice.InvoiceId}";
        }

        private static string BuildInvoiceHeading(InvoiceDto invoice)
        {
            var roomCode = string.IsNullOrWhiteSpace(invoice.RoomCode)
                ? $"PH\u00D2NG {invoice.RoomId}"
                : invoice.RoomCode.Trim().ToUpperInvariant();

            return $"H\u00D3A \u0110\u01A0N TI\u1EC0N PH\u00D2NG {roomCode} {FormatBillingMonth(invoice.BillingMonth).ToUpperInvariant()}";
        }

        private static string BuildTenantLine(InvoiceDto invoice)
        {
            var tenantName = string.IsNullOrWhiteSpace(invoice.TenantName)
                ? "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u"
                : invoice.TenantName.Trim();

            return $"Ng\u01B0\u1EDDi thu\u00EA: {tenantName}";
        }

        private static string BuildElectricityReadingText(InvoiceDto invoice)
        {
            if (!invoice.PreviousReading.HasValue || !invoice.CurrentReading.HasValue)
            {
                return string.Empty;
            }

            var consumedUnits = invoice.ConsumedUnits ?? Math.Max(0, invoice.CurrentReading.Value - invoice.PreviousReading.Value);
            var unitPrice = consumedUnits > 0
                ? invoice.ElectricityFee / consumedUnits
                : 0;

            return $"S\u1ED1 c\u0169: {invoice.PreviousReading.Value:N0}  |  S\u1ED1 m\u1EDBi: {invoice.CurrentReading.Value:N0}  |  {consumedUnits:N0} kWh x {FormatMoney(unitPrice)}";
        }

        private static string FormatRoomCode(InvoiceDto invoice)
        {
            return string.IsNullOrWhiteSpace(invoice.RoomCode)
                ? $"Ph\u00F2ng {invoice.RoomId}"
                : invoice.RoomCode.Trim();
        }

        private static string FormatTenantName(InvoiceDto invoice)
        {
            return string.IsNullOrWhiteSpace(invoice.TenantName)
                ? "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u"
                : invoice.TenantName.Trim();
        }

        private static string? BuildDebtNote(InvoiceDto invoice)
        {
            var carriedDebt = invoice.DebtAmount + invoice.DepositDebtAmount;
            if (carriedDebt <= 0)
            {
                return null;
            }

            if (!invoice.BillingMonth.HasValue)
            {
                return "N\u1EE3 k\u1EF3 tr\u01B0\u1EDBc ch\u01B0a thanh to\u00E1n \u0111\u1EE7";
            }

            var previousMonth = invoice.BillingMonth.Value.AddMonths(-1);
            return $"N\u1EE3 h\u00F3a \u0111\u01A1n th\u00E1ng {previousMonth:MM/yyyy} ch\u01B0a thanh to\u00E1n \u0111\u1EE7";
        }

        private static string? NullIfWhiteSpace(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static string FormatBillingMonth(DateOnly? value)
        {
            if (!value.HasValue)
            {
                return "Kh\u00F4ng c\u00F3 d\u1EEF li\u1EC7u";
            }

            return $"Th\u00E1ng {value.Value.Month:00}/{value.Value.Year}";
        }

        private static string FormatDateTime(DateTime? value)
        {
            return value.HasValue
                ? value.Value.ToLocalTime().ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)
                : "Kh\u00F4ng c\u00F3 d\u1EEF li\u1EC7u";
        }

        private static string FormatMoney(decimal value)
        {
            return string.Format(CultureInfo.GetCultureInfo("vi-VN"), "{0:N0}\u0111", value);
        }

        private static string SanitizeFilePart(string value)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitizedChars = value
                .Trim()
                .Select(character => invalidChars.Contains(character) ? '-' : character)
                .ToArray();

            var sanitized = new string(sanitizedChars);
            return string.IsNullOrWhiteSpace(sanitized) ? "HoaDon" : sanitized;
        }

        private sealed record BankQrAccount(string AccountNumber, string AccountName);
    }
}
