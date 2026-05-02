using NhaTro.Dtos.Reports;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Globalization;

namespace NhaTro.Services
{
    public class ReportService : IReportService
    {
        private static readonly object FontRegistrationLock = new();
        private static bool _fontsRegistered;

        private readonly IInvoiceRepository _invoiceRepository;
        private readonly IPaymentTransactionRepository _paymentTransactionRepository;
        private readonly ITransactionRepository _transactionRepository;

        public ReportService(
            IInvoiceRepository invoiceRepository,
            IPaymentTransactionRepository paymentTransactionRepository,
            ITransactionRepository transactionRepository)
        {
            _invoiceRepository = invoiceRepository;
            _paymentTransactionRepository = paymentTransactionRepository;
            _transactionRepository = transactionRepository;
            EnsurePdfFontsRegistered();
        }

        public async Task<MonthlyRevenueDto> GetMonthlyRevenueAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var invoices = await _invoiceRepository.GetAllAsync(null, billingMonth, null);
            var transactions = await _transactionRepository.GetAllAsync(billingMonth, "income");

            var paidInvoicesRevenue = invoices
                .Where(x => x.ReplacedByInvoiceId == null)
                .Sum(CalculateRecognizedRevenue);

            var extraIncome = transactions
                .Where(x => !x.RelatedInvoiceId.HasValue)
                .Sum(x => x.Amount);
            var totalRevenue = paidInvoicesRevenue + extraIncome;

            return new MonthlyRevenueDto
            {
                Month = billingMonth,
                PaidInvoicesRevenue = paidInvoicesRevenue,
                ExtraIncome = extraIncome,
                TotalRevenue = totalRevenue
            };
        }

        public async Task<MonthlyExpenseDto> GetMonthlyExpenseAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var expenses = await _transactionRepository.GetAllAsync(billingMonth, "expense");
            var totalExpense = expenses.Sum(x => x.Amount);

