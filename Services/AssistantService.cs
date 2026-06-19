using System.Globalization;
using System.Text;
using NhaTro.Dtos.Assistant;
using NhaTro.Dtos.Contracts;
using NhaTro.Dtos.Invoices;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Dtos.Rooms;
using NhaTro.Dtos.Tenants;
using NhaTro.Dtos.Transactions;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class AssistantService : IAssistantService
    {
        private const string IntentHelp = "assistant.help";

        private readonly IRoomService _roomService;
        private readonly ITenantService _tenantService;
        private readonly IContractService _contractService;
        private readonly IMeterReadingService _meterReadingService;
        private readonly IInvoiceService _invoiceService;
        private readonly ITransactionService _transactionService;
        private readonly IReportService _reportService;
        private readonly ICurrentUserService _currentUserService;
        private readonly AssistantCommandStore _commandStore;
        private readonly AssistantConversationStore _conversationStore;
        private readonly IAssistantCommandParser _commandParser;
        private readonly AssistantActionRegistry _actionRegistry;
        private readonly AssistantLearningStore _learningStore;

        public AssistantService(
            IRoomService roomService,
            ITenantService tenantService,
            IContractService contractService,
            IMeterReadingService meterReadingService,
            IInvoiceService invoiceService,
            ITransactionService transactionService,
            IReportService reportService,
            ICurrentUserService currentUserService,
            AssistantCommandStore commandStore,
            AssistantConversationStore conversationStore,
            IAssistantCommandParser commandParser,
            AssistantActionRegistry actionRegistry,
            AssistantLearningStore learningStore)
        {
            _roomService = roomService;
            _tenantService = tenantService;
            _contractService = contractService;
            _meterReadingService = meterReadingService;
            _invoiceService = invoiceService;
            _transactionService = transactionService;
            _reportService = reportService;
            _currentUserService = currentUserService;
            _commandStore = commandStore;
            _conversationStore = conversationStore;
            _commandParser = commandParser;
            _actionRegistry = actionRegistry;
            _learningStore = learningStore;
        }

        public async Task<AssistantResponseDto> HandleMessageAsync(string message)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return HelpResponse("Bạn nhập yêu cầu cần xử lý nhé.");
            }

            var userId = _currentUserService.UserId;
            if (IsCancelMessage(message))
            {
                _conversationStore.Clear(userId);
                return new AssistantResponseDto
                {
                    Type = "message",
                    Intent = "assistant.cancel",
                    Message = "Mình đã hủy lệnh đang nhập dở."
                };
            }

            _conversationStore.TryGet(userId, out var pendingConversation);
            if (pendingConversation != null && IsRejectMessage(message))
            {
                _learningStore.RecordMistake(userId, message, pendingConversation.Command);
                _conversationStore.Set(userId, pendingConversation.Command, isCorrectionMode: true);
                return new AssistantResponseDto
                {
                    Type = "need_more_info",
                    Intent = "assistant.correct",
                    Message = "Mình ghi nhận lệnh vừa rồi chưa đúng. Bạn muốn sửa lại như thế nào?",
                    PendingCommand = pendingConversation.Command
                };
            }

            var parseResult = await _commandParser.ParseAsync(message, pendingConversation?.Command);
            var command = pendingConversation == null
                ? parseResult.Command
                : MergeCommands(pendingConversation.Command, parseResult.Command);
            var response = await DispatchAsync(command);
            var learnedValueAlias = false;
            string? learnedValue = null;
            if (pendingConversation?.IsValueLearningMode == true
                && !string.IsNullOrWhiteSpace(pendingConversation.LearningField)
                && command.Params.TryGetValue(pendingConversation.LearningField, out var parsedLearnedValue)
                && !string.IsNullOrWhiteSpace(parsedLearnedValue))
            {
                learnedValue = parsedLearnedValue;
                learnedValueAlias = true;
            }

            if (learnedValueAlias)
            {
                var learningConversation = pendingConversation!;
                _learningStore.RecordValueAlias(
                    userId,
                    learningConversation.Command.Intent,
                    learningConversation.LearningField!,
                    learningConversation.LearningRawValue ?? message,
                    learnedValue!);
            }

            if (response.Type == "need_more_info")
            {
                if (pendingConversation?.IsValueLearningMode == true && !learnedValueAlias)
                {
                    _conversationStore.Set(
                        userId,
                        pendingConversation.Command,
                        isValueLearningMode: true,
                        learningField: pendingConversation.LearningField,
                        learningRawValue: pendingConversation.LearningRawValue);

                    response.PendingCommand = pendingConversation.Command;
                    return response;
                }

                if (pendingConversation != null
                    && !pendingConversation.IsValueLearningMode
                    && IsNoProgress(pendingConversation.Command, command))
                {
                    var field = command.MissingFields.FirstOrDefault();
                    if (!string.IsNullOrWhiteSpace(field))
                    {
                        _conversationStore.Set(
                            userId,
                            pendingConversation.Command,
                            isValueLearningMode: true,
                            learningField: field,
                            learningRawValue: message);

                        return new AssistantResponseDto
                        {
                            Type = "need_more_info",
                            Intent = "assistant.learn_value",
                            Message = $"Mình chưa hiểu \"{message}\" là {BuildFieldLabel(field)}. Bạn nhập giúp mình giá trị chuẩn nhé.",
                            PendingCommand = pendingConversation.Command
                        };
                    }
                }

                _conversationStore.Set(userId, command);
                response.PendingCommand = command;
            }
            else if (response.Type == "confirmation_required")
            {
                if (pendingConversation?.IsCorrectionMode == true)
                {
                    _learningStore.RecordCorrection(userId, message, command);
                }

                _conversationStore.Set(userId, command);
            }
            else if (response.Type != "error")
            {
                if (pendingConversation?.IsCorrectionMode == true)
                {
                    _learningStore.RecordCorrection(userId, message, command);
                }

                _conversationStore.Clear(userId);
            }

            response.Parser = parseResult.Parser;
            return response;
        }

        public async Task<AssistantResponseDto> ExecuteAsync(string commandId)
        {
            if (string.IsNullOrWhiteSpace(commandId))
            {
                return HelpResponse("Không tìm thấy lệnh cần xác nhận.");
            }

            var userId = _currentUserService.UserId;
            if (!_commandStore.TryTake(commandId, userId, out var pending) || pending == null)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "command.execute",
                    Message = "Lệnh không còn hiệu lực hoặc không thuộc tài khoản hiện tại."
                };
            }

            try
            {
                _conversationStore.Clear(userId);
                return pending.Command.Intent switch
                {
                    AssistantActionRegistry.MeterReadingCreate => await ExecuteMeterReadingCreateAsync(pending.Command),
                    AssistantActionRegistry.RoomsCreate => await ExecuteRoomCreateAsync(pending.Command),
                    AssistantActionRegistry.TenantsCreate => await ExecuteTenantCreateAsync(pending.Command),
                    AssistantActionRegistry.ContractsCreate => await ExecuteContractCreateAsync(pending.Command),
                    AssistantActionRegistry.ContractsEnd => await ExecuteContractEndAsync(pending.Command),
                    AssistantActionRegistry.InvoicesCreateMonthlyBulk => await ExecuteInvoiceMonthlyBulkCreateAsync(pending.Command),
                    AssistantActionRegistry.InvoicesMarkPaid => await ExecuteInvoiceMarkPaidAsync(pending.Command),
                    AssistantActionRegistry.TransactionsCreate => await ExecuteTransactionCreateAsync(pending.Command),
                    _ => ErrorResponse(pending.Command, "Loại lệnh này chưa được hỗ trợ để thực thi.")
                };
            }
            catch (Exception ex)
            {
                return ErrorResponse(pending.Command, ex.Message);
            }
        }

        private async Task<AssistantResponseDto> DispatchAsync(AssistantCommandDto command)
        {
            if (!_actionRegistry.TryGet(command.Intent, out var action) || command.Intent == AssistantActionRegistry.AssistantUnknown)
            {
                return HelpResponse("Mình chưa hiểu yêu cầu này. Bạn có thể yêu cầu về phòng, khách thuê, hợp đồng, số điện, hóa đơn, thu chi hoặc báo cáo.", command);
            }

            if (command.MissingFields.Count > 0)
            {
                return NeedMoreInfo(command, BuildMissingFieldMessage(command.MissingFields));
            }

            try
            {
                return command.Intent switch
                {
                    AssistantActionRegistry.MeterReadingCreate => await PreviewMeterReadingCreateAsync(command),
                    AssistantActionRegistry.MeterReadingsFindMissing => await HandleMissingMeterReadingsAsync(command),
                    AssistantActionRegistry.RoomsFindAll => await HandleRoomsAsync(command, null),
                    AssistantActionRegistry.RoomsFindVacant => await HandleRoomsAsync(command, "vacant"),
                    AssistantActionRegistry.RoomsFindOccupied => await HandleRoomsAsync(command, "occupied"),
                    AssistantActionRegistry.RoomsFindByCode => await HandleRoomByCodeAsync(command),
                    AssistantActionRegistry.RoomsCreate => ConfirmationResponse(command, BuildRoomCreatePreview(command)),
                    AssistantActionRegistry.TenantsFindAll => await HandleTenantsAsync(command),
                    AssistantActionRegistry.TenantsCreate => ConfirmationResponse(command, BuildTenantCreatePreview(command)),
                    AssistantActionRegistry.ContractsFindAll => await HandleContractsAsync(command, null),
                    AssistantActionRegistry.ContractsFindActive => await HandleContractsAsync(command, "active"),
                    AssistantActionRegistry.ContractsFindByRoom => await HandleContractByRoomAsync(command),
                    AssistantActionRegistry.ContractsCreate => await PreviewContractCreateAsync(command),
                    AssistantActionRegistry.ContractsEnd => await PreviewContractEndAsync(command),
                    AssistantActionRegistry.InvoicesFindAll => await HandleInvoicesAsync(command),
                    AssistantActionRegistry.InvoicesFindUnpaid => await HandleUnpaidInvoicesAsync(command),
                    AssistantActionRegistry.InvoicesFindByRoomMonth => await HandleInvoiceByRoomMonthAsync(command),
                    AssistantActionRegistry.InvoicesCreateMonthlyBulk => await PreviewInvoiceMonthlyBulkCreateAsync(command),
                    AssistantActionRegistry.InvoicesMarkPaid => await PreviewInvoiceMarkPaidAsync(command),
                    AssistantActionRegistry.TransactionsFind => await HandleTransactionsAsync(command),
                    AssistantActionRegistry.TransactionsCreate => ConfirmationResponse(command, BuildTransactionCreatePreview(command)),
                    AssistantActionRegistry.ReportsMonthlyRevenue => await HandleMonthlyRevenueReportAsync(command),
                    AssistantActionRegistry.ReportsMonthlyExpense => await HandleMonthlyExpenseReportAsync(command),
                    AssistantActionRegistry.ReportsMonthlyProfitLoss => await HandleMonthlyProfitLossReportAsync(command),
                    AssistantActionRegistry.ReportsPaymentStatus => await HandlePaymentStatusReportAsync(command),
                    _ => HelpResponse($"Mình đã hiểu intent {command.Intent}, nhưng action này chưa được nối executor.", command)
                };
            }
            catch (Exception ex)
            {
                return ErrorResponse(command, ex.Message);
            }
        }

        private async Task<AssistantResponseDto> PreviewMeterReadingCreateAsync(AssistantCommandDto command)
        {
            var payload = await BuildMeterReadingPayloadAsync(command);
            var preview = await _meterReadingService.PreviewAsync(payload);
            return ConfirmationResponse(
                command,
                $"Mình sẽ nhập số điện phòng {preview.RoomCode} tháng {preview.BillingMonth:MM/yyyy}: chỉ số cũ {preview.PreviousReading}, chỉ số mới {preview.CurrentReading}, tiêu thụ {preview.ConsumedUnits} kWh, thành tiền {FormatMoney(preview.Amount)}.",
                preview);
        }

        private async Task<AssistantResponseDto> ExecuteMeterReadingCreateAsync(AssistantCommandDto command)
        {
            var payload = await BuildMeterReadingPayloadAsync(command);
            var result = await _meterReadingService.CreateAsync(payload);
            return SuccessResponse(command, $"Đã nhập chỉ số điện phòng {result.RoomCode} tháng {result.BillingMonth:MM/yyyy}.", result);
        }

        private async Task<CreateMeterReadingDto> BuildMeterReadingPayloadAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            var room = await _roomService.GetByRoomCodeAsync(roomCode)
                ?? throw new InvalidOperationException($"Không tìm thấy phòng {roomCode} trong tài khoản hiện tại.");
            var activeContract = await _contractService.GetActiveByRoomCodeAsync(roomCode)
                ?? throw new InvalidOperationException($"Phòng {roomCode} chưa có hợp đồng đang hiệu lực.");

            return new CreateMeterReadingDto
            {
                RoomId = room.RoomId,
                ContractId = activeContract.ContractId,
                BillingMonth = ParseDate(command, "billingMonth"),
                CurrentReading = ParseInt(command, "currentReading")
            };
        }

        private async Task<AssistantResponseDto> HandleMissingMeterReadingsAsync(AssistantCommandDto command)
        {
            var month = ParseDate(command, "billingMonth");
            var result = await _meterReadingService.GetMissingAsync(month);
            var message = result.Count == 0
                ? $"Tất cả phòng đang thuê đã có số điện tháng {month:MM/yyyy}."
                : $"Còn {result.Count} phòng chưa nhập số điện tháng {month:MM/yyyy}: {string.Join(", ", result.Select(x => x.RoomCode))}.";
            return MessageResponse(command, message, result);
        }

        private async Task<AssistantResponseDto> HandleRoomsAsync(AssistantCommandDto command, string? status)
        {
            var rooms = await _roomService.GetAllAsync(status);
            var label = status switch
            {
                "vacant" => "phòng trống",
                "occupied" => "phòng đang thuê",
                _ => "phòng"
            };
            var message = rooms.Count == 0
                ? $"Không có {label}."
                : $"Có {rooms.Count} {label}: {string.Join(", ", rooms.Select(x => $"{x.RoomCode} ({FormatMoney(x.ListedPrice)}, {x.Status})"))}.";
            return MessageResponse(command, message, rooms);
        }

        private async Task<AssistantResponseDto> HandleRoomByCodeAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            var room = await _roomService.GetByRoomCodeAsync(roomCode);
            return room == null
                ? ErrorResponse(command, $"Không tìm thấy phòng {roomCode}.")
                : MessageResponse(command, $"Phòng {room.RoomCode}: giá niêm yết {FormatMoney(room.ListedPrice)}, trạng thái {room.Status}.", room);
        }

        private string BuildRoomCreatePreview(AssistantCommandDto command)
        {
            return $"Mình sẽ tạo phòng {Require(command, "roomCode")} với giá niêm yết {FormatMoney(ParseDecimal(command, "listedPrice"))}.";
        }

        private async Task<AssistantResponseDto> ExecuteRoomCreateAsync(AssistantCommandDto command)
        {
            var result = await _roomService.CreateAsync(new CreateRoomDto
            {
                RoomCode = Require(command, "roomCode"),
                ListedPrice = ParseDecimal(command, "listedPrice"),
                Status = Param(command, "roomStatus") ?? "vacant"
            });
            return SuccessResponse(command, $"Đã tạo phòng {result.RoomCode}.", result);
        }

        private async Task<AssistantResponseDto> HandleTenantsAsync(AssistantCommandDto command)
        {
            var tenants = await _tenantService.GetAllAsync();
            var message = tenants.Count == 0
                ? "Chưa có khách thuê nào."
                : $"Có {tenants.Count} khách thuê: {string.Join(", ", tenants.Select(x => $"{x.FullName} ({x.Phone ?? "chưa có SĐT"})"))}.";
            return MessageResponse(command, message, tenants);
        }

        private string BuildTenantCreatePreview(AssistantCommandDto command)
        {
            var phone = Param(command, "phone");
            return $"Mình sẽ tạo khách thuê {Require(command, "tenantName")}{(phone == null ? string.Empty : $" - {phone}")}.";
        }

        private async Task<AssistantResponseDto> ExecuteTenantCreateAsync(AssistantCommandDto command)
        {
            var result = await _tenantService.CreateAsync(new CreateTenantDto
            {
                FullName = Require(command, "tenantName"),
                Phone = Param(command, "phone"),
                CCCD = Param(command, "cccd")
            });
            return SuccessResponse(command, $"Đã tạo khách thuê {result.FullName}.", result);
        }

        private async Task<AssistantResponseDto> HandleContractsAsync(AssistantCommandDto command, string? status)
        {
            var contracts = await _contractService.GetAllAsync(status);
            var label = status == "active" ? "hợp đồng đang hiệu lực" : "hợp đồng";
            var message = contracts.Count == 0
                ? $"Không có {label}."
                : $"Có {contracts.Count} {label}: {string.Join(", ", contracts.Select(x => $"{x.RoomCode} - {x.TenantName} ({x.Status})"))}.";
            return MessageResponse(command, message, contracts);
        }

        private async Task<AssistantResponseDto> HandleContractByRoomAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            var contract = await _contractService.GetActiveByRoomCodeAsync(roomCode);
            return contract == null
                ? ErrorResponse(command, $"Phòng {roomCode} chưa có hợp đồng đang hiệu lực.")
                : MessageResponse(command, $"Hợp đồng phòng {contract.RoomCode}: khách {contract.TenantName}, từ {contract.StartDate:dd/MM/yyyy}, giá {FormatMoney(contract.ActualRoomPrice)}, cọc {FormatMoney(contract.DepositAmount)}.", contract);
        }

        private async Task<AssistantResponseDto> PreviewContractCreateAsync(AssistantCommandDto command)
        {
            var (room, tenant) = await ResolveRoomAndTenantAsync(command);
            var startDate = ParseDate(command, "startDate");
            var price = ParseDecimal(command, "actualRoomPrice");
            var deposit = ParseOptionalDecimal(command, "depositAmount") ?? 0;
            var occupants = ParseInt(command, "occupantCount");
            var message = $"Mình sẽ tạo hợp đồng phòng {room.RoomCode} cho {tenant.FullName}, bắt đầu {startDate:dd/MM/yyyy}, giá {FormatMoney(price)}, cọc {FormatMoney(deposit)}, {occupants} người ở.";
            return ConfirmationResponse(command, message, new { room, tenant, startDate, price, deposit, occupants });
        }

        private async Task<AssistantResponseDto> ExecuteContractCreateAsync(AssistantCommandDto command)
        {
            var (room, tenant) = await ResolveRoomAndTenantAsync(command);
            var result = await _contractService.CreateAsync(new CreateContractDto
            {
                RoomId = room.RoomId,
                TenantId = tenant.TenantId,
                StartDate = ParseDate(command, "startDate"),
                ExpectedEndDate = ParseOptionalDate(command, "expectedEndDate"),
                DepositAmount = ParseOptionalDecimal(command, "depositAmount") ?? 0,
                ActualRoomPrice = ParseDecimal(command, "actualRoomPrice"),
                OccupantCount = ParseInt(command, "occupantCount")
            });
            return SuccessResponse(command, $"Đã tạo hợp đồng phòng {result.RoomCode} cho {result.TenantName}.", result);
        }

        private async Task<(RoomDto Room, TenantDto Tenant)> ResolveRoomAndTenantAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            var room = await _roomService.GetByRoomCodeAsync(roomCode)
                ?? throw new InvalidOperationException($"Không tìm thấy phòng {roomCode}.");

            TenantDto? tenant = null;
            if (int.TryParse(Param(command, "tenantId"), out var tenantId))
            {
                tenant = await _tenantService.GetByIdAsync(tenantId);
            }
            else
            {
                var tenantName = Require(command, "tenantName");
                var tenants = await _tenantService.GetAllAsync();
                tenant = tenants.FirstOrDefault(x => string.Equals(x.FullName.Trim(), tenantName.Trim(), StringComparison.OrdinalIgnoreCase));
            }

            return tenant == null
                ? throw new InvalidOperationException("Không tìm thấy khách thuê khớp tên/ID. Hãy tạo khách thuê trước hoặc nhập đúng tên.")
                : (room, tenant);
        }

        private async Task<AssistantResponseDto> PreviewContractEndAsync(AssistantCommandDto command)
        {
            var contract = await ResolveActiveContractByRoomAsync(command);
            var dto = new ContractEndPreviewRequestDto
            {
                ActualEndDate = ParseDate(command, "actualEndDate"),
                CurrentReading = ParseOptionalInt(command, "currentReading")
            };
            var preview = await _contractService.EndPreviewAsync(contract.ContractId, dto);
            return ConfirmationResponse(command, $"Mình sẽ kết thúc hợp đồng phòng {contract.RoomCode} ngày {dto.ActualEndDate:dd/MM/yyyy}.", preview);
        }

        private async Task<AssistantResponseDto> ExecuteContractEndAsync(AssistantCommandDto command)
        {
            var contract = await ResolveActiveContractByRoomAsync(command);
            var result = await _contractService.EndAsync(contract.ContractId, new ContractEndExecuteDto
            {
                ActualEndDate = ParseDate(command, "actualEndDate"),
                CurrentReading = ParseOptionalInt(command, "currentReading"),
                Note = Param(command, "note")
            });
            return result == null
                ? ErrorResponse(command, "Không tìm thấy hợp đồng cần kết thúc.")
                : SuccessResponse(command, $"Đã kết thúc hợp đồng phòng {result.RoomCode}.", result);
        }

        private async Task<ContractDto> ResolveActiveContractByRoomAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            return await _contractService.GetActiveByRoomCodeAsync(roomCode)
                ?? throw new InvalidOperationException($"Phòng {roomCode} chưa có hợp đồng đang hiệu lực.");
        }

        private async Task<AssistantResponseDto> HandleInvoicesAsync(AssistantCommandDto command)
        {
            DateOnly? month = ParseOptionalDate(command, "billingMonth");
            var status = Param(command, "status");
            var roomId = await ResolveOptionalRoomIdAsync(command);
            var invoices = await _invoiceService.GetAllAsync(roomId, month, status);
            var message = invoices.Count == 0
                ? "Không có hóa đơn phù hợp."
                : $"Có {invoices.Count} hóa đơn: {string.Join(", ", invoices.Select(InvoiceSummary))}.";
            return MessageResponse(command, message, invoices);
        }

        private async Task<AssistantResponseDto> HandleUnpaidInvoicesAsync(AssistantCommandDto command)
        {
            var month = ParseOptionalDate(command, "billingMonth");
            var invoices = await _invoiceService.GetUnpaidAsync(month);
            var readableMonth = month.HasValue ? $" tháng {month.Value:MM/yyyy}" : string.Empty;
            var message = invoices.Count == 0
                ? $"Không có hóa đơn chưa thanh toán{readableMonth}."
                : $"Có {invoices.Count} hóa đơn chưa thanh toán{readableMonth}: {string.Join(", ", invoices.Select(InvoiceSummary))}.";
            return MessageResponse(command, message, invoices);
        }

        private async Task<AssistantResponseDto> HandleInvoiceByRoomMonthAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            var room = await _roomService.GetByRoomCodeAsync(roomCode)
                ?? throw new InvalidOperationException($"Không tìm thấy phòng {roomCode}.");
            var month = ParseDate(command, "billingMonth");
            var invoice = await _invoiceService.GetByRoomAndMonthAsync(room.RoomId, month);
            return invoice == null
                ? ErrorResponse(command, $"Không tìm thấy hóa đơn phòng {roomCode} tháng {month:MM/yyyy}.")
                : MessageResponse(command, $"Hóa đơn phòng {roomCode} tháng {month:MM/yyyy}: {FormatMoney(invoice.TotalAmount)}, trạng thái {invoice.Status}.", invoice);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceMonthlyBulkCreateAsync(AssistantCommandDto command)
        {
            var payload = BuildInvoiceBulkPayload(command);
            var preview = await _invoiceService.MonthlyBulkPreviewAsync(payload);
            var total = preview.Sum(x => x.TotalAmount);
            return ConfirmationResponse(command, $"Mình sẽ tạo {preview.Count} hóa đơn tháng {payload.BillingMonth:MM/yyyy}, tổng dự kiến {FormatMoney(total)}.", preview);
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceMonthlyBulkCreateAsync(AssistantCommandDto command)
        {
            var payload = BuildInvoiceBulkPayload(command);
            var result = await _invoiceService.MonthlyBulkCreateAsync(payload);
            return SuccessResponse(command, $"Đã tạo {result.Count} hóa đơn tháng {payload.BillingMonth:MM/yyyy}.", result);
        }

        private InvoiceBulkCreateDto BuildInvoiceBulkPayload(AssistantCommandDto command)
        {
            return new InvoiceBulkCreateDto
            {
                BillingMonth = ParseDate(command, "billingMonth"),
                DefaultDiscountAmount = ParseOptionalDecimal(command, "discountAmount") ?? 0,
                DefaultDebtAmount = ParseOptionalDecimal(command, "debtAmount") ?? 0
            };
        }

        private async Task<AssistantResponseDto> PreviewInvoiceMarkPaidAsync(AssistantCommandDto command)
        {
            var invoiceId = ParseInt(command, "invoiceId");
            var invoice = await _invoiceService.GetByIdAsync(invoiceId)
                ?? throw new InvalidOperationException($"Không tìm thấy hóa đơn {invoiceId}.");
            return ConfirmationResponse(command, $"Mình sẽ đánh dấu hóa đơn {invoiceId} phòng {invoice.RoomCode} đã thanh toán {FormatMoney(ParseDecimal(command, "amount"))}.", invoice);
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceMarkPaidAsync(AssistantCommandDto command)
        {
            var invoiceId = ParseInt(command, "invoiceId");
            var result = await _invoiceService.MarkPaidAsync(invoiceId, new MarkInvoicePaidDto
            {
                Amount = ParseDecimal(command, "amount"),
                PaymentMethod = Param(command, "paymentMethod"),
                PaymentReference = Param(command, "paymentReference"),
                Note = Param(command, "note")
            });
            return result == null
                ? ErrorResponse(command, $"Không tìm thấy hóa đơn {invoiceId}.")
                : SuccessResponse(command, $"Đã ghi nhận thanh toán hóa đơn {invoiceId}.", result);
        }

        private async Task<AssistantResponseDto> HandleTransactionsAsync(AssistantCommandDto command)
        {
            var month = ParseOptionalDate(command, "billingMonth") ?? ParseOptionalDate(command, "transactionDate");
            var type = Param(command, "transactionDirection");
            var result = await _transactionService.GetAllAsync(month, type);
            var message = result.Count == 0
                ? "Không có giao dịch phù hợp."
                : $"Có {result.Count} giao dịch: {string.Join(", ", result.Select(x => $"{x.TransactionDate:dd/MM} {x.TransactionDirection} {FormatMoney(x.Amount)} {x.ItemName}"))}.";
            return MessageResponse(command, message, result);
        }

        private string BuildTransactionCreatePreview(AssistantCommandDto command)
        {
            return $"Mình sẽ ghi giao dịch {Require(command, "transactionDirection")} {FormatMoney(ParseDecimal(command, "amount"))} ngày {ParseDate(command, "transactionDate"):dd/MM/yyyy}.";
        }

        private async Task<AssistantResponseDto> ExecuteTransactionCreateAsync(AssistantCommandDto command)
        {
            var result = await _transactionService.CreateAsync(new CreateTransactionDto
            {
                TransactionDirection = Require(command, "transactionDirection"),
                Category = Param(command, "category") ?? "other",
                ItemName = Param(command, "itemName"),
                Amount = ParseDecimal(command, "amount"),
                TransactionDate = ParseDate(command, "transactionDate"),
                Description = Param(command, "description") ?? Param(command, "note"),
                RelatedRoomId = await ResolveOptionalRoomIdAsync(command)
            });
            return SuccessResponse(command, $"Đã ghi giao dịch {FormatMoney(result.Amount)}.", result);
        }

        private async Task<AssistantResponseDto> HandleMonthlyRevenueReportAsync(AssistantCommandDto command)
        {
            var month = ParseDate(command, "billingMonth");
            var result = await _reportService.GetMonthlyRevenueAsync(month);
            return MessageResponse(command, $"Doanh thu tháng {month:MM/yyyy}: {FormatMoney(result.TotalRevenue)}.", result);
        }

        private async Task<AssistantResponseDto> HandleMonthlyExpenseReportAsync(AssistantCommandDto command)
        {
            var month = ParseDate(command, "billingMonth");
            var result = await _reportService.GetMonthlyExpenseAsync(month);
            return MessageResponse(command, $"Chi phí tháng {month:MM/yyyy}: {FormatMoney(result.TotalExpense)}.", result);
        }

        private async Task<AssistantResponseDto> HandleMonthlyProfitLossReportAsync(AssistantCommandDto command)
        {
            var month = ParseDate(command, "billingMonth");
            var result = await _reportService.GetMonthlyProfitLossAsync(month);
            return MessageResponse(command, $"Lãi/lỗ tháng {month:MM/yyyy}: {FormatMoney(result.ProfitLoss)}.", result);
        }

        private async Task<AssistantResponseDto> HandlePaymentStatusReportAsync(AssistantCommandDto command)
        {
            var month = ParseDate(command, "billingMonth");
            var result = await _reportService.GetPaymentStatusAsync(month);
            var unpaid = result.Count(x => !string.Equals(x.Status, "paid", StringComparison.OrdinalIgnoreCase));
            return MessageResponse(command, $"Tháng {month:MM/yyyy} có {result.Count} hóa đơn, {unpaid} hóa đơn chưa thanh toán.", result);
        }

        private AssistantCommandDto MergeCommands(AssistantCommandDto existing, AssistantCommandDto incoming)
        {
            var merged = CloneCommand(existing);
            foreach (var item in incoming.Params)
            {
                if (!string.IsNullOrWhiteSpace(item.Value))
                {
                    merged.Params[item.Key] = item.Value;
                }
            }

            return _commandParser.Normalize(merged);
        }

        private static AssistantCommandDto CloneCommand(AssistantCommandDto command)
        {
            return new AssistantCommandDto
            {
                Intent = command.Intent,
                Params = command.Params.ToDictionary(x => x.Key, x => x.Value),
                MissingFields = command.MissingFields.ToList(),
                RequiresConfirmation = command.RequiresConfirmation
            };
        }

        private static bool IsCancelMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "huy" or "huy lenh" or "bo qua" or "thoi" or "thoi bo qua" or "cancel";
        }

        private static bool IsRejectMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "sai" or "sai roi" or "khong dung" or "khong phai" or "nham" or "nham roi" or "wrong";
        }

        private static bool IsNoProgress(AssistantCommandDto before, AssistantCommandDto after)
        {
            if (!string.Equals(before.Intent, after.Intent, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var beforeMissing = before.MissingFields.OrderBy(x => x).ToList();
            var afterMissing = after.MissingFields.OrderBy(x => x).ToList();
            return beforeMissing.SequenceEqual(afterMissing);
        }

        private static string NormalizeText(string value)
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

        private AssistantResponseDto ConfirmationResponse(AssistantCommandDto command, string message, object? preview = null)
        {
            var commandId = _commandStore.AddCommand(_currentUserService.UserId, command);
            return new AssistantResponseDto
            {
                Type = "confirmation_required",
                Intent = command.Intent,
                Command = command,
                CommandId = commandId,
                Preview = preview,
                Message = $"{message} Bạn xác nhận để thực hiện."
            };
        }

        private static AssistantResponseDto MessageResponse(AssistantCommandDto command, string message, object? result = null)
        {
            return new AssistantResponseDto
            {
                Type = "message",
                Intent = command.Intent,
                Command = command,
                Message = message,
                Result = result
            };
        }

        private static AssistantResponseDto SuccessResponse(AssistantCommandDto command, string message, object? result = null)
        {
            return new AssistantResponseDto
            {
                Type = "success",
                Intent = command.Intent,
                Command = command,
                Message = message,
                Result = result
            };
        }

        private static AssistantResponseDto NeedMoreInfo(AssistantCommandDto command, string message)
        {
            return new AssistantResponseDto
            {
                Type = "need_more_info",
                Intent = command.Intent,
                Command = command,
                Message = message
            };
        }

        private static AssistantResponseDto ErrorResponse(AssistantCommandDto command, string message)
        {
            return new AssistantResponseDto
            {
                Type = "error",
                Intent = command.Intent,
                Command = command,
                Message = message
            };
        }

        private static AssistantResponseDto HelpResponse(string message, AssistantCommandDto? command = null)
        {
            return new AssistantResponseDto
            {
                Type = "message",
                Intent = command?.Intent ?? IntentHelp,
                Command = command,
                Message = message,
                Suggestions =
                {
                    "Nhập số điện tháng 10 phòng A1 là 1000",
                    "Tạo phòng A2 giá 2500000",
                    "Tạo hợp đồng phòng A1 cho Nguyễn Văn A từ 01/07 giá 3000000",
                    "Tạo hóa đơn tháng 10 cho tất cả phòng",
                    "Doanh thu tháng 10"
                }
            };
        }

        private static string BuildMissingFieldMessage(IReadOnlyCollection<string> missingFields)
        {
            var labels = new Dictionary<string, string>
            {
                ["roomCode"] = "mã phòng",
                ["listedPrice"] = "giá phòng",
                ["tenantName"] = "tên khách thuê",
                ["billingMonth"] = "tháng",
                ["currentReading"] = "chỉ số điện mới",
                ["startDate"] = "ngày bắt đầu",
                ["actualEndDate"] = "ngày kết thúc",
                ["actualRoomPrice"] = "giá thuê thực tế",
                ["occupantCount"] = "số người ở",
                ["amount"] = "số tiền",
                ["transactionDirection"] = "loại thu/chi",
                ["category"] = "nhóm giao dịch",
                ["transactionDate"] = "ngày giao dịch",
                ["invoiceId"] = "mã hóa đơn"
            };

            var readable = missingFields
                .Select(x => labels.TryGetValue(x, out var label) ? label : x)
                .ToList();
            return $"Bạn bổ sung giúp mình: {string.Join(", ", readable)}.";
        }

        private static string BuildFieldLabel(string field)
        {
            return field switch
            {
                "roomCode" => "mã phòng",
                "listedPrice" => "giá phòng",
                "tenantName" => "tên khách thuê",
                "billingMonth" => "tháng",
                "currentReading" => "chỉ số điện mới",
                "startDate" => "ngày bắt đầu",
                "actualEndDate" => "ngày kết thúc",
                "actualRoomPrice" => "giá thuê",
                "occupantCount" => "số người ở",
                "amount" => "số tiền",
                "transactionDate" => "ngày giao dịch",
                "invoiceId" => "mã hóa đơn",
                _ => field
            };
        }

        private async Task<int?> ResolveOptionalRoomIdAsync(AssistantCommandDto command)
        {
            var roomCode = Param(command, "roomCode");
            if (string.IsNullOrWhiteSpace(roomCode))
            {
                return null;
            }

            var room = await _roomService.GetByRoomCodeAsync(roomCode);
            return room?.RoomId;
        }

        private static string InvoiceSummary(InvoiceDto invoice)
        {
            var month = invoice.BillingMonth.HasValue ? $" {invoice.BillingMonth.Value:MM/yyyy}" : string.Empty;
            return $"{invoice.RoomCode}{month} - {FormatMoney(invoice.TotalAmount)} ({invoice.Status})";
        }

        private static string? Param(AssistantCommandDto command, string key)
        {
            return command.Params.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
                ? value.Trim()
                : null;
        }

        private static string Require(AssistantCommandDto command, string key)
        {
            return Param(command, key) ?? throw new InvalidOperationException($"Thiếu thông tin: {key}.");
        }

        private static DateOnly ParseDate(AssistantCommandDto command, string key)
        {
            var value = Require(command, key);
            if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }

            throw new InvalidOperationException($"Giá trị ngày/tháng không hợp lệ: {key}.");
        }

        private static DateOnly? ParseOptionalDate(AssistantCommandDto command, string key)
        {
            var value = Param(command, key);
            if (value == null)
            {
                return null;
            }

            if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }

            throw new InvalidOperationException($"Giá trị ngày/tháng không hợp lệ: {key}.");
        }

        private static int ParseInt(AssistantCommandDto command, string key)
        {
            var value = Require(command, key);
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)
                ? number
                : throw new InvalidOperationException($"Giá trị số nguyên không hợp lệ: {key}.");
        }

        private static int? ParseOptionalInt(AssistantCommandDto command, string key)
        {
            var value = Param(command, key);
            if (value == null)
            {
                return null;
            }

            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)
                ? number
                : throw new InvalidOperationException($"Giá trị số nguyên không hợp lệ: {key}.");
        }

        private static decimal ParseDecimal(AssistantCommandDto command, string key)
        {
            var value = Require(command, key);
            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                ? number
                : throw new InvalidOperationException($"Giá trị tiền/số không hợp lệ: {key}.");
        }

        private static decimal? ParseOptionalDecimal(AssistantCommandDto command, string key)
        {
            var value = Param(command, key);
            if (value == null)
            {
                return null;
            }

            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                ? number
                : throw new InvalidOperationException($"Giá trị tiền/số không hợp lệ: {key}.");
        }

        private static string FormatMoney(decimal amount)
        {
            return amount.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + "đ";
        }
    }
}
