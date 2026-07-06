using System.Globalization;
using NhaTro.Dtos.Invoices;
using NhaTro.Models;

namespace NhaTro.Utils
{
    public static class InvoicePaymentContent
    {
        public static string Build(InvoiceDto invoice)
        {
            return Build(
                invoice.TenantName,
                invoice.RoomCode,
                invoice.RoomId,
                invoice.BillingMonth);
        }

        public static string Build(Invoice invoice)
        {
            return Build(
                invoice.Contract?.Tenant?.FullName,
                invoice.Room?.RoomCode,
                invoice.RoomId,
                invoice.BillingMonth);
        }

        private static string Build(string? tenantName, string? roomCode, int roomId, DateOnly? billingMonth)
        {
            var tenant = string.IsNullOrWhiteSpace(tenantName)
                ? "Nguoi thue"
                : tenantName.Trim();
            var room = string.IsNullOrWhiteSpace(roomCode)
                ? $"Phong {roomId}"
                : roomCode.Trim();
            var month = billingMonth.HasValue
                ? billingMonth.Value.ToString("MM/yyyy", CultureInfo.InvariantCulture)
                : DateTime.Now.ToString("MM/yyyy", CultureInfo.InvariantCulture);

            return $"{tenant} dai dien phong {room} chuyen tien thang {month} theo hoa don";
        }
    }
}
