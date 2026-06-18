using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using NhaTro.Dtos.Assistant;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class AssistantService : IAssistantService
    {
        private readonly IRoomService _roomService;
        private readonly IContractService _contractService;
        private readonly IMeterReadingService _meterReadingService;
        private readonly IInvoiceService _invoiceService;
        private readonly ICurrentUserService _currentUserService;
        private readonly AssistantCommandStore _commandStore;

        public AssistantService(
            IRoomService roomService,
            IContractService contractService,
            IMeterReadingService meterReadingService,
            IInvoiceService invoiceService,
            ICurrentUserService currentUserService,
            AssistantCommandStore commandStore)
        {
            _roomService = roomService;
            _contractService = contractService;
            _meterReadingService = meterReadingService;
            _invoiceService = invoiceService;
            _currentUserService = currentUserService;
            _commandStore = commandStore;
        }

        public async Task<AssistantResponseDto> HandleMessageAsync(string message)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return HelpResponse("Bạn nhập yêu cầu cần xử lý nhé.");
            }

            var normalized = Normalize(message);

            if (LooksLikeVacantRoomQuery(normalized))
            {
                return await HandleVacantRoomsAsync();
            }

            if (LooksLikeUnpaidInvoiceQuery(normalized))
            {
                return await HandleUnpaidInvoicesAsync(normalized);
            }

            if (LooksLikeMeterReadingCommand(normalized))
            {
                return await HandleMeterReadingPreviewAsync(message, normalized);
            }

            return HelpResponse("Mình chưa hiểu yêu cầu này. Hiện mình hỗ trợ nhập số điện, hỏi phòng trống và hỏi hóa đơn chưa thanh toán.");
        }

        public async Task<AssistantResponseDto> ExecuteAsync(string commandId)
        {
            if (string.IsNullOrWhiteSpace(commandId))
            {
                return HelpResponse("Không tìm thấy lệnh cần xác nhận.");
            }

            var userId = _currentUserService.UserId;
            if (!_commandStore.TryTake(commandId, userId, out var command) || command == null)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "command.execute",
                    Message = "Lệnh không còn hiệu lực hoặc không thuộc tài khoản hiện tại."
                };
            }

            if (command.Intent == "meter_reading.create" && command.MeterReadingPayload != null)
            {
                var result = await _meterReadingService.CreateAsync(command.MeterReadingPayload);
                return new AssistantResponseDto
                {
                    Type = "success",
                    Intent = command.Intent,
                    Message = $"Đã nhập chỉ số điện phòng {result.RoomCode} tháng {result.BillingMonth:MM/yyyy}.",
                    Result = result
                };
            }

            return new AssistantResponseDto
            {
                Type = "error",
                Intent = "command.execute",
                Message = "Loại lệnh này chưa được hỗ trợ."
            };
        }

        private async Task<AssistantResponseDto> HandleMeterReadingPreviewAsync(string rawMessage, string normalized)
        {
            var roomCode = ExtractRoomCode(rawMessage, normalized);
            if (string.IsNullOrWhiteSpace(roomCode))
            {
                return NeedMoreInfo("Bạn muốn nhập số điện cho phòng nào?");
            }

            var billingMonth = ExtractMonth(normalized);
            if (!billingMonth.HasValue)
            {
                return NeedMoreInfo("Bạn muốn nhập số điện cho tháng nào?");
            }

            var currentReading = ExtractCurrentReading(normalized);
            if (!currentReading.HasValue)
            {
                return NeedMoreInfo("Chỉ số điện mới là bao nhiêu?");
            }

            var room = await _roomService.GetByRoomCodeAsync(roomCode);
            if (room == null)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "meter_reading.create",
                    Message = $"Không tìm thấy phòng {roomCode} trong tài khoản hiện tại."
                };
            }

            var activeContract = await _contractService.GetActiveByRoomCodeAsync(roomCode);
            if (activeContract == null)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "meter_reading.create",
                    Message = $"Phòng {roomCode} chưa có hợp đồng đang hiệu lực."
                };
            }

            var payload = new CreateMeterReadingDto
            {
                RoomId = room.RoomId,
                ContractId = activeContract.ContractId,
                BillingMonth = billingMonth.Value,
                CurrentReading = currentReading.Value
            };

            var preview = await _meterReadingService.PreviewAsync(payload);
            var commandId = _commandStore.AddMeterReadingCommand(_currentUserService.UserId, payload);

            return new AssistantResponseDto
            {
                Type = "confirmation_required",
                Intent = "meter_reading.create",
                CommandId = commandId,
                Preview = preview,
                Message = $"Mình sẽ nhập số điện phòng {preview.RoomCode} tháng {preview.BillingMonth:MM/yyyy}: chỉ số cũ {preview.PreviousReading}, chỉ số mới {preview.CurrentReading}, tiêu thụ {preview.ConsumedUnits} kWh, thành tiền {FormatMoney(preview.Amount)}. Bạn xác nhận để thực hiện."
            };
        }

        private async Task<AssistantResponseDto> HandleVacantRoomsAsync()
        {
            var rooms = await _roomService.GetAllAsync("vacant");
            var message = rooms.Count == 0
                ? "Hiện không có phòng trống."
                : $"Có {rooms.Count} phòng trống: {string.Join(", ", rooms.Select(x => x.RoomCode))}.";

            return new AssistantResponseDto
            {
                Type = "message",
                Intent = "rooms.find_vacant",
                Message = message,
                Result = rooms
            };
        }

        private async Task<AssistantResponseDto> HandleUnpaidInvoicesAsync(string normalized)
        {
            var month = ExtractMonth(normalized);
            var invoices = await _invoiceService.GetUnpaidAsync(month);
            var monthText = month.HasValue ? $" tháng {month.Value:MM/yyyy}" : string.Empty;
            var message = invoices.Count == 0
                ? $"Không có hóa đơn chưa thanh toán{monthText}."
                : $"Có {invoices.Count} hóa đơn chưa thanh toán{monthText}: {string.Join(", ", invoices.Select(x => $"{x.RoomCode} - {FormatMoney(x.TotalAmount)}"))}.";

            return new AssistantResponseDto
            {
                Type = "message",
                Intent = "invoices.find_unpaid",
                Message = message,
                Result = invoices
            };
        }

        private static bool LooksLikeMeterReadingCommand(string normalized)
        {
            return normalized.Contains("dien")
                && (normalized.Contains("nhap") || normalized.Contains("ghi") || normalized.Contains("chi so") || normalized.Contains("cong to"));
        }

        private static bool LooksLikeVacantRoomQuery(string normalized)
        {
            return normalized.Contains("phong")
                && (normalized.Contains("trong") || normalized.Contains("chua cho thue") || normalized.Contains("con phong"));
        }

        private static bool LooksLikeUnpaidInvoiceQuery(string normalized)
        {
            return normalized.Contains("hoa don")
                && (normalized.Contains("chua thanh toan") || normalized.Contains("chua dong") || normalized.Contains("chua tra") || normalized.Contains("con no"));
        }

        private static string? ExtractRoomCode(string rawMessage, string normalized)
        {
            var normalizedRoom = Regex.Match(normalized, @"phong\s+([a-z0-9][a-z0-9\-]*)");
            if (normalizedRoom.Success)
            {
                return normalizedRoom.Groups[1].Value.ToUpperInvariant();
            }

            var rawRoom = Regex.Match(rawMessage, @"\b([A-Za-z]{1,4}\d{1,4}[A-Za-z0-9\-]*)\b");
            return rawRoom.Success ? rawRoom.Groups[1].Value.ToUpperInvariant() : null;
        }

        private static DateOnly? ExtractMonth(string normalized)
        {
            var monthMatch = Regex.Match(normalized, @"thang\s+(\d{1,2})(?:\s*(?:nam|/|-)\s*(\d{4}))?");
            if (!monthMatch.Success)
            {
                monthMatch = Regex.Match(normalized, @"\b(\d{1,2})/(\d{4})\b");
            }

            if (!monthMatch.Success || !int.TryParse(monthMatch.Groups[1].Value, out var month) || month < 1 || month > 12)
            {
                return null;
            }

            var yearText = monthMatch.Groups.Count > 2 ? monthMatch.Groups[2].Value : string.Empty;
            var year = int.TryParse(yearText, out var parsedYear) ? parsedYear : DateTime.Now.Year;
            return new DateOnly(year, month, 1);
        }

        private static int? ExtractCurrentReading(string normalized)
        {
            var explicitMatch = Regex.Match(normalized, @"(?:la|=|:)\s*(\d+)");
            if (explicitMatch.Success && int.TryParse(explicitMatch.Groups[1].Value, out var explicitValue))
            {
                return explicitValue;
            }

            var numbers = Regex.Matches(normalized, @"\b\d+\b")
                .Select(x => int.Parse(x.Value))
                .Where(x => x > 31)
                .ToList();

            return numbers.Count == 0 ? null : numbers[^1];
        }

        private static AssistantResponseDto NeedMoreInfo(string message)
        {
            return new AssistantResponseDto
            {
                Type = "need_more_info",
                Intent = "assistant.clarify",
                Message = message
            };
        }

        private static AssistantResponseDto HelpResponse(string message)
        {
            return new AssistantResponseDto
            {
                Type = "message",
                Intent = "assistant.help",
                Message = message,
                Suggestions =
                {
                    "Nhập số điện tháng 10 phòng A1 là 1000",
                    "Phòng nào còn trống?",
                    "Hóa đơn nào chưa thanh toán tháng 10?"
                }
            };
        }

        private static string Normalize(string value)
        {
            var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(normalized.Length);

            foreach (var c in normalized)
            {
                var category = CharUnicodeInfo.GetUnicodeCategory(c);
                if (category != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(c);
                }
            }

            return builder.ToString().Normalize(NormalizationForm.FormC).Replace('đ', 'd');
        }

        private static string FormatMoney(decimal amount)
        {
            return amount.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";
        }
    }
}
