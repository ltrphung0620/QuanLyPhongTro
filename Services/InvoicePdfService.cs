using System.Globalization;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace NhaTro.Services
{
    public class InvoicePdfService : IInvoicePdfService
    {
        private const string BankAccount = "556062006";
        private const string AccountName = "LaiTrinhPhuocHung";
        private static readonly object FontRegistrationLock = new();
        private static bool _fontsRegistered;

        private readonly HttpClient _httpClient;

        public InvoicePdfService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            EnsurePdfFontsRegistered();
        }

        public async Task<byte[]> GenerateInvoicePdfAsync(InvoiceDto invoice)
        {
            var qrBytes = await TryGetQrBytesAsync(invoice);

            using var stream = new MemoryStream();

            Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(24);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(TextStyle.Default.FontSize(11).FontFamily("Lato", "Arial"));

                    page.Content().Column(column =>
                    {
                        column.Spacing(16);

                        column.Item().Text("H\u00D3A \u0110\u01A0N TI\u1EC0N PH\u00D2NG").FontSize(22).SemiBold();
                        column.Item().Text(BuildInvoiceTitle(invoice)).FontSize(12).FontColor(Colors.Grey.Darken1);
                        column.Item().Text($"Ng\u00E0y in: {FormatDateTime(DateTime.Now)}").FontSize(10).FontColor(Colors.Grey.Darken1);

                        column.Item().Element(Card).Column(costs =>
                        {
                            costs.Spacing(10);
                            costs.Item().Text("Chi ti\u1EBFt chi ph\u00ED").SemiBold().FontSize(13);
                            costs.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn();
                                    columns.ConstantColumn(160);
                                });

                                AddMoneyRow(table, "Ti\u1EC1n ph\u00F2ng", invoice.RoomFee);
                                AddMoneyRow(table, "Ti\u1EC1n \u0111i\u1EC7n", invoice.ElectricityFee);
                                AddMoneyRow(table, "Ti\u1EC1n n\u01B0\u1EDBc", invoice.WaterFee);
                                AddMoneyRow(table, "Ti\u1EC1n r\u00E1c", invoice.TrashFee);
                                AddMoneyRow(table, "Ph\u00ED ph\u00E1t sinh", invoice.ExtraFee);
                                AddMoneyRow(table, "N\u1EE3 c\u0169 chuy\u1EC3n k\u1EF3", invoice.DebtAmount);
                                AddMoneyRow(table, "Gi\u1EA3m tr\u1EEB", -invoice.DiscountAmount);

                                table.Cell().Element(CellLabel).Text("T\u1ED5ng thanh to\u00E1n").SemiBold();
                                table.Cell().Element(CellValue).Text(FormatMoney(invoice.TotalAmount)).SemiBold();
                            });
                        });

                        column.Item().Element(Card).Column(note =>
                        {
                            note.Spacing(8);

                            var noteText = invoice.Note?.Trim();
                            var extraFeeNoteText = invoice.ExtraFeeNote?.Trim();
                            var hasNote = !string.IsNullOrWhiteSpace(noteText);
                            var hasExtraFeeNote = !string.IsNullOrWhiteSpace(extraFeeNoteText);

                            note.Item().Text("Ghi ch\u00FA").SemiBold().FontSize(13);

                            if (hasNote)
                            {
                                note.Item().Text(noteText);
                            }

                            if (hasExtraFeeNote)
                            {
                                if (hasNote)
                                {
                                    note.Item().PaddingTop(4).Text("Ghi ch\u00FA ph\u00ED ph\u00E1t sinh").SemiBold().FontSize(11);
                                    note.Item().Text(extraFeeNoteText);
                                }
                                else
                                {
                                    note.Item().Text($"Ph\u00ED ph\u00E1t sinh: {extraFeeNoteText}");
                                }
                            }

                            if (!hasNote && !hasExtraFeeNote)
                            {
                                note.Item().Text("Kh\u00F4ng c\u00F3 ghi ch\u00FA.");
                            }
                        });

                        column.Item().Element(Card).Column(qr =>
                        {
                            qr.Spacing(8);
                            qr.Item().Text("QR thanh to\u00E1n").SemiBold().FontSize(13);

                            if (qrBytes != null)
                            {
                                qr.Item().AlignCenter().Width(220).Height(220).Image(qrBytes).FitArea();
                            }
                            else
                            {
                                qr.Item()
                                    .Border(1)
                                    .BorderColor(Colors.Grey.Lighten2)
                                    .Padding(14)
                                    .AlignCenter()
                                    .Text("Kh\u00F4ng t\u1EA3i \u0111\u01B0\u1EE3c QR thanh to\u00E1n.");
                            }

                            qr.Item().Text($"N\u1ED9i dung: {GetPaymentCode(invoice)}").FontSize(10);
                            qr.Item().Text($"S\u1ED1 t\u00E0i kho\u1EA3n: {BankAccount}").FontSize(10);
                            qr.Item().Text($"Ch\u1EE7 t\u00E0i kho\u1EA3n: {AccountName}").FontSize(10);
                            qr.Item().Text($"S\u1ED1 ti\u1EC1n QR: {FormatMoney(invoice.TotalAmount)}").FontSize(10);
                        });

                        column.Item()
                            .PaddingTop(4)
                            .Text("PDF n\u00E0y \u0111\u01B0\u1EE3c t\u1EA1o t\u1EEB h\u1EC7 th\u1ED1ng qu\u1EA3n l\u00FD nh\u00E0 tr\u1ECD.")
                            .FontSize(9)
                            .FontColor(Colors.Grey.Darken1);
                    });
                });
            }).GeneratePdf(stream);

            return stream.ToArray();
        }

        public string BuildInvoicePdfFileName(InvoiceDto invoice)
        {
            var paymentCode = SanitizeFilePart(GetPaymentCode(invoice));
            var roomCode = SanitizeFilePart(invoice.RoomCode ?? $"Phong{invoice.RoomId}");
            return $"HoaDon-{roomCode}-{paymentCode}.pdf";
        }

        private static IContainer Card(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Grey.Lighten2)
                .Padding(14)
                .Background(Colors.White);
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

        private static string BuildQrUrl(InvoiceDto invoice)
        {
            var amount = Math.Max(0, Math.Round(invoice.TotalAmount));
            var paymentCode = GetPaymentCode(invoice);
            if (amount <= 0 || string.IsNullOrWhiteSpace(paymentCode))
            {
                return string.Empty;
            }

            var query = $"amount={amount.ToString("0", CultureInfo.InvariantCulture)}&addInfo={Uri.EscapeDataString(paymentCode)}&accountName={Uri.EscapeDataString(AccountName)}";
            return $"https://img.vietqr.io/image/mbbank-{BankAccount}-compact2.jpg?{query}";
        }

        private static string GetPaymentCode(InvoiceDto invoice)
        {
            if (!string.IsNullOrWhiteSpace(invoice.PaymentCode))
            {
                return invoice.PaymentCode.Trim();
            }

            return $"HD{invoice.InvoiceId}";
        }

        private static string BuildInvoiceTitle(InvoiceDto invoice)
        {
            return $"{FormatInvoiceType(invoice.InvoiceType)} - {FormatBillingMonth(invoice.BillingMonth)}";
        }

        private static string FormatInvoiceType(string? invoiceType)
        {
            var normalized = (invoiceType ?? string.Empty).Trim().ToLowerInvariant();
            return normalized switch
            {
                "final" => "H\u00F3a \u0111\u01A1n ch\u1ED1t h\u1EE3p \u0111\u1ED3ng",
                "monthly" => "H\u00F3a \u0111\u01A1n th\u00E1ng",
                _ => string.IsNullOrWhiteSpace(invoiceType) ? "H\u00F3a \u0111\u01A1n" : invoiceType.Trim()
            };
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
            return string.Format(CultureInfo.GetCultureInfo("vi-VN"), "{0:N0} VND", value);
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
    }
}
