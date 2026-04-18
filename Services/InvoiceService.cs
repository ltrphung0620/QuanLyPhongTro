using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class InvoiceService : IInvoiceService
    {
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IContractRepository _contractRepo;
        private readonly IMeterReadingRepository _meterRepo;
        private readonly IRoomRepository _roomRepo;
        private readonly ITransactionRepository _transactionRepo;

        private const decimal WATER_PER_PERSON = 50000;
        private const decimal TRASH_FEE = 30000;

        public InvoiceService(
            IInvoiceRepository invoiceRepo,
            IContractRepository contractRepo,
            IMeterReadingRepository meterRepo,
            IRoomRepository roomRepo,
            ITransactionRepository transactionRepo)
        {
            _invoiceRepo = invoiceRepo;
            _contractRepo = contractRepo;
            _meterRepo = meterRepo;
            _roomRepo = roomRepo;
            _transactionRepo = transactionRepo;
        }

        public async Task<List<InvoiceDto>> GetAllAsync(int? roomId = null, DateOnly? month = null, string? status = null)
        {
            DateOnly? normalizedMonth = month.HasValue ? NormalizeMonth(month.Value) : null;
            var data = await _invoiceRepo.GetAllAsync(roomId, normalizedMonth, status);
            return data.Select(MapToDto).ToList();
        }

        public async Task<InvoiceDto?> GetByIdAsync(int invoiceId)
        {
            var invoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            return invoice == null ? null : MapToDto(invoice);
        }

        public async Task<InvoicePreviewDto> PreviewAsync(CreateInvoiceDto dto)
        {
            var billingMonth = NormalizeMonth(dto.BillingMonth);

            var contract = await _contractRepo.GetActiveByRoomIdAsync(dto.RoomId);
            if (contract == null)
                throw new InvalidOperationException("Contract khong hop le.");

            var existed = await _invoiceRepo.GetByRoomAndMonthAsync(dto.RoomId, billingMonth);
            if (existed != null)
                throw new InvalidOperationException("Da co hoa don thang nay.");

            var meter = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, billingMonth);

            var electricity = meter?.Amount ?? 0;
            var (fromDate, toDate) = GetInvoiceCoveragePeriod(contract, billingMonth);
            var roomFee = CalculateRoomFeeForBillingMonth(contract, billingMonth, fromDate, toDate);
            var water = contract.OccupantCount * WATER_PER_PERSON;
            var trash = TRASH_FEE;
            var extraChargeInfo = await GetPendingExtraChargeInfoAsync(dto.RoomId, billingMonth);
            var discount = dto.DiscountAmount;
            var carryOver = await GetCarryOverInfoAsync(dto.RoomId, billingMonth);
            var debt = dto.DebtAmount + carryOver.Amount;

            var total = roomFee + electricity + water + trash + extraChargeInfo.Amount + debt - discount;
            if (total < 0) total = 0;

            return new InvoicePreviewDto
            {
                RoomId = dto.RoomId,
                ContractId = contract.ContractId,
                BillingMonth = billingMonth,
                FromDate = fromDate,
                ToDate = toDate,
                RoomFee = roomFee,
                ElectricityFee = electricity,
                WaterFee = water,
                TrashFee = trash,
                ExtraFee = extraChargeInfo.Amount,
                DiscountAmount = discount,
                DebtAmount = debt,
                TotalAmount = total
            };
        }

        public async Task<InvoiceDto> CreateAsync(CreateInvoiceDto dto)
        {
            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var preview = await PreviewAsync(dto);
            var carryOver = await GetCarryOverInfoAsync(dto.RoomId, billingMonth);

            var invoice = new Invoice
            {
                RoomId = dto.RoomId,
                ContractId = preview.ContractId,
                InvoiceType = "monthly",
                BillingMonth = billingMonth,
                FromDate = preview.FromDate,
                ToDate = preview.ToDate,
                RoomFee = preview.RoomFee,
                ElectricityFee = preview.ElectricityFee,
                WaterFee = preview.WaterFee,
                TrashFee = preview.TrashFee,
                ExtraFee = preview.ExtraFee,
                DiscountAmount = preview.DiscountAmount,
                DebtAmount = preview.DebtAmount,
                TotalAmount = preview.TotalAmount,
                Status = "unpaid",
                PaymentCode = await GeneratePaymentCodeAsync("monthly", billingMonth, dto.RoomId),
                ExtraFeeNote = (await GetPendingExtraChargeInfoAsync(dto.RoomId, billingMonth)).Note,
                Note = carryOver.Note,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _invoiceRepo.AddAsync(invoice);
            await _invoiceRepo.SaveChangesAsync();
            await AttachPendingTransactionsToInvoiceAsync(invoice);

            var refreshedInvoice = await _invoiceRepo.GetByIdAsync(invoice.InvoiceId) ?? invoice;
            return MapToDto(refreshedInvoice);
        }

        public async Task<InvoiceDto?> GetByRoomAndMonthAsync(int roomId, DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);
            var invoice = await _invoiceRepo.GetByRoomAndMonthAsync(roomId, billingMonth);
            return invoice == null ? null : MapToDto(invoice);
        }

        public async Task<List<InvoiceDto>> GetUnpaidAsync(DateOnly? month = null)
        {
            DateOnly? normalizedMonth = month.HasValue ? NormalizeMonth(month.Value) : null;
            var data = await _invoiceRepo.GetUnpaidAsync(normalizedMonth);
            return data.Select(MapToDto).ToList();
        }

        public async Task<InvoiceDto?> GetByPaymentCodeAsync(string paymentCode)
        {
            var invoice = await _invoiceRepo.GetByPaymentCodeAsync(paymentCode);
            return invoice == null ? null : MapToDto(invoice);
        }

        public async Task<InvoiceDto?> MarkPaidAsync(int invoiceId, MarkInvoicePaidDto dto)
        {
            var invoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (invoice == null)
                return null;

            if (invoice.Status == "paid")
                throw new InvalidOperationException("Hoa don da thanh toan roi.");

            var oldRemainingAmount = GetRemainingAmount(invoice);
            var paidAmount = dto.Amount > 0 ? dto.Amount : invoice.TotalAmount;
            var effectivePaidAmount = Math.Min(paidAmount, invoice.TotalAmount);
            var remainingAmount = invoice.TotalAmount - effectivePaidAmount;

            invoice.Status = "paid";
            invoice.PaidAt = DateTime.UtcNow;
            invoice.PaidAmount = effectivePaidAmount;
            invoice.PaymentMethod = NormalizePaymentMethod(dto.PaymentMethod);
            invoice.PaymentReference = string.IsNullOrWhiteSpace(dto.PaymentReference) ? null : dto.PaymentReference.Trim();
            invoice.Note = BuildPaymentNote(invoice.Note, dto.Note, effectivePaidAmount, remainingAmount);
            invoice.UpdatedAt = DateTime.UtcNow;

            await ApplyCarryOverAdjustmentToNextInvoiceAsync(invoice, oldRemainingAmount, remainingAmount);

            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<InvoiceDto?> MarkUnpaidAsync(int invoiceId)
        {
            var invoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (invoice == null)
                return null;

            var oldRemainingAmount = GetRemainingAmount(invoice);

            invoice.Status = "unpaid";
            invoice.PaidAt = null;
            invoice.PaidAmount = null;
            invoice.PaymentMethod = null;
            invoice.PaymentReference = null;
            invoice.UpdatedAt = DateTime.UtcNow;

            await ApplyCarryOverAdjustmentToNextInvoiceAsync(invoice, oldRemainingAmount, invoice.TotalAmount);

            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<InvoiceDto?> UpdateElectricityAsync(UpdateInvoiceElectricityDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.RoomCode))
                throw new ArgumentException("RoomCode khong hop le.");

            var room = await _roomRepo.GetByRoomCodeAsync(dto.RoomCode);
            if (room == null)
                throw new InvalidOperationException("Khong tim thay phong theo roomCode.");

            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var invoice = await _invoiceRepo.GetByRoomAndMonthAsync(room.RoomId, billingMonth);
            if (invoice == null)
                return null;

            invoice.ElectricityFee = dto.ElectricityFee;
            invoice.TotalAmount = CalculateInvoiceTotal(
                invoice.RoomFee,
                invoice.ElectricityFee,
                invoice.WaterFee,
                invoice.TrashFee,
                invoice.ExtraFee,
                invoice.DebtAmount,
                invoice.DiscountAmount);

            if (dto.Note != null)
                invoice.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();

            invoice.UpdatedAt = DateTime.UtcNow;

            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<List<InvoiceBulkPreviewItemDto>> MonthlyBulkPreviewAsync(InvoiceBulkCreateDto dto)
        {
            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var activeContracts = await _contractRepo.GetAllAsync("active", null);

            var result = new List<InvoiceBulkPreviewItemDto>();

            foreach (var contract in activeContracts)
            {
                var existed = await _invoiceRepo.GetByRoomAndMonthAsync(contract.RoomId, billingMonth);
                if (existed != null)
                    continue;

                var meter = await _meterRepo.GetByContractAndMonthAsync(contract.ContractId, billingMonth);

                var electricity = meter?.Amount ?? 0;
                var (fromDate, toDate) = GetInvoiceCoveragePeriod(contract, billingMonth);
                var roomFee = CalculateRoomFeeForBillingMonth(contract, billingMonth, fromDate, toDate);
                var water = contract.OccupantCount * WATER_PER_PERSON;
                var trash = TRASH_FEE;
                var extraChargeInfo = await GetPendingExtraChargeInfoAsync(contract.RoomId, billingMonth);
                var discount = dto.DefaultDiscountAmount;
                var carryOver = await GetCarryOverInfoAsync(contract.RoomId, billingMonth);
                var debt = dto.DefaultDebtAmount + carryOver.Amount;
                var total = roomFee + electricity + water + trash + extraChargeInfo.Amount + debt - discount;

                if (total < 0) total = 0;

                result.Add(new InvoiceBulkPreviewItemDto
                {
                    RoomId = contract.RoomId,
                    ContractId = contract.ContractId,
                    RoomCode = contract.Room?.RoomCode ?? string.Empty,
                    TenantName = contract.Tenant?.FullName ?? string.Empty,
                    FromDate = fromDate,
                    ToDate = toDate,
                    RoomFee = roomFee,
                    ElectricityFee = electricity,
                    WaterFee = water,
                    TrashFee = trash,
                    ExtraFee = extraChargeInfo.Amount,
                    DiscountAmount = discount,
                    DebtAmount = debt,
                    TotalAmount = total
                });
            }

            return result;
        }

        public async Task<List<InvoiceDto>> MonthlyBulkCreateAsync(InvoiceBulkCreateDto dto)
        {
            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var previews = await MonthlyBulkPreviewAsync(dto);
            var createdInvoices = new List<Invoice>();

            foreach (var item in previews)
            {
                var invoice = new Invoice
                {
                    RoomId = item.RoomId,
                    ContractId = item.ContractId,
                    InvoiceType = "monthly",
                    BillingMonth = billingMonth,
                    FromDate = item.FromDate,
                    ToDate = item.ToDate,
                    RoomFee = item.RoomFee,
                    ElectricityFee = item.ElectricityFee,
                    WaterFee = item.WaterFee,
                    TrashFee = item.TrashFee,
                    ExtraFee = item.ExtraFee,
                    DiscountAmount = item.DiscountAmount,
                    DebtAmount = item.DebtAmount,
                    TotalAmount = item.TotalAmount,
                    Status = "unpaid",
                    PaymentCode = await GeneratePaymentCodeAsync("monthly", billingMonth, item.RoomId),
                    ExtraFeeNote = (await GetPendingExtraChargeInfoAsync(item.RoomId, billingMonth)).Note,
                    Note = (await GetCarryOverInfoAsync(item.RoomId, billingMonth)).Note,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _invoiceRepo.AddAsync(invoice);
                createdInvoices.Add(invoice);
            }

            await _invoiceRepo.SaveChangesAsync();
            foreach (var invoice in createdInvoices)
            {
                await AttachPendingTransactionsToInvoiceAsync(invoice);
            }

            return createdInvoices.Select(MapToDto).ToList();
        }

        public async Task<InvoiceDto?> ReplaceAsync(int invoiceId, InvoiceReplaceDto dto)
        {
            var oldInvoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (oldInvoice == null)
                return null;

            if (oldInvoice.ReplacedByInvoiceId != null)
                throw new InvalidOperationException("Hoa don nay da duoc thay the.");

            var billingMonth = oldInvoice.BillingMonth.HasValue
                ? NormalizeMonth(oldInvoice.BillingMonth.Value)
                : DateOnly.FromDateTime(DateTime.UtcNow);

            var total = dto.RoomFee + dto.ElectricityFee + dto.WaterFee + dto.TrashFee + dto.DebtAmount - dto.DiscountAmount;
            if (total < 0) total = 0;

            var newInvoice = new Invoice
            {
                RoomId = oldInvoice.RoomId,
                ContractId = oldInvoice.ContractId,
                InvoiceType = oldInvoice.InvoiceType,
                BillingMonth = billingMonth,
                FromDate = oldInvoice.FromDate,
                ToDate = oldInvoice.ToDate,
                RoomFee = dto.RoomFee,
                ElectricityFee = dto.ElectricityFee,
                WaterFee = dto.WaterFee,
                TrashFee = dto.TrashFee,
                ExtraFee = oldInvoice.ExtraFee,
                DiscountAmount = dto.DiscountAmount,
                DebtAmount = dto.DebtAmount,
                TotalAmount = CalculateInvoiceTotal(
                    dto.RoomFee,
                    dto.ElectricityFee,
                    dto.WaterFee,
                    dto.TrashFee,
                    oldInvoice.ExtraFee,
                    dto.DebtAmount,
                    dto.DiscountAmount),
                Status = "unpaid",
                PaymentCode = await GeneratePaymentCodeAsync(oldInvoice.InvoiceType, billingMonth, oldInvoice.RoomId),
                ExtraFeeNote = oldInvoice.ExtraFeeNote,
                Note = dto.Note,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _invoiceRepo.AddAsync(newInvoice);
            await _invoiceRepo.SaveChangesAsync();

            oldInvoice.ReplacedByInvoiceId = newInvoice.InvoiceId;
            oldInvoice.UpdatedAt = DateTime.UtcNow;
            _invoiceRepo.Update(oldInvoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(newInvoice);
        }

        public async Task<InvoiceDto?> UpdateAsync(int invoiceId, UpdateInvoiceDto dto)
        {
            var invoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (invoice == null)
                return null;

            if (dto.RoomFee.HasValue)
                invoice.RoomFee = dto.RoomFee.Value;

            if (dto.ElectricityFee.HasValue)
                invoice.ElectricityFee = dto.ElectricityFee.Value;

            if (dto.WaterFee.HasValue)
                invoice.WaterFee = dto.WaterFee.Value;

            if (dto.TrashFee.HasValue)
                invoice.TrashFee = dto.TrashFee.Value;

            if (dto.DiscountAmount.HasValue)
                invoice.DiscountAmount = dto.DiscountAmount.Value;

            if (dto.DebtAmount.HasValue)
                invoice.DebtAmount = dto.DebtAmount.Value;

            if (dto.Note != null)
                invoice.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();

            invoice.TotalAmount = CalculateInvoiceTotal(
                invoice.RoomFee,
                invoice.ElectricityFee,
                invoice.WaterFee,
                invoice.TrashFee,
                invoice.ExtraFee,
                invoice.DebtAmount,
                invoice.DiscountAmount);

            invoice.UpdatedAt = DateTime.UtcNow;

            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<bool> DeleteAsync(int invoiceId)
        {
            var invoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (invoice == null)
                return false;

            if (invoice.Status == "paid")
                throw new InvalidOperationException("Khong the xoa hoa don da thanh toan.");

            var deleted = await _invoiceRepo.DeleteAsync(invoiceId);
            if (deleted)
                await _invoiceRepo.SaveChangesAsync();

            return deleted;
        }

        private static DateOnly NormalizeMonth(DateOnly date)
        {
            return new DateOnly(date.Year, date.Month, 1);
        }

        private static decimal CalculateInvoiceTotal(
            decimal roomFee,
            decimal electricityFee,
            decimal waterFee,
            decimal trashFee,
            decimal extraFee,
            decimal debtAmount,
            decimal discountAmount)
        {
            var total = roomFee + electricityFee + waterFee + trashFee + extraFee + debtAmount - discountAmount;
            return total < 0 ? 0 : total;
        }

        private static (DateOnly FromDate, DateOnly ToDate) GetInvoiceCoveragePeriod(Contract contract, DateOnly billingMonth)
        {
            var monthStart = NormalizeMonth(billingMonth);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var fromDate = contract.StartDate > monthStart ? contract.StartDate : monthStart;
            var toDate = monthEnd;

            if (contract.ActualEndDate.HasValue && contract.ActualEndDate.Value < toDate)
            {
                toDate = contract.ActualEndDate.Value;
            }

            if (toDate < fromDate)
            {
                toDate = fromDate;
            }

            return (fromDate, toDate);
        }

        private static decimal CalculateRoomFeeForBillingMonth(Contract contract, DateOnly billingMonth, DateOnly fromDate, DateOnly toDate)
        {
            var monthStart = NormalizeMonth(billingMonth);
            if (fromDate == monthStart && toDate == monthStart.AddMonths(1).AddDays(-1))
            {
                return contract.ActualRoomPrice;
            }

            var daysInMonth = DateTime.DaysInMonth(billingMonth.Year, billingMonth.Month);
            var occupiedDays = toDate.DayNumber - fromDate.DayNumber + 1;
            if (occupiedDays <= 0 || daysInMonth <= 0)
            {
                return 0;
            }

            return Math.Round((contract.ActualRoomPrice / daysInMonth) * occupiedDays, 2, MidpointRounding.AwayFromZero);
        }

        private async Task<(decimal Amount, string? Note)> GetCarryOverInfoAsync(int roomId, DateOnly billingMonth)
        {
            var previousInvoice = await _invoiceRepo.GetLatestBeforeMonthAsync(roomId, billingMonth);
            if (previousInvoice == null)
                return (0, null);

            var remainingAmount = GetRemainingAmount(previousInvoice);
            if (remainingAmount <= 0)
                return (0, null);

            return (remainingAmount, BuildCarryOverNote(previousInvoice, remainingAmount));
        }

        private async Task<(decimal Amount, string? Note)> GetPendingExtraChargeInfoAsync(int roomId, DateOnly billingMonth)
        {
            var pendingTransactions = await _transactionRepo.GetPendingRoomChargeTransactionsAsync(roomId, billingMonth);
            if (pendingTransactions.Count == 0)
            {
                return (0, null);
            }

            return (
                pendingTransactions.Sum(x => x.Amount),
                TransactionService.BuildExtraFeeNote(pendingTransactions));
        }

        private async Task AttachPendingTransactionsToInvoiceAsync(Invoice invoice)
        {
            if (!invoice.BillingMonth.HasValue)
            {
                return;
            }

            var pendingTransactions = await _transactionRepo.GetPendingRoomChargeTransactionsAsync(invoice.RoomId, invoice.BillingMonth.Value);
            if (pendingTransactions.Count == 0)
            {
                return;
            }

            foreach (var transaction in pendingTransactions)
            {
                transaction.RelatedInvoiceId = invoice.InvoiceId;
                _transactionRepo.Update(transaction);
            }

            await _transactionRepo.SaveChangesAsync();
        }

        private async Task ApplyCarryOverAdjustmentToNextInvoiceAsync(Invoice sourceInvoice, decimal oldRemainingAmount, decimal newRemainingAmount)
        {
            if (!sourceInvoice.BillingMonth.HasValue)
                return;

            var nextMonth = sourceInvoice.BillingMonth.Value.AddMonths(1);
            var nextInvoice = await _invoiceRepo.GetByRoomAndMonthAsync(sourceInvoice.RoomId, nextMonth);
            if (nextInvoice == null)
                return;

            var delta = newRemainingAmount - oldRemainingAmount;
            if (delta == 0)
                return;

            nextInvoice.DebtAmount = Math.Max(0, nextInvoice.DebtAmount + delta);
            nextInvoice.TotalAmount = CalculateInvoiceTotal(
                nextInvoice.RoomFee,
                nextInvoice.ElectricityFee,
                nextInvoice.WaterFee,
                nextInvoice.TrashFee,
                nextInvoice.ExtraFee,
                nextInvoice.DebtAmount,
                nextInvoice.DiscountAmount);
            nextInvoice.Note = UpsertCarryOverNote(nextInvoice.Note, sourceInvoice, newRemainingAmount);
            nextInvoice.UpdatedAt = DateTime.UtcNow;

            _invoiceRepo.Update(nextInvoice);
        }

        private async Task<string> GeneratePaymentCodeAsync(string? invoiceType, DateOnly billingMonth, int roomId)
        {
            var room = await _roomRepo.GetByIdAsync(roomId)
                ?? throw new InvalidOperationException("Khong tim thay phong de sinh ma hoa don.");

            var roomCode = SanitizePaymentCodePart(room.RoomCode);
            var monthPart = billingMonth.Month.ToString("00");
            var yearPart = billingMonth.Year.ToString("0000");
            var prefix = string.Equals(invoiceType?.Trim(), "final", StringComparison.OrdinalIgnoreCase)
                ? "FINAL"
                : string.Empty;
            var baseCode = $"{prefix}{roomCode}{monthPart}{yearPart}";

            if (!await _invoiceRepo.PaymentCodeExistsAsync(baseCode))
            {
                return baseCode;
            }

            for (var suffix = 2; suffix <= 99; suffix++)
            {
                var candidate = $"{baseCode}{suffix:00}";
                if (!await _invoiceRepo.PaymentCodeExistsAsync(candidate))
                    return candidate;
            }

            throw new InvalidOperationException("Khong the sinh ma hoa don duy nhat. Vui long thu lai.");
        }

        private static string SanitizePaymentCodePart(string? value)
        {
            var cleaned = new string((value ?? string.Empty)
                .Trim()
                .ToUpperInvariant()
                .Where(char.IsLetterOrDigit)
                .ToArray());

            return string.IsNullOrWhiteSpace(cleaned) ? "ROOM" : cleaned;
        }

        private static string? BuildPaymentNote(string? existingNote, string? requestNote, decimal paidAmount, decimal remainingAmount)
        {
            var parts = new List<string>();

            if (!string.IsNullOrWhiteSpace(existingNote))
                parts.Add(existingNote.Trim());

            if (!string.IsNullOrWhiteSpace(requestNote))
                parts.Add(requestNote.Trim());

            if (remainingAmount > 0)
            {
                parts.Add($"Thanh toán một phần: đã thu {FormatMoney(paidAmount)}, còn thiếu {FormatMoney(remainingAmount)}. Phần còn thiếu sẽ chuyển thành nợ cũ của hóa đơn tháng sau.");
            }

            if (parts.Count == 0)
                return null;

            return string.Join(" | ", parts.Distinct());
        }

        private static string? UpsertCarryOverNote(string? existingNote, Invoice sourceInvoice, decimal carryOverAmount)
        {
            var parts = SplitNoteParts(existingNote)
                .Where(part => !IsCarryOverNoteForInvoice(part, sourceInvoice))
                .ToList();

            if (carryOverAmount > 0)
            {
                parts.Add(BuildCarryOverNote(sourceInvoice, carryOverAmount));
            }

            return parts.Count == 0 ? null : string.Join(" | ", parts.Distinct());
        }

        private static bool IsCarryOverNoteForInvoice(string notePart, Invoice sourceInvoice)
        {
            var billingMonthText = sourceInvoice.BillingMonth.HasValue
                ? FormatBillingMonth(sourceInvoice.BillingMonth.Value)
                : string.Empty;

            return !string.IsNullOrWhiteSpace(notePart)
                && notePart.Contains("Đã cộng", StringComparison.OrdinalIgnoreCase)
                && notePart.Contains(billingMonthText, StringComparison.OrdinalIgnoreCase);
        }

        private static string BuildCarryOverNote(Invoice sourceInvoice, decimal carryOverAmount)
        {
            var billingMonthText = sourceInvoice.BillingMonth.HasValue
                ? FormatBillingMonth(sourceInvoice.BillingMonth.Value)
                : "tháng trước";

            return $"Đã cộng {FormatMoney(carryOverAmount)} từ hóa đơn {billingMonthText} còn thiếu.";
        }

        private static IEnumerable<string> SplitNoteParts(string? note)
        {
            return string.IsNullOrWhiteSpace(note)
                ? Enumerable.Empty<string>()
                : note.Split(" | ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        private static string FormatBillingMonth(DateOnly billingMonth)
        {
            return $"tháng {billingMonth.Month:00}/{billingMonth.Year}";
        }

        private static string FormatMoney(decimal amount)
        {
            return amount.ToString("N0", System.Globalization.CultureInfo.GetCultureInfo("vi-VN"));
        }

        private static string NormalizePaymentMethod(string? paymentMethod)
        {
            var normalized = string.IsNullOrWhiteSpace(paymentMethod)
                ? string.Empty
                : paymentMethod.Trim().ToLowerInvariant();

            if (normalized.Contains("sepay") || normalized.Contains("transfer") || normalized.Contains("bank") || normalized.Contains("chuyen"))
            {
                return "Chuyển khoản";
            }

            return "Tiền mặt";
        }

        private static decimal GetRemainingAmount(Invoice invoice)
        {
            var paidAmount = invoice.PaidAmount ?? 0;
            var remainingAmount = invoice.TotalAmount - paidAmount;
            return remainingAmount > 0 ? remainingAmount : 0;
        }

        private static InvoiceDto MapToDto(Invoice i)
        {
            return new InvoiceDto
            {
                InvoiceId = i.InvoiceId,
                RoomId = i.RoomId,
                RoomCode = i.Room?.RoomCode,
                ContractId = i.ContractId,
                InvoiceType = i.InvoiceType,
                BillingMonth = i.BillingMonth,
                FromDate = i.FromDate,
                ToDate = i.ToDate,
                RoomFee = i.RoomFee,
                ElectricityFee = i.ElectricityFee,
                WaterFee = i.WaterFee,
                TrashFee = i.TrashFee,
                ExtraFee = i.ExtraFee,
                DiscountAmount = i.DiscountAmount,
                DebtAmount = i.DebtAmount,
                TotalAmount = i.TotalAmount,
                Status = i.Status,
                PaymentCode = i.PaymentCode,
                PaidAt = i.PaidAt,
                PaidAmount = i.PaidAmount,
                PaymentMethod = i.PaymentMethod,
                PaymentReference = i.PaymentReference,
                ExtraFeeNote = i.ExtraFeeNote,
                Note = i.Note,
                CreatedAt = i.CreatedAt
            };
        }
    }
}
