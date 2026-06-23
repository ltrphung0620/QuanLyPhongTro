using NhaTro.Dtos.Invoices;

namespace NhaTro.Interfaces.Services
{
    public interface ITenantInvoiceNotificationService
    {
        Task NotifyInvoiceCreatedAsync(InvoiceDto invoice, CancellationToken cancellationToken = default);
    }
}
