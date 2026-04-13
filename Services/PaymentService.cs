using System.Text.Json;
using System.Text.RegularExpressions;
using NhaTro.Dtos.Invoices;
using NhaTro.Dtos.Payments;
using NhaTro.Interfaces.Repositories;
using NhaTro.Interfaces.Services;
using NhaTro.Models;

namespace NhaTro.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly IPaymentTransactionRepository _paymentRepo;
        private readonly IInvoiceRepository _invoiceRepo;
        private readonly IInvoiceService _invoiceService;

        public PaymentService(
            IPaymentTransactionRepository paymentRepo,
            IInvoiceRepository invoiceRepo,
            IInvoiceService invoiceService)
        {
            _paymentRepo = paymentRepo;
            _invoiceRepo = invoiceRepo;
            _invoiceService = invoiceService;
        }

        public async Task<List<PaymentTransactionDto>> GetAllAsync(string? processStatus = null)
        {
            var data = await _paymentRepo.GetAllAsync(processStatus);
            return data.Select(MapToDto).ToList();
        }

        public async Task<PaymentTransactionDto?> GetByIdAsync(int paymentTransactionId)
        {
            var payment = await _paymentRepo.GetByIdAsync(paymentTransactionId);
            return payment == null ? null : MapToDto(payment);
        }

        public async Task<PaymentTransactionDto> HandleSepayWebhookAsync(SepayWebhookDto dto)
        {
            var providerTransactionId = dto.Id?.ToString();
            if (string.IsNullOrWhiteSpace(providerTransactionId))
                throw new InvalidOperationException("Webhook không có transaction id.");

            var existed = await _paymentRepo.GetByProviderTransactionIdAsync(providerTransactionId);
            if (existed != null)
            {
                return await TryFinalizeExistingPaymentAsync(existed);
            }

            DateTime? transactionDate = null;
            if (DateTime.TryParse(dto.TransactionDate, out var parsedDate))
            {
                transactionDate = parsedDate;
            }

            var resolvedPaymentCode = await ResolvePaymentCodeAsync(dto);

            var payment = new PaymentTransaction
            {
                Provider = "sepay",
                ProviderTransactionId = providerTransactionId,
                ReferenceCode = string.IsNullOrWhiteSpace(dto.ReferenceCode) ? null : dto.ReferenceCode.Trim(),
                PaymentCode = resolvedPaymentCode,
                AccountNumber = string.IsNullOrWhiteSpace(dto.AccountNumber) ? null : dto.AccountNumber.Trim(),
                TransferType = string.IsNullOrWhiteSpace(dto.TransferType) ? null : dto.TransferType.Trim().ToLower(),
                TransferAmount = dto.TransferAmount,
                TransactionDate = transactionDate,
                Content = dto.Content,
                RawPayloadJson = JsonSerializer.Serialize(dto),
                ProcessStatus = "received",
                CreatedAt = DateTime.UtcNow
            };

            await _paymentRepo.AddAsync(payment);
            await _paymentRepo.SaveChangesAsync();

            if (payment.TransferType != "in")
            {
                payment.ProcessStatus = "ignored";
                payment.ProcessedAt = DateTime.UtcNow;
                _paymentRepo.Update(payment);
                await _paymentRepo.SaveChangesAsync();

                return MapToDto(payment);
            }

            if (string.IsNullOrWhiteSpace(payment.PaymentCode))
            {
                payment.ProcessStatus = "ignored";
                payment.ProcessedAt = DateTime.UtcNow;
                _paymentRepo.Update(payment);
                await _paymentRepo.SaveChangesAsync();

                return MapToDto(payment);
            }

            var invoice = await _invoiceRepo.GetByPaymentCodeAsync(payment.PaymentCode);
            if (invoice == null)
            {
                payment.ProcessStatus = "failed";
                payment.ProcessedAt = DateTime.UtcNow;
                _paymentRepo.Update(payment);
                await _paymentRepo.SaveChangesAsync();

                return MapToDto(payment);
            }

            payment.MatchedInvoiceId = invoice.InvoiceId;
            payment.ProcessStatus = "matched";
            _paymentRepo.Update(payment);
            await _paymentRepo.SaveChangesAsync();

            if (invoice.Status == "paid")
            {
                payment.ProcessStatus = "paid";
                payment.ProcessedAt = DateTime.UtcNow;
                _paymentRepo.Update(payment);
                await _paymentRepo.SaveChangesAsync();

                return MapToDto(payment);
            }

            if (!payment.TransferAmount.HasValue || payment.TransferAmount.Value < RoundCurrencyAmount(invoice.TotalAmount))
            {
                payment.ProcessStatus = "failed";
                payment.ProcessedAt = DateTime.UtcNow;
                _paymentRepo.Update(payment);
                await _paymentRepo.SaveChangesAsync();

                return MapToDto(payment);
            }

            await _invoiceService.MarkPaidAsync(invoice.InvoiceId, new MarkInvoicePaidDto
            {
                Amount = payment.TransferAmount.Value,
                PaymentMethod = "Chuyển khoản",
                PaymentReference = payment.ReferenceCode ?? payment.ProviderTransactionId
            });

            payment.ProcessStatus = "paid";
            payment.ProcessedAt = DateTime.UtcNow;
            _paymentRepo.Update(payment);
            await _paymentRepo.SaveChangesAsync();

            return MapToDto(payment);
        }

        public async Task<PaymentTransactionDto?> ReconcileAsync(int paymentTransactionId, ReconcilePaymentDto dto)
        {
            var payment = await _paymentRepo.GetByIdAsync(paymentTransactionId);
            if (payment == null)
                return null;

            var invoice = await _invoiceRepo.GetByIdAsync(dto.InvoiceId);
            if (invoice == null)
                throw new InvalidOperationException("Không tìm thấy hóa đơn.");

            payment.MatchedInvoiceId = invoice.InvoiceId;

            if (invoice.Status != "paid" && payment.TransferAmount.HasValue && payment.TransferAmount.Value >= RoundCurrencyAmount(invoice.TotalAmount))
            {
                await _invoiceService.MarkPaidAsync(invoice.InvoiceId, new MarkInvoicePaidDto
                {
                    Amount = payment.TransferAmount.Value,
                    PaymentMethod = "Chuyển khoản",
                    PaymentReference = payment.ReferenceCode ?? payment.ProviderTransactionId
                });

                payment.ProcessStatus = "paid";
            }
            else
            {
                payment.ProcessStatus = "matched";
            }

            payment.ProcessedAt = DateTime.UtcNow;
            _paymentRepo.Update(payment);
            await _paymentRepo.SaveChangesAsync();

            return MapToDto(payment);
        }

        public async Task<bool> DeleteAsync(int paymentTransactionId)
        {
            var payment = await _paymentRepo.GetByIdAsync(paymentTransactionId);
            if (payment == null)
                return false;

            var processStatus = string.IsNullOrWhiteSpace(payment.ProcessStatus)
                ? string.Empty
                : payment.ProcessStatus.Trim().ToLowerInvariant();

            if (processStatus == "paid")
            {
                throw new InvalidOperationException("Khong the xoa giao dich da danh dau thanh toan.");
            }

            _paymentRepo.Delete(payment);
            await _paymentRepo.SaveChangesAsync();
            return true;
        }

        private async Task<PaymentTransactionDto> TryFinalizeExistingPaymentAsync(PaymentTransaction payment)
        {
            if (payment.ProcessStatus == "paid")
            {
                return MapToDto(payment);
            }

            if (payment.TransferType != "in" || string.IsNullOrWhiteSpace(payment.PaymentCode))
            {
                return MapToDto(payment);
            }

            var invoice = await _invoiceRepo.GetByPaymentCodeAsync(payment.PaymentCode);
            if (invoice == null)
            {
                return MapToDto(payment);
            }

            if (invoice.Status == "paid")
            {
                payment.ProcessStatus = "paid";
                payment.MatchedInvoiceId = invoice.InvoiceId;
                payment.ProcessedAt = DateTime.UtcNow;
                _paymentRepo.Update(payment);
                await _paymentRepo.SaveChangesAsync();
                return MapToDto(payment);
            }

            if (!payment.TransferAmount.HasValue || payment.TransferAmount.Value < RoundCurrencyAmount(invoice.TotalAmount))
            {
                return MapToDto(payment);
            }

            await _invoiceService.MarkPaidAsync(invoice.InvoiceId, new MarkInvoicePaidDto
            {
                Amount = payment.TransferAmount.Value,
                PaymentMethod = "Chuyển khoản",
                PaymentReference = payment.ReferenceCode ?? payment.ProviderTransactionId
            });

            payment.ProcessStatus = "paid";
            payment.MatchedInvoiceId = invoice.InvoiceId;
            payment.ProcessedAt = DateTime.UtcNow;
            _paymentRepo.Update(payment);
            await _paymentRepo.SaveChangesAsync();

            return MapToDto(payment);
        }

        private static decimal RoundCurrencyAmount(decimal amount)
        {
            return decimal.Round(amount, 0, MidpointRounding.AwayFromZero);
        }

        private async Task<string?> ResolvePaymentCodeAsync(SepayWebhookDto dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.Code))
                return dto.Code.Trim();

            var candidates = new[]
            {
                dto.Content,
                dto.Description,
                dto.ReferenceCode,
            }
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .ToList();

            if (candidates.Count == 0)
                return null;

            var unpaidInvoices = await _invoiceService.GetUnpaidAsync();
            var paymentCodes = unpaidInvoices
                .Select(invoice => invoice.PaymentCode?.Trim())
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(code => code!.Length)
                .ToList();

            foreach (var rawCandidate in candidates)
            {
                var normalizedCandidate = NormalizeText(rawCandidate);
                foreach (var paymentCode in paymentCodes)
                {
                    if (paymentCode == null) continue;

                    var normalizedCode = NormalizeText(paymentCode);
                    if (normalizedCandidate.Contains(normalizedCode, StringComparison.OrdinalIgnoreCase))
                        return paymentCode;
                }
            }

            return null;
        }

        private static string NormalizeText(string value)
        {
            var upper = value.Trim().ToUpperInvariant();
            return Regex.Replace(upper, "[^A-Z0-9]", string.Empty);
        }

        private static PaymentTransactionDto MapToDto(PaymentTransaction p)
        {
            return new PaymentTransactionDto
            {
                PaymentTransactionId = p.PaymentTransactionId,
                Provider = p.Provider,
                ProviderTransactionId = p.ProviderTransactionId,
                ReferenceCode = p.ReferenceCode,
                PaymentCode = p.PaymentCode,
                AccountNumber = p.AccountNumber,
                TransferType = p.TransferType,
                TransferAmount = p.TransferAmount,
                TransactionDate = p.TransactionDate,
                Content = p.Content,
                MatchedInvoiceId = p.MatchedInvoiceId,
                ProcessStatus = p.ProcessStatus,
                ProcessedAt = p.ProcessedAt,
                CreatedAt = p.CreatedAt
            };
        }
    }
}
