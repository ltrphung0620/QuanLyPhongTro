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

        private const decimal WATER_PER_PERSON = 50000;
        private const decimal TRASH_FEE = 30000;

        public InvoiceService(
            IInvoiceRepository invoiceRepo,
            IContractRepository contractRepo,
            IMeterReadingRepository meterRepo,
            IRoomRepository roomRepo)
        {
            _invoiceRepo = invoiceRepo;
            _contractRepo = contractRepo;
            _meterRepo = meterRepo;
            _roomRepo = roomRepo;
        }

        public async Task<List<InvoiceDto>> GetAllAsync(int? roomId = null, DateOnly? month = null, string? status = null)
        {
            DateOnly? normalizedMonth = month.HasValue? NormalizeMonth(month.Value): null;
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
                throw new InvalidOperationException("Contract không hợp lệ.");

            var existed = await _invoiceRepo.GetByRoomAndMonthAsync(dto.RoomId, billingMonth);
            if (existed != null)
                throw new InvalidOperationException("Đã có hóa đơn tháng này.");

            var meter = await _meterRepo.GetByRoomAndMonthAsync(dto.RoomId, billingMonth);

            var electricity = meter?.Amount ?? 0;
            var roomFee = contract.ActualRoomPrice;
            var water = contract.OccupantCount * WATER_PER_PERSON;
            var trash = TRASH_FEE;
            var discount = dto.DiscountAmount;
            var debt = dto.DebtAmount;

            var total = roomFee + electricity + water + trash + debt - discount;
            if (total < 0) total = 0;

            return new InvoicePreviewDto
            {
                RoomId = dto.RoomId,
                ContractId = contract.ContractId,
                BillingMonth = billingMonth,
                RoomFee = roomFee,
                ElectricityFee = electricity,
                WaterFee = water,
                TrashFee = trash,
                DiscountAmount = discount,
                DebtAmount = debt,
                TotalAmount = total
            };
        }

        public async Task<InvoiceDto> CreateAsync(CreateInvoiceDto dto)
        {
            var billingMonth = NormalizeMonth(dto.BillingMonth);
            var preview = await PreviewAsync(dto);

            var invoice = new Invoice
            {
                RoomId = dto.RoomId,
                ContractId = preview.ContractId,
                InvoiceType = "monthly",
                BillingMonth = billingMonth,
                FromDate = billingMonth,
                ToDate = billingMonth.AddMonths(1).AddDays(-1),
                RoomFee = preview.RoomFee,
                ElectricityFee = preview.ElectricityFee,
                WaterFee = preview.WaterFee,
                TrashFee = preview.TrashFee,
                DiscountAmount = preview.DiscountAmount,
                DebtAmount = preview.DebtAmount,
                TotalAmount = preview.TotalAmount,
                Status = "unpaid",
                PaymentCode = GeneratePaymentCode(dto.RoomId, billingMonth),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _invoiceRepo.AddAsync(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<InvoiceDto?> GetByRoomAndMonthAsync(int roomId, DateOnly month)
        {
            var billingMonth = NormalizeMonth(month);
            var invoice = await _invoiceRepo.GetByRoomAndMonthAsync(roomId, billingMonth);
            return invoice == null ? null : MapToDto(invoice);
        }

        public async Task<List<InvoiceDto>> GetUnpaidAsync(DateOnly? month = null)
        {
            DateOnly? normalizedMonth = month.HasValue 
    ? NormalizeMonth(month.Value) 
    : null;
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
                throw new InvalidOperationException("Hóa đơn đã thanh toán rồi.");

            invoice.Status = "paid";
            invoice.PaidAt = DateTime.UtcNow;
            invoice.PaidAmount = dto.Amount > 0 ? dto.Amount : invoice.TotalAmount;
            invoice.PaymentMethod = string.IsNullOrWhiteSpace(dto.PaymentMethod) ? "manual" : dto.PaymentMethod.Trim();
            invoice.PaymentReference = string.IsNullOrWhiteSpace(dto.PaymentReference) ? null : dto.PaymentReference.Trim();
            invoice.UpdatedAt = DateTime.UtcNow;

            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<InvoiceDto?> MarkUnpaidAsync(int invoiceId)
        {
            var invoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (invoice == null)
                return null;

            invoice.Status = "unpaid";
            invoice.PaidAt = null;
            invoice.PaidAmount = null;
            invoice.PaymentMethod = null;
            invoice.PaymentReference = null;
            invoice.UpdatedAt = DateTime.UtcNow;

            _invoiceRepo.Update(invoice);
            await _invoiceRepo.SaveChangesAsync();

            return MapToDto(invoice);
        }

        public async Task<InvoiceDto?> UpdateElectricityAsync(UpdateInvoiceElectricityDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.RoomCode))
                throw new ArgumentException("RoomCode không hợp lệ.");

            var room = await _roomRepo.GetByRoomCodeAsync(dto.RoomCode);
            if (room == null)
                throw new InvalidOperationException("Không tìm thấy phòng theo roomCode.");

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

                var meter = await _meterRepo.GetByRoomAndMonthAsync(contract.RoomId, billingMonth);

                var electricity = meter?.Amount ?? 0;
                var roomFee = contract.ActualRoomPrice;
                var water = contract.OccupantCount * WATER_PER_PERSON;
                var trash = TRASH_FEE;
                var discount = dto.DefaultDiscountAmount;
                var debt = dto.DefaultDebtAmount;
                var total = roomFee + electricity + water + trash + debt - discount;

                if (total < 0) total = 0;

                result.Add(new InvoiceBulkPreviewItemDto
                {
                    RoomId = contract.RoomId,
                    ContractId = contract.ContractId,
                    RoomCode = contract.Room?.RoomCode ?? string.Empty,
                    TenantName = contract.Tenant?.FullName ?? string.Empty,
                    RoomFee = roomFee,
                    ElectricityFee = electricity,
                    WaterFee = water,
                    TrashFee = trash,
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
            var created = new List<InvoiceDto>();

            foreach (var item in previews)
            {
                var invoice = new Invoice
                {
                    RoomId = item.RoomId,
                    ContractId = item.ContractId,
                    InvoiceType = "monthly",
                    BillingMonth = billingMonth,
                    FromDate = billingMonth,
                    ToDate = billingMonth.AddMonths(1).AddDays(-1),
                    RoomFee = item.RoomFee,
                    ElectricityFee = item.ElectricityFee,
                    WaterFee = item.WaterFee,
                    TrashFee = item.TrashFee,
                    DiscountAmount = item.DiscountAmount,
                    DebtAmount = item.DebtAmount,
                    TotalAmount = item.TotalAmount,
                    Status = "unpaid",
                    PaymentCode = GeneratePaymentCode(item.RoomId, billingMonth),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _invoiceRepo.AddAsync(invoice);
                created.Add(MapToDto(invoice));
            }

            await _invoiceRepo.SaveChangesAsync();
            return created;
        }

        public async Task<InvoiceDto?> ReplaceAsync(int invoiceId, InvoiceReplaceDto dto)
        {
            var oldInvoice = await _invoiceRepo.GetByIdAsync(invoiceId);
            if (oldInvoice == null)
                return null;

            if (oldInvoice.ReplacedByInvoiceId != null)
                throw new InvalidOperationException("Hóa đơn này đã được thay thế.");

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
                DiscountAmount = dto.DiscountAmount,
                DebtAmount = dto.DebtAmount,
                TotalAmount = total,
                Status = "unpaid",
                PaymentCode = GeneratePaymentCode(oldInvoice.RoomId, billingMonth),
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
                throw new InvalidOperationException("Không thể xóa hóa đơn đã thanh toán.");

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
            decimal debtAmount,
            decimal discountAmount)
        {
            var total = roomFee + electricityFee + waterFee + trashFee + debtAmount - discountAmount;
            return total < 0 ? 0 : total;
        }

        private static string GeneratePaymentCode(int roomId, DateOnly billingMonth)
        {
            return $"INV-R{roomId}-{billingMonth:yyyyMM}";
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
                DiscountAmount = i.DiscountAmount,
                DebtAmount = i.DebtAmount,
                TotalAmount = i.TotalAmount,
                Status = i.Status,
                PaymentCode = i.PaymentCode,
                PaidAt = i.PaidAt,
                PaidAmount = i.PaidAmount,
                PaymentMethod = i.PaymentMethod,
                PaymentReference = i.PaymentReference,
                Note = i.Note,
                CreatedAt = i.CreatedAt
            };
        }
    }
}