            return new MonthlyExpenseDto
            {
                Month = billingMonth,
                TotalExpense = totalExpense
            };
        }

        public async Task<MonthlyProfitLossDto> GetMonthlyProfitLossAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var revenue = await GetMonthlyRevenueAsync(billingMonth);
            var expense = await GetMonthlyExpenseAsync(billingMonth);

            return new MonthlyProfitLossDto
            {
                Month = billingMonth,
                TotalRevenue = revenue.TotalRevenue,
                TotalExpense = expense.TotalExpense,
                ProfitLoss = revenue.TotalRevenue - expense.TotalExpense
            };
        }

        public async Task<List<PaymentStatusItemDto>> GetPaymentStatusAsync(DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);

            var invoices = await _invoiceRepository.GetAllAsync(null, billingMonth, null);

            return invoices
                .Where(x => x.InvoiceType == "monthly" && x.ReplacedByInvoiceId == null)
                .OrderBy(x => x.RoomId)
                .Select(x => new PaymentStatusItemDto
                {
                    InvoiceId = x.InvoiceId,
                    RoomId = x.RoomId,
                    ContractId = x.ContractId,
                    BillingMonth = x.BillingMonth,
                    TotalAmount = x.TotalAmount,
                    Status = x.Status,
                    PaymentCode = x.PaymentCode
                })
                .ToList();
        }

        public async Task<SalesLedgerDto> GetSalesLedgerAsync(DateOnly fromMonth, DateOnly toMonth)
        {
            var (fromDate, toDate) = GetSalesLedgerRange(fromMonth, toMonth);

            var paymentTransactions = await _paymentTransactionRepository.GetAllAsync("paid");
            var rows = paymentTransactions
                .Where(IsQualifiedSalesLedgerPayment)
                .Select(payment => new
                {
                    Payment = payment,
                    TransactionDate = ResolveLedgerDate(payment)
                })
                .Where(x => x.TransactionDate >= fromDate && x.TransactionDate <= toDate)
                .OrderBy(x => x.TransactionDate)
                .ThenBy(x => x.Payment.PaymentTransactionId)
                .Select(x => MapToSalesLedgerRow(x.Payment, x.TransactionDate))
                .ToList();

            return new SalesLedgerDto
            {
                FromDate = fromDate,
                ToDate = toDate,
                TotalAmount = rows.Sum(x => x.Amount),
                Rows = rows
            };
        }

        public async Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerPdfRequestDto request)
        {
            var ledger = await GetSalesLedgerAsync(request.FromMonth, request.ToMonth);

            using var stream = new MemoryStream();

            Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(32);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(TextStyle.Default.FontSize(11).FontFamily("Lato", "Arial"));

                    page.Content().Column(column =>
                    {
                        column.Spacing(14);
                        column.Item().Element(content => ComposeSalesLedgerPdf(content, ledger, request));
                    });
                });
            }).GeneratePdf(stream);

            return stream.ToArray();
        }

        public string BuildSalesLedgerPdfFileName(DateOnly fromMonth, DateOnly toMonth)
        {
            var normalizedFrom = NormalizeMonth(fromMonth);
            var normalizedTo = NormalizeMonth(toMonth);
            return $"SoDoanhThu-{normalizedFrom:yyyy-MM}-den-{normalizedTo:yyyy-MM}.pdf";
        }

        private static DateOnly NormalizeMonth(DateOnly date)
        {
            return new DateOnly(date.Year, date.Month, 1);
        }

        private static (DateOnly FromDate, DateOnly ToDate) GetSalesLedgerRange(int year, int period)
        {
            return period switch
            {
                1 => (new DateOnly(year, 1, 1), new DateOnly(year, 6, 30)),
                2 => (new DateOnly(year, 7, 1), new DateOnly(year, 12, 31)),
                _ => throw new ArgumentException("Period chỉ được là 1 hoặc 2.")
            };
        }

        private static (DateOnly FromDate, DateOnly ToDate) GetSalesLedgerRange(DateOnly fromMonth, DateOnly toMonth)
        {
            var normalizedFrom = NormalizeMonth(fromMonth);
            var normalizedTo = NormalizeMonth(toMonth);

            if (normalizedFrom > normalizedTo)
            {
                throw new ArgumentException("Tháng bắt đầu không được lớn hơn tháng kết thúc.");
            }

            return (
                new DateOnly(normalizedFrom.Year, normalizedFrom.Month, 1),
                new DateOnly(normalizedTo.Year, normalizedTo.Month, DateTime.DaysInMonth(normalizedTo.Year, normalizedTo.Month))
            );
        }

        private static string BuildLedgerPeriodLabel(DateOnly fromDate, DateOnly toDate)
        {
            return $"Từ tháng {fromDate.Month:00}/{fromDate.Year} đến tháng {toDate.Month:00}/{toDate.Year}";
        }

        private static bool IsQualifiedSalesLedgerPayment(Models.PaymentTransaction payment)
        {
            return string.Equals(payment.ProcessStatus, "paid", StringComparison.OrdinalIgnoreCase)
                && string.Equals(payment.TransferType, "in", StringComparison.OrdinalIgnoreCase)
                && payment.TransferAmount.HasValue
                && payment.TransferAmount.Value > 0;
        }

        private static DateOnly ResolveLedgerDate(Models.PaymentTransaction payment)
        {
            if (payment.TransactionDate.HasValue)
            {
                return DateOnly.FromDateTime(payment.TransactionDate.Value);
            }

            if (payment.ProcessedAt.HasValue)
            {
                return DateOnly.FromDateTime(payment.ProcessedAt.Value);
            }

            return DateOnly.FromDateTime(payment.CreatedAt);
        }

        private static SalesLedgerRowDto MapToSalesLedgerRow(Models.PaymentTransaction payment, DateOnly transactionDate)
        {
            var roomCode = payment.MatchedInvoice?.Room?.RoomCode;
            var paymentCode = payment.PaymentCode?.Trim();
            var referenceCode = payment.ReferenceCode?.Trim();
            var invoiceId = payment.MatchedInvoiceId;
            var descriptionParts = new List<string>();

            if (!string.IsNullOrWhiteSpace(roomCode))
            {
                descriptionParts.Add($"Thu tiền phòng {roomCode}");
            }
            else if (invoiceId.HasValue)
            {
                descriptionParts.Add($"Thu tiền hóa đơn #{invoiceId.Value}");
            }
            else
            {
                descriptionParts.Add("Thu tiền chuyển khoản");
            }

            if (!string.IsNullOrWhiteSpace(paymentCode))
            {
                descriptionParts.Add($"mã {paymentCode}");
            }

            if (!string.IsNullOrWhiteSpace(referenceCode))
            {
                descriptionParts.Add($"ref {referenceCode}");
            }

            return new SalesLedgerRowDto
            {
                PaymentTransactionId = payment.PaymentTransactionId,
                TransactionDate = transactionDate,
                Description = string.Join(" - ", descriptionParts),
                Amount = payment.TransferAmount ?? 0,
                RoomCode = roomCode,
                PaymentCode = paymentCode,
                ReferenceCode = referenceCode
            };
        }

        private static decimal CalculateRecognizedRevenue(Models.Invoice invoice)
        {
            var recognizedRevenue = invoice.TotalAmount - invoice.DebtAmount;
            return recognizedRevenue > 0 ? recognizedRevenue : 0;
        }

        private static void ComposeSalesLedgerPdf(IContainer container, SalesLedgerDto ledger, SalesLedgerPdfRequestDto request)
        {
            container.Column(column =>
            {
                column.Spacing(10);

                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(left =>
                    {
                        left.Spacing(5);
                        left.Item().Text($"HỘ, CÁ NHÂN KINH DOANH: {NormalizePrintableValue(request.BusinessOwnerName, 24)}").SemiBold();
                        left.Item().Text($"Địa chỉ: {NormalizePrintableValue(request.Address, 34)}").SemiBold();
                        left.Item().Text($"Mã số thuế: {NormalizePrintableValue(request.TaxCode, 28)}").SemiBold();
                    });

                    row.RelativeItem().AlignRight().Column(right =>
                    {
                        right.Spacing(4);
                        right.Item().AlignRight().Text("Mẫu số S1a-HKD").SemiBold();
                        right.Item().AlignRight().Text("(Kèm theo Thông tư số 152/2025/TT-BTC").Italic();
                        right.Item().AlignRight().Text("ngày 31 tháng 12 năm 2025 của Bộ trưởng").Italic();
                        right.Item().AlignRight().Text("Bộ Tài chính)").Italic();
                    });
                });

                column.Item().PaddingTop(10).AlignCenter().Column(center =>
                {
                    center.Spacing(4);
                    center.Item().Text("SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ").FontSize(15).SemiBold();
                    center.Item().Text($"Địa điểm kinh doanh: {NormalizePrintableValue(request.BusinessLocation, 28)}");
                    center.Item().Text($"Kỳ kê khai: {BuildLedgerPeriodLabel(ledger.FromDate, ledger.ToDate)}");
                });

                column.Item().AlignRight().Text("Đơn vị tính: đồng").Italic();

                column.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(120);
                        columns.RelativeColumn();
                        columns.ConstantColumn(165);
                    });

                    table.Header(header =>
                    {
                        header.Cell().Element(cell => DefaultTableCell(cell, true)).AlignCenter().Text("Ngày tháng").SemiBold();
                        header.Cell().Element(cell => DefaultTableCell(cell, true)).AlignCenter().Text("Diễn giải").SemiBold();
                        header.Cell().Element(cell => DefaultTableCell(cell, true)).AlignCenter().Text("Số tiền").SemiBold();

                        header.Cell().Element(cell => DefaultTableCell(cell, true)).AlignCenter().Text("A").SemiBold();
                        header.Cell().Element(cell => DefaultTableCell(cell, true)).AlignCenter().Text("B").SemiBold();
                        header.Cell().Element(cell => DefaultTableCell(cell, true)).AlignCenter().Text("1").SemiBold();
                    });

                    foreach (var row in EnsureMinimumRows(ledger.Rows, 8))
                    {
                        AddBodyCell(table, row == null ? string.Empty : row.TransactionDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture));
                        AddBodyCell(table, row?.Description ?? string.Empty);
                        AddBodyCell(table, row == null ? string.Empty : FormatMoney(row.Amount), align: "right");
                    }

                    AddFooterCell(table, string.Empty);
                    AddFooterCell(table, "Tổng cộng", "center", true);
                    AddFooterCell(table, FormatMoney(ledger.TotalAmount), "right", true);
                });
            });
        }

        private static IEnumerable<SalesLedgerRowDto?> EnsureMinimumRows(List<SalesLedgerRowDto> rows, int minimumRows)
        {
            if (rows.Count >= minimumRows)
            {
                return rows.Cast<SalesLedgerRowDto?>();
            }

            var result = rows.Cast<SalesLedgerRowDto?>().ToList();
            while (result.Count < minimumRows)
            {
                result.Add(null);
            }

            return result;
        }

        private static void AddBodyCell(TableDescriptor table, string text, string align = "left", bool semiBold = false)
        {
            var cell = table.Cell().Element(container => DefaultTableCell(container, false));
            if (string.Equals(align, "right", StringComparison.OrdinalIgnoreCase))
            {
                cell = cell.AlignRight();
            }
            else if (string.Equals(align, "center", StringComparison.OrdinalIgnoreCase))
            {
                cell = cell.AlignCenter();
            }

            var textDescriptor = cell.Text(text);
            if (semiBold)
            {
                textDescriptor.SemiBold();
            }
        }

        private static void AddFooterCell(TableDescriptor table, string text, string align = "left", bool semiBold = false)
        {
            AddBodyCell(table, text, align, semiBold);
        }

        private static IContainer DefaultTableCell(IContainer container, bool shaded)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Grey.Medium)
                .Background(shaded ? Colors.Grey.Lighten4 : Colors.White)
                .PaddingVertical(6)
                .PaddingHorizontal(8);
        }

        private static string NormalizePrintableValue(string? value, int dotLength)
        {
            var trimmed = value?.Trim();
            if (!string.IsNullOrWhiteSpace(trimmed))
            {
                return trimmed;
            }

            return new string('.', dotLength);
        }

        private static string FormatMoney(decimal value)
        {
            return string.Format(CultureInfo.GetCultureInfo("vi-VN"), "{0:N0}", value);
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
    }
}
