using NhaTro.Dtos.Payments;

namespace NhaTro.Interfaces.Services
{
    public interface IPaymentService
    {
        Task<List<PaymentTransactionDto>> GetAllAsync(string? processStatus = null);
        Task<PaymentTransactionDto?> GetByIdAsync(int paymentTransactionId);
        Task<PaymentTransactionDto> HandleSepayWebhookAsync(SepayWebhookDto dto);
        Task<PaymentTransactionDto?> ReconcileAsync(int paymentTransactionId, ReconcilePaymentDto dto);
    }
}