using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class InvoicePdfService : IInvoicePdfService
    {
        private const string BankAccount = "556062006";
        private const string AccountName = "LaiTrinhPhuocHung";

        private readonly HttpClient _httpClient;

        public InvoicePdfService(HttpClient httpClient)
        {
            _httpClient = httpClient;
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
                    page.DefaultTextStyle(TextStyle.Default.FontSize(11).FontFamily("Arial"));

                    page.Content().Column(column =>
                    {
                        column.Spacing(16);

                        column.Item().Text("HÓA ĐƠN TIỀN PHÒNG").FontSize(22).SemiBold();
                        column.Item().Text(BuildInvoiceTitle(invoice)).FontSize(12).FontColor(Colors.Grey.Darken1);
                        column.Item().Text($"Ngày in: {FormatDateTime(DateTime.Now)}").FontSize(10).FontColor(Colors.Grey.Darken1);

                        column.Item().Element(Card).Column(costs =>
                        {
                            costs.Spacing(10);
                            costs.Item().Text("Chi tiết chi phí").SemiBold().FontSize(13);
                            costs.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn();
                                    columns.ConstantColumn(160);
                                });

                                AddMoneyRow(table, "Tiền phòng", invoice.RoomFee);
                                AddMoneyRow(table, "Tiền điện", invoice.ElectricityFee);
                                AddMoneyRow(table, "Tiền nước", invoice.WaterFee);
                                AddMoneyRow(table, "Tiền rác", invoice.TrashFee);
                                AddMoneyRow(table, "Nợ cũ chuyển kỳ", invoice.DebtAmount);
                                AddMoneyRow(table, "Giảm trừ", -invoice.DiscountAmount);

                                table.Cell().Element(CellLabel).Text("Tổng thanh toán").SemiBold();
                                table.Cell().Element(CellValue).Text(FormatMoney(invoice.TotalAmount)).SemiBold();
                            });
                        });

                        column.Item().Element(Card).Column(note =>
                        {
                            note.Spacing(8);
                            note.Item().Text("Ghi chú").SemiBold().FontSize(13);
                            note.Item().Text(string.IsNullOrWhiteSpace(invoice.Note) ? "Không có ghi chú." : invoice.Note!.Trim());
                        });

                        column.Item().Element(Card).Column(qr =>
                        {
                            qr.Spacing(8);
                            qr.Item().Text("QR thanh toán").SemiBold().FontSize(13);

                            if (qrBytes != null)
                            {
                                qr.Item().AlignCenter().Width(220).Height(220).Image(qrBytes).FitArea();
                            }
                            else
                            {
                                qr.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(14).AlignCenter().Text("Không tải được QR thanh toán.");
                            }

                            qr.Item().Text($"Nội dung: {GetPaymentCode(invoice)}").FontSize(10);
                            qr.Item().Text($"Số tài khoản: {BankAccount}").FontSize(10);
                            qr.Item().Text($"Chủ tài khoản: {AccountName}").FontSize(10);
                            qr.Item().Text($"Số tiền QR: {FormatMoney(invoice.TotalAmount)}").FontSize(10);
                        });

                        column.Item().PaddingTop(4).Text("PDF này được tạo từ hệ thống quản lý nhà trọ.").FontSize(9).FontColor(Colors.Grey.Darken1);
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

        private async Task<byte[]?> TryGetQrBytesAsync(InvoiceDto invoice)
        {
            var qrUrl = BuildQrUrl(invoice);
            if (string.IsNullOrWhiteSpace(qrUrl))
                return null;

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
                return string.Empty;

            var query = $"amount={amount.ToString("0", CultureInfo.InvariantCulture)}&addInfo={Uri.EscapeDataString(paymentCode)}&accountName={Uri.EscapeDataString(AccountName)}";
            return $"https://img.vietqr.io/image/mbbank-{BankAccount}-compact2.jpg?{query}";
        }

        private static string GetPaymentCode(InvoiceDto invoice)
        {
            if (!string.IsNullOrWhiteSpace(invoice.PaymentCode))
                return invoice.PaymentCode.Trim();

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
                "final" => "Hóa đơn chốt hợp đồng",
                "monthly" => "Hóa đơn tháng",
                _ => string.IsNullOrWhiteSpace(invoiceType) ? "Hóa đơn" : invoiceType.Trim()
            };
        }

        private static string FormatBillingMonth(DateOnly? value)
        {
            if (!value.HasValue)
                return "Không có dữ liệu";

            return $"Tháng {value.Value.Month:00}/{value.Value.Year}";
        }

        private static string FormatDateTime(DateTime? value)
        {
            return value.HasValue ? value.Value.ToLocalTime().ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture) : "Không có dữ liệu";
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
