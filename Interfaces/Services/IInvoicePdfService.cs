using NhaTro.Dtos.Invoices;

namespace NhaTro.Interfaces.Services
{
    public interface IInvoicePdfService
    {
        Task<byte[]> GenerateInvoicePdfAsync(InvoiceDto invoice);
        string BuildInvoicePdfFileName(InvoiceDto invoice);
    }
}
