using NhaTro.Dtos.Invoices;

namespace NhaTro.Interfaces.Services
{
    public interface IInvoicePdfService
    {
        Task<byte[]> GenerateInvoicePdfAsync(InvoiceDto invoice);
        Task<IReadOnlyList<byte[]>> GenerateInvoiceImagesAsync(InvoiceDto invoice);
        string BuildInvoicePdfFileName(InvoiceDto invoice);
        string BuildInvoiceImageFileName(InvoiceDto invoice, int? pageNumber = null);
    }
}
