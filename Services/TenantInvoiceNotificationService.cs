using Microsoft.EntityFrameworkCore;
using NhaTro.Data;
using NhaTro.Dtos.Invoices;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class TenantInvoiceNotificationService : ITenantInvoiceNotificationService
    {
        private readonly NhaTroDbContext _context;
        private readonly IRealtimeService _realtimeService;
        private readonly ITenantDeviceTokenService _deviceTokenService;
        private readonly IExpoPushNotificationService _expoPushNotificationService;

        public TenantInvoiceNotificationService(
            NhaTroDbContext context,
            IRealtimeService realtimeService,
            ITenantDeviceTokenService deviceTokenService,
            IExpoPushNotificationService expoPushNotificationService)
        {
            _context = context;
            _realtimeService = realtimeService;
            _deviceTokenService = deviceTokenService;
            _expoPushNotificationService = expoPushNotificationService;
        }

        public async Task NotifyInvoiceCreatedAsync(InvoiceDto invoice, CancellationToken cancellationToken = default)
        {
            var dbInvoice = await _context.Invoices
                .AsNoTracking()
                .Include(x => x.Contract)
                .Include(x => x.Room)
                .FirstOrDefaultAsync(x => x.InvoiceId == invoice.InvoiceId, cancellationToken);

            if (dbInvoice?.Contract == null)
            {
                return;
            }

            var tenantId = dbInvoice.Contract.TenantId;
            var organizationId = dbInvoice.OrganizationId;
            var billingMonth = dbInvoice.BillingMonth?.ToString("MM/yyyy") ?? string.Empty;
            var message = $"Đã có hóa đơn tháng {billingMonth} cần thanh toán với số tiền {dbInvoice.TotalAmount:N0} đồng";
            var data = new
            {
                type = "invoice.created",
                invoiceId = dbInvoice.InvoiceId,
                billingMonth = dbInvoice.BillingMonth,
                roomCode = dbInvoice.Room?.RoomCode,
                totalAmount = dbInvoice.TotalAmount,
                message
            };

            await _realtimeService.PublishToTenantAsync(tenantId, "tenant.invoice.created", data, "tenant-invoices");

            var devices = await _deviceTokenService.GetActiveTenantDevicesAsync(tenantId, organizationId);
            await _expoPushNotificationService.SendAsync(
                devices,
                "Hóa đơn mới",
                message,
                new
                {
                    type = "invoice.created",
                    invoiceId = dbInvoice.InvoiceId,
                    billingMonth = dbInvoice.BillingMonth
                },
                cancellationToken);
        }
    }
}
