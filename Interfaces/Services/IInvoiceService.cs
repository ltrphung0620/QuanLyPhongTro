using NhaTro.Dtos.Invoices;

namespace NhaTro.Interfaces.Services
{
    public interface IInvoiceService
    {
        Task<List<InvoiceDto>> GetAllAsync(int? roomId = null, DateOnly? month = null, string? status = null);
        Task<InvoiceDto?> GetByIdAsync(int invoiceId);
        Task<InvoicePreviewDto> PreviewAsync(CreateInvoiceDto dto);
        Task<InvoiceDto> CreateAsync(CreateInvoiceDto dto);
        Task<InvoiceDto?> GetByRoomAndMonthAsync(int roomId, DateOnly month);
        Task<List<InvoiceDto>> GetUnpaidAsync(DateOnly? month = null);
        Task<InvoiceDto?> GetByPaymentCodeAsync(string paymentCode);
        Task<InvoiceDto?> MarkPaidAsync(int invoiceId, MarkInvoicePaidDto dto);
        Task<InvoiceDto?> MarkUnpaidAsync(int invoiceId);
        Task<InvoiceDto?> UpdateElectricityAsync(UpdateInvoiceElectricityDto dto);
        Task<List<InvoiceBulkPreviewItemDto>> MonthlyBulkPreviewAsync(InvoiceBulkCreateDto dto);
        Task<List<InvoiceDto>> MonthlyBulkCreateAsync(InvoiceBulkCreateDto dto);
        Task<InvoiceDto?> ReplaceAsync(int invoiceId, InvoiceReplaceDto dto);
        Task<InvoiceDto?> UpdateAsync(int invoiceId, UpdateInvoiceDto dto);
        Task<bool> DeleteAsync(int invoiceId);
    }
}
