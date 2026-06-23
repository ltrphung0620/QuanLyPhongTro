using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using NhaTro.Dtos.Assistant;
using NhaTro.Dtos.Contracts;
using NhaTro.Dtos.Invoices;
using NhaTro.Dtos.MeterReadings;
using NhaTro.Dtos.Payments;
using NhaTro.Dtos.Rooms;
using NhaTro.Dtos.Reports;
using NhaTro.Dtos.Tenants;
using NhaTro.Dtos.Transactions;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class AssistantService : IAssistantService
    {
        private const string IntentHelp = "assistant.help";
        private const string TenantSelectionField = "tenantSelection";
        private const string TenantCandidateIdsParam = "_tenantCandidateIds";

        private readonly IRoomService _roomService;
        private readonly ITenantService _tenantService;
        private readonly IContractService _contractService;
        private readonly IMeterReadingService _meterReadingService;
        private readonly IInvoiceService _invoiceService;
        private readonly ITransactionService _transactionService;
        private readonly IReportService _reportService;
        private readonly IPaymentService _paymentService;
        private readonly ICurrentUserService _currentUserService;
        private readonly AssistantCommandStore _commandStore;
        private readonly AssistantConversationStore _conversationStore;
        private readonly AssistantAgentStateStore _agentStateStore;
        private readonly IAssistantCommandParser _commandParser;
        private readonly AssistantActionRegistry _actionRegistry;
        private readonly AssistantToolRegistry _toolRegistry;
        private readonly AssistantLearningStore _learningStore;
        private readonly AssistantAuditStore _auditStore;
        private readonly AssistantAgentPlanner _agentPlanner;

        public AssistantService(
            IRoomService roomService,
            ITenantService tenantService,
            IContractService contractService,
            IMeterReadingService meterReadingService,
            IInvoiceService invoiceService,
            ITransactionService transactionService,
            IReportService reportService,
            IPaymentService paymentService,
            ICurrentUserService currentUserService,
            AssistantCommandStore commandStore,
            AssistantConversationStore conversationStore,
            AssistantAgentStateStore agentStateStore,
            IAssistantCommandParser commandParser,
            AssistantActionRegistry actionRegistry,
            AssistantToolRegistry toolRegistry,
            AssistantLearningStore learningStore,
            AssistantAuditStore auditStore,
            AssistantAgentPlanner agentPlanner)
        {
            _roomService = roomService;
            _tenantService = tenantService;
            _contractService = contractService;
            _meterReadingService = meterReadingService;
            _invoiceService = invoiceService;
            _transactionService = transactionService;
            _reportService = reportService;
            _paymentService = paymentService;
            _currentUserService = currentUserService;
            _commandStore = commandStore;
            _conversationStore = conversationStore;
            _agentStateStore = agentStateStore;
            _commandParser = commandParser;
            _actionRegistry = actionRegistry;
            _toolRegistry = toolRegistry;
            _learningStore = learningStore;
            _auditStore = auditStore;
            _agentPlanner = agentPlanner;
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
                var cancelResponse = new AssistantResponseDto
                {
                    Type = "message",
                    Intent = "assistant.cancel",
                    Message = "Mình đã hủy lệnh đang nhập dở."
                };
                RecordAudit("cancel", message, new AssistantCommandDto { Intent = "assistant.cancel" }, cancelResponse, "handled");
                return cancelResponse;
            }

            _conversationStore.TryGet(userId, out var pendingConversation);
            if (pendingConversation != null && IsRejectMessage(message))
            {
                var originalMessage = pendingConversation.OriginalMessage ?? message;
                _learningStore.RecordMistake(userId, originalMessage, pendingConversation.Command);
                _conversationStore.Set(userId, pendingConversation.Command, isCorrectionMode: true, originalMessage: originalMessage);
                var correctionResponse = new AssistantResponseDto
                {
                    Type = "need_more_info",
                    Intent = "assistant.correct",
                    Message = "Mình ghi nhận lệnh vừa rồi chưa đúng. Bạn muốn sửa lại như thế nào?",
                    PendingCommand = pendingConversation.Command,
                    ActionSuggestions = BuildActionSuggestions()
                };
                RecordAudit("correction_requested", originalMessage, pendingConversation.Command, correctionResponse, "needs_user_correction");
                return correctionResponse;
            }

            if (pendingConversation?.IsCorrectionMode == true
                && TryExtractSelectedIntent(message, out var selectedIntent)
                && _actionRegistry.TryGet(selectedIntent, out var selectedAction))
            {
                var originalMessage = pendingConversation.OriginalMessage ?? message;
                var correctionContext = new AssistantCommandDto
                {
                    Intent = selectedIntent,
                    RequiresConfirmation = selectedAction.RequiresConfirmation,
                    MissingFields = selectedAction.RequiredFields.ToList()
                };
                var correctedParse = await _commandParser.ParseAsync(originalMessage, correctionContext);
                var correctedCommand = correctedParse.Command;
                _learningStore.RecordCorrection(userId, originalMessage, correctedCommand);

                var correctedResponse = await DispatchAsync(correctedCommand);
                if (correctedResponse.Type == "need_more_info")
                {
                    _conversationStore.Set(userId, correctedCommand, originalMessage: originalMessage);
                    correctedResponse.PendingCommand = correctedCommand;
                }
                else if (correctedResponse.Type == "confirmation_required")
                {
                    _conversationStore.Set(userId, correctedCommand, originalMessage: originalMessage);
                }
                else if (correctedResponse.Type != "error")
                {
                    _conversationStore.Clear(userId);
                }

                correctedResponse.Parser = "learned";
                correctedResponse.Confidence = correctedCommand.Confidence;
                correctedResponse.Reason = correctedCommand.Reason;
                RecordAudit("correction_applied", originalMessage, correctedCommand, correctedResponse, "learned_correction");
                return correctedResponse;
            }

            var activeConversation = pendingConversation?.IsReviewOnly == true ? null : pendingConversation;
            if (activeConversation != null && HasPendingTenantSelection(activeConversation.Command))
            {
                if (!TryApplyTenantSelection(activeConversation.Command, message))
                {
                    return await BuildTenantSelectionResponseAsync(activeConversation.Command);
                }

                var selectedResponse = await DispatchAsync(activeConversation.Command);
                if (selectedResponse.Type == "confirmation_required")
                {
                    _conversationStore.Set(userId, activeConversation.Command, originalMessage: activeConversation.OriginalMessage);
                }
                else if (selectedResponse.Type != "error")
                {
                    _conversationStore.Clear(userId);
                }

                selectedResponse.Parser = "tenant_selection";
                selectedResponse.Confidence = 1;
                selectedResponse.Reason = "User selected a tenant from the matching candidates.";
                return selectedResponse;
            }

            var parseResult = await _commandParser.ParseAsync(message, activeConversation?.Command);
            var command = activeConversation == null
                ? parseResult.Command
                : MergeCommands(activeConversation.Command, parseResult.Command);

            if (activeConversation == null && ShouldAskForIntentClarification(command))
            {
                _learningStore.RecordMistake(userId, message, command);
                _conversationStore.Set(userId, command, isCorrectionMode: true, originalMessage: message);
                var clarifyResponse = new AssistantResponseDto
                {
                    Type = "need_more_info",
                    Intent = "assistant.clarify_intent",
                    Parser = parseResult.Parser,
                    Confidence = command.Confidence,
                    Reason = command.Reason,
                    Command = command,
                    PendingCommand = command,
                    Message = "Mình chưa đủ chắc bạn muốn làm nghiệp vụ nào. Bạn chọn giúp mình một nghiệp vụ đúng nhé.",
                    ActionSuggestions = BuildActionSuggestions()
                };
                RecordAudit("clarify_intent", message, command, clarifyResponse, "needs_user_clarification");
                return clarifyResponse;
            }

            var response = await DispatchAsync(command);
            var learnedValueAlias = false;
            string? learnedValue = null;
            if (activeConversation?.IsValueLearningMode == true
                && !string.IsNullOrWhiteSpace(activeConversation.LearningField)
                && command.Params.TryGetValue(activeConversation.LearningField, out var parsedLearnedValue)
                && !string.IsNullOrWhiteSpace(parsedLearnedValue))
            {
                learnedValue = parsedLearnedValue;
                learnedValueAlias = true;
            }

            if (learnedValueAlias)
            {
                var learningConversation = activeConversation!;
                _learningStore.RecordValueAlias(
                    userId,
                    learningConversation.Command.Intent,
                    learningConversation.LearningField!,
                    learningConversation.LearningRawValue ?? message,
                    learnedValue!);
            }

            if (response.Type == "need_more_info")
            {
                if (activeConversation?.IsValueLearningMode == true && !learnedValueAlias)
                {
                    _conversationStore.Set(
                        userId,
                        activeConversation.Command,
                        isValueLearningMode: true,
                        learningField: activeConversation.LearningField,
                        learningRawValue: activeConversation.LearningRawValue,
                        originalMessage: activeConversation.OriginalMessage);

                    response.PendingCommand = activeConversation.Command;
                    return response;
                }

                if (activeConversation != null
                    && !activeConversation.IsValueLearningMode
                    && IsNoProgress(activeConversation.Command, command))
                {
                    var field = command.MissingFields.FirstOrDefault();
                    if (!string.IsNullOrWhiteSpace(field))
                    {
                        _conversationStore.Set(
                            userId,
                            activeConversation.Command,
                            isValueLearningMode: true,
                            learningField: field,
                            learningRawValue: message,
                            originalMessage: activeConversation.OriginalMessage ?? message);

                        return new AssistantResponseDto
                        {
                            Type = "need_more_info",
                            Intent = "assistant.learn_value",
                            Message = $"Mình chưa hiểu \"{message}\" là {BuildFieldLabel(field)}. Bạn nhập giúp mình giá trị chuẩn nhé.",
                            PendingCommand = activeConversation.Command
                        };
                    }
                }

                _conversationStore.Set(userId, command, originalMessage: activeConversation?.OriginalMessage ?? message);
                response.PendingCommand = command;
            }
            else if (response.Type == "confirmation_required")
            {
                if (activeConversation?.IsCorrectionMode == true)
                {
                    _learningStore.RecordCorrection(userId, activeConversation.OriginalMessage ?? message, command);
                }

                _conversationStore.Set(userId, command, originalMessage: activeConversation?.OriginalMessage ?? message);
            }
            else if (response.Type != "error")
            {
                if (activeConversation?.IsCorrectionMode == true)
                {
                    _learningStore.RecordCorrection(userId, activeConversation.OriginalMessage ?? message, command);
                }

                _conversationStore.Set(userId, command, originalMessage: activeConversation?.OriginalMessage ?? message, isReviewOnly: true);
            }

            response.Parser = parseResult.Parser;
            response.Confidence = command.Confidence;
            response.Reason = command.Reason;
            RecordAudit("message", message, command, response, response.Type == "error" ? "error" : "handled");
            return response;
        }

        public async Task<AssistantResponseDto> HandleAgentAsync(string message)
        {
            if (_currentUserService.Role == "Tenant" || _currentUserService.Role == "SuperAdmin")
            {
                throw new InvalidOperationException("User has no permission to access AI Agent.");
            }

            if (string.IsNullOrWhiteSpace(message))
            {
                return HelpResponse("Bạn nhập mục tiêu cần agent xử lý nhé.");
            }

            var userId = _currentUserService.UserId;
            if (_conversationStore.TryGet(userId, out var correctionConversation)
                && correctionConversation?.IsCorrectionMode == true)
            {
                if (IsClearlyNewAgentRequest(message))
                {
                    _conversationStore.Clear(userId);
                }
                else
                {
                    return await HandleMessageAsync(message);
                }
            }

            _agentStateStore.TryGet(userId, out var pendingState);
            if (pendingState != null
                && !pendingState.Execution.Completed
                && IsClearlyNewAgentRequest(message))
            {
                _agentStateStore.Clear(userId);
                pendingState = null;
            }

            if (pendingState != null)
            {
                if (IsCancelMessage(message) || IsStopAgentMessage(message))
                {
                    _agentStateStore.Clear(userId);
                    var cancelResponse = new AssistantResponseDto
                    {
                        Type = "message",
                        Intent = "agent.cancel",
                        Message = "Mình đã dừng kế hoạch agent đang chạy.",
                        AgentPlan = pendingState.Plan,
                        AgentExecution = pendingState.Execution,
                        Result = pendingState.Execution
                    };
                    RecordAudit("agent_cancel", message, new AssistantCommandDto { Intent = "agent.cancel" }, cancelResponse, "cancelled", resultSummary: pendingState.Execution);
                    return cancelResponse;
                }

                if (IsRejectMessage(message))
                {
                    var currentStepNumber = pendingState.NextStepNumber - 1;
                    var currentStep = pendingState.Plan.Steps.FirstOrDefault(x => x.StepNumber == currentStepNumber);
                    var command = currentStep != null ? BuildCommandFromAgentStep(currentStep) : new AssistantCommandDto { Intent = "agent.unknown" };

                    _learningStore.RecordMistake(userId, pendingState.OriginalMessage, command);
                    _agentStateStore.Clear(userId);
                    _conversationStore.Set(userId, command, isCorrectionMode: true, originalMessage: pendingState.OriginalMessage);

                    var correctionResponse = new AssistantResponseDto
                    {
                        Type = "need_more_info",
                        Intent = "assistant.correct",
                        Message = "Mình ghi nhận bước vừa rồi hoặc kế hoạch chạy chưa đúng. Bạn muốn sửa lại như thế nào?",
                        PendingCommand = command,
                        ActionSuggestions = BuildActionSuggestions()
                    };
                    RecordAudit("agent_correction_requested", pendingState.OriginalMessage, command, correctionResponse, "needs_user_correction");
                    return correctionResponse;
                }

                if (pendingState.Plan.MissingInformation.Count > 0)
                {
                    return await ContinueAgentMissingInformationAsync(pendingState, message);
                }

                if (TryExtractMonthUpdate(message, out var updatedMonth))
                {
                    ApplyMonthToPlan(pendingState.Plan, updatedMonth);
                    pendingState.Execution = new AssistantAgentExecutionDto
                    {
                        StateId = pendingState.Execution.StateId,
                        Plan = pendingState.Plan,
                        NextStepNumber = 1,
                        StopReason = $"Updated billing month to {updatedMonth:MM/yyyy}."
                    };
                    return await ExecuteAgentPlanAsync(pendingState.Plan, pendingState.Execution, message, startStepNumber: 1);
                }

                if (pendingState.Execution.WaitingForConfirmation && !string.IsNullOrWhiteSpace(pendingState.Execution.PendingCommandId))
                {
                    var currentStepNumber = pendingState.NextStepNumber - 1;
                    var currentStep = pendingState.Plan.Steps.FirstOrDefault(x => x.StepNumber == currentStepNumber);
                    
                    if (currentStep != null)
                    {
                        _toolRegistry.TryGet(currentStep.Tool, out var tool);
                        var requiresStrong = tool?.RequiresStrongConfirmation ?? false;

                        if (requiresStrong)
                        {
                            if (IsStrongConfirmMessage(message))
                            {
                                var execResult = await ExecuteAsync(pendingState.Execution.PendingCommandId, strongConfirm: true);
                                if (execResult.Type == "error")
                                {
                                    return execResult;
                                }
                                return await ExecuteAgentPlanAsync(pendingState.Plan, pendingState.Execution, message, pendingState.NextStepNumber);
                            }
                            else if (IsContinueAgentMessage(message))
                            {
                                var command = BuildCommandFromAgentStep(currentStep);
                                var blockedResponse = new AssistantResponseDto
                                {
                                    Type = "confirmation_required",
                                    Intent = command.Intent,
                                    Command = command,
                                    CommandId = pendingState.Execution.PendingCommandId,
                                    Preview = pendingState.Execution.Steps.LastOrDefault()?.Observation,
                                    Message = $"Đây là hành động nguy hiểm/có rủi ro cao (yêu cầu: {tool?.Description ?? currentStep.Purpose}). Vui lòng gõ chính xác 'Xác nhận' hoặc 'Đồng ý' để thực hiện.",
                                    RequiresStrongConfirmation = true,
                                    AgentPlan = pendingState.Plan,
                                    AgentExecution = pendingState.Execution
                                };
                                return blockedResponse;
                            }
                        }
                        else
                        {
                            if (IsContinueAgentMessage(message) || IsStrongConfirmMessage(message))
                            {
                                if (_commandStore.TryGet(pendingState.Execution.PendingCommandId, userId, out _))
                                {
                                    var execResult = await ExecuteAsync(pendingState.Execution.PendingCommandId);
                                    if (execResult.Type == "error")
                                    {
                                        return execResult;
                                    }
                                }
                                return await ExecuteAgentPlanAsync(pendingState.Plan, pendingState.Execution, message, pendingState.NextStepNumber);
                            }
                        }
                    }
                }
                else if (IsContinueAgentMessage(message))
                {
                    return await ExecuteAgentPlanAsync(pendingState.Plan, pendingState.Execution, message, pendingState.NextStepNumber);
                }

                if (!pendingState.Execution.Completed)
                {
                    message = $"{pendingState.OriginalMessage}\nUser follow-up: {message}";
                    _agentStateStore.Clear(userId);
                }
            }

            var plan = await _agentPlanner.PlanAsync(message, userId);
            var execution = new AssistantAgentExecutionDto
            {
                StateId = Guid.NewGuid().ToString("N"),
                Plan = plan
            };

            if (plan.Steps.Count == 0)
            {
                var unsupportedResponse = HelpResponse("Mình chưa hiểu rõ yêu cầu này. Bạn diễn đạt lại mục tiêu hoặc bổ sung đối tượng cần thao tác giúp mình nhé.");
                unsupportedResponse.Intent = AssistantActionRegistry.AssistantUnknown;
                unsupportedResponse.Parser = plan.Planner;
                unsupportedResponse.Confidence = plan.Confidence;
                unsupportedResponse.Reason = plan.Reason;
                unsupportedResponse.AgentPlan = plan;
                unsupportedResponse.AgentExecution = execution;
                unsupportedResponse.Result = execution;
                RecordAudit("agent_unknown", message, new AssistantCommandDto { Intent = AssistantActionRegistry.AssistantUnknown }, unsupportedResponse, "needs_rephrase", resultSummary: execution);
                return unsupportedResponse;
            }

            if (plan.MissingInformation.Count > 0)
            {
                var missingResponse = new AssistantResponseDto
                {
                    Type = "need_more_info",
                    Intent = "agent.plan",
                    Parser = plan.Planner,
                    Confidence = plan.Confidence,
                    Reason = plan.Reason,
                    Message = BuildMissingFieldMessage(plan.MissingInformation),
                    AgentPlan = plan,
                    AgentExecution = execution,
                    Result = execution
                };
                execution.NextStepNumber = 1;
                _agentStateStore.Set(userId, plan, execution, nextStepNumber: 1, originalMessage: message);
                RecordAudit("agent_plan_missing_info", message, new AssistantCommandDto { Intent = "agent.plan" }, missingResponse, "needs_more_info", resultSummary: execution);
                return missingResponse;
            }

            foreach (var step in plan.Steps.OrderBy(x => x.StepNumber))
            {
                if (!_toolRegistry.TryGet(step.Tool, out var tool))
                {
                    execution.StopReason = $"Tool {step.Tool} is not registered.";
                    var errorCommand = BuildCommandFromAgentStep(step);
                    var errorResponse = ErrorResponse(errorCommand, execution.StopReason);
                    errorResponse.Parser = plan.Planner;
                    errorResponse.Confidence = plan.Confidence;
                    errorResponse.Reason = plan.Reason;
                    errorResponse.AgentPlan = plan;
                    errorResponse.AgentExecution = execution;
                    errorResponse.Result = execution;
                    execution.NextStepNumber = step.StepNumber;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber, message);
                    RecordAudit("agent_tool_missing", message, errorCommand, errorResponse, "error", error: execution.StopReason, resultSummary: execution);
                    return errorResponse;
                }

                if (!ShouldRunAgentStep(step, execution, out var skipReason))
                {
                    execution.Steps.Add(new AssistantAgentStepExecutionDto
                    {
                        StepNumber = step.StepNumber,
                        Tool = step.Tool,
                        Intent = step.Intent,
                        Purpose = step.Purpose,
                        Outcome = "skipped",
                        ResponseType = "skipped",
                        Message = skipReason
                    });
                    continue;
                }

                var command = BuildCommandFromAgentStep(step);
                var stepResponse = await DispatchAsync(command);
                step.Args = command.Params.ToDictionary(x => x.Key, x => x.Value);
                var observation = stepResponse.Result ?? stepResponse.Preview;
                execution.Steps.Add(new AssistantAgentStepExecutionDto
                {
                    StepNumber = step.StepNumber,
                    Tool = step.Tool,
                    Intent = command.Intent,
                    Purpose = step.Purpose,
                    Outcome = stepResponse.Type == "error" ? "error" : stepResponse.Type,
                    ResponseType = stepResponse.Type,
                    Message = stepResponse.Message,
                    Observation = observation
                });

                if (stepResponse.Type == "error" || stepResponse.Type == "need_more_info")
                {
                    if (stepResponse.Type == "need_more_info")
                    {
                        plan.MissingInformation = command.MissingFields.ToList();
                    }
                    execution.StopReason = stepResponse.Message;
                    stepResponse.Parser = plan.Planner;
                    stepResponse.Confidence = plan.Confidence;
                    stepResponse.Reason = plan.Reason;
                    stepResponse.AgentPlan = plan;
                    stepResponse.AgentExecution = execution;
                    stepResponse.Result = execution;
                    execution.NextStepNumber = step.StepNumber;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber, message);
                    RecordAudit("agent_step_stopped", message, command, stepResponse, stepResponse.Type, error: stepResponse.Type == "error" ? stepResponse.Message : null, resultSummary: execution);
                    return stepResponse;
                }

                if (ShouldStopAfterObservation(step, observation, plan))
                {
                    execution.StopReason = step.StopIf;
                    var stopResponse = MessageResponse(command, stepResponse.Message, execution);
                    stopResponse.Parser = plan.Planner;
                    stopResponse.Confidence = plan.Confidence;
                    stopResponse.Reason = plan.Reason;
                    stopResponse.AgentPlan = plan;
                    stopResponse.AgentExecution = execution;
                    execution.NextStepNumber = step.StepNumber + 1;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber + 1, message);
                    RecordAudit("agent_step_condition_stop", message, command, stopResponse, "stopped", resultSummary: execution);
                    return stopResponse;
                }

                if (stepResponse.Type == "confirmation_required")
                {
                    execution.WaitingForConfirmation = true;
                    execution.PendingCommandId = stepResponse.CommandId;
                    execution.StopReason = "Waiting for user confirmation before executing a write/high-risk tool.";
                    stepResponse.Parser = plan.Planner;
                    stepResponse.Confidence = plan.Confidence;
                    stepResponse.Reason = plan.Reason;
                    stepResponse.AgentPlan = plan;
                    stepResponse.AgentExecution = execution;
                    stepResponse.Result = execution;
                    execution.NextStepNumber = step.StepNumber + 1;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber + 1, message);
                    RecordAudit("agent_waiting_confirmation", message, command, stepResponse, "waiting_confirmation", stepResponse.CommandId, resultSummary: execution);
                    return stepResponse;
                }
            }

            execution.Completed = true;
            var completedResponse = new AssistantResponseDto
            {
                Type = "success",
                Intent = "agent.completed",
                Parser = plan.Planner,
                Confidence = plan.Confidence,
                Reason = plan.Reason,
                Message = BuildAgentCompletionMessage(execution),
                AgentPlan = plan,
                AgentExecution = execution,
                Result = execution
            };
            execution.NextStepNumber = plan.Steps.Count + 1;
            _agentStateStore.Set(userId, plan, execution, execution.NextStepNumber, message);
            RecordAudit("agent_completed", message, new AssistantCommandDto { Intent = "agent.completed" }, completedResponse, "completed", resultSummary: execution);
            return completedResponse;
        }

        private async Task<AssistantResponseDto> ContinueAgentMissingInformationAsync(
            PendingAssistantAgentState pendingState,
            string message)
        {
            var userId = _currentUserService.UserId;
            var step = pendingState.Plan.Steps
                .OrderBy(x => x.StepNumber)
                .FirstOrDefault(x => x.StepNumber >= pendingState.NextStepNumber)
                ?? pendingState.Plan.Steps.OrderBy(x => x.StepNumber).FirstOrDefault();
            if (step == null)
            {
                _agentStateStore.Clear(userId);
                return ErrorResponse(new AssistantCommandDto { Intent = "agent.plan" }, "Kế hoạch đang thiếu bước thực hiện. Bạn nhập lại yêu cầu giúp mình nhé.");
            }
            var existingCommand = BuildCommandFromAgentStep(step);
            AssistantParseResult parseResult;
            AssistantCommandDto mergedCommand;
            if (HasPendingTenantSelection(existingCommand))
            {
                if (!TryApplyTenantSelection(existingCommand, message))
                {
                    var retryResponse = await BuildTenantSelectionResponseAsync(existingCommand);
                    retryResponse.AgentPlan = pendingState.Plan;
                    retryResponse.AgentExecution = pendingState.Execution;
                    retryResponse.Result = pendingState.Execution;
                    return retryResponse;
                }

                mergedCommand = existingCommand;
                parseResult = new AssistantParseResult
                {
                    Command = mergedCommand,
                    Parser = "tenant_selection",
                    Confidence = 1,
                    Reason = "User selected a tenant from the matching candidates."
                };
            }
            else
            {
                _commandParser.Normalize(existingCommand);
                parseResult = await _commandParser.ParseAsync(message, existingCommand);
                mergedCommand = MergeCommands(existingCommand, parseResult.Command);
            }
            step.Args = mergedCommand.Params.ToDictionary(x => x.Key, x => x.Value);
            pendingState.Plan.MissingInformation = mergedCommand.MissingFields.ToList();
            pendingState.Plan.Confidence = Math.Max(pendingState.Plan.Confidence, mergedCommand.Confidence);
            pendingState.Plan.Reason = mergedCommand.Reason;

            var execution = new AssistantAgentExecutionDto
            {
                StateId = pendingState.Execution.StateId,
                Plan = pendingState.Plan,
                NextStepNumber = step.StepNumber
            };
            pendingState.Execution = execution;

            if (mergedCommand.MissingFields.Count > 0)
            {
                _agentStateStore.Set(
                    userId,
                    pendingState.Plan,
                    execution,
                    step.StepNumber,
                    pendingState.OriginalMessage);

                var response = new AssistantResponseDto
                {
                    Type = "need_more_info",
                    Intent = mergedCommand.Intent,
                    Parser = parseResult.Parser,
                    Confidence = mergedCommand.Confidence,
                    Reason = mergedCommand.Reason,
                    Message = BuildMissingFieldMessage(mergedCommand.MissingFields),
                    Command = mergedCommand,
                    PendingCommand = mergedCommand,
                    AgentPlan = pendingState.Plan,
                    AgentExecution = execution,
                    Result = execution
                };
                RecordAudit("agent_missing_info_updated", message, mergedCommand, response, "needs_more_info", resultSummary: execution);
                return response;
            }

            _agentStateStore.Clear(userId);
            return await ExecuteAgentPlanAsync(
                pendingState.Plan,
                execution,
                message,
                startStepNumber: step.StepNumber);
        }

        private async Task<AssistantResponseDto> ExecuteAgentPlanAsync(
            AssistantAgentPlanDto plan,
            AssistantAgentExecutionDto execution,
            string message,
            int startStepNumber)
        {
            var userId = _currentUserService.UserId;
            execution.Completed = false;
            execution.WaitingForConfirmation = false;
            execution.PendingCommandId = null;

            foreach (var step in plan.Steps.OrderBy(x => x.StepNumber).Where(x => x.StepNumber >= startStepNumber))
            {
                if (!_toolRegistry.TryGet(step.Tool, out _))
                {
                    execution.StopReason = $"Tool {step.Tool} is not registered.";
                    execution.NextStepNumber = step.StepNumber;
                    var errorCommand = BuildCommandFromAgentStep(step);
                    var errorResponse = ErrorResponse(errorCommand, execution.StopReason);
                    errorResponse.Parser = plan.Planner;
                    errorResponse.Confidence = plan.Confidence;
                    errorResponse.Reason = plan.Reason;
                    errorResponse.AgentPlan = plan;
                    errorResponse.AgentExecution = execution;
                    errorResponse.Result = execution;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber, message);
                    RecordAudit("agent_tool_missing", message, errorCommand, errorResponse, "error", error: execution.StopReason, resultSummary: execution);
                    return errorResponse;
                }

                if (!ShouldRunAgentStep(step, execution, out var skipReason))
                {
                    execution.Steps.Add(new AssistantAgentStepExecutionDto
                    {
                        StepNumber = step.StepNumber,
                        Tool = step.Tool,
                        Intent = step.Intent,
                        Purpose = step.Purpose,
                        Outcome = "skipped",
                        ResponseType = "skipped",
                        Message = skipReason
                    });
                    continue;
                }

                var command = BuildCommandFromAgentStep(step);
                var stepResponse = await DispatchAsync(command);
                step.Args = command.Params.ToDictionary(x => x.Key, x => x.Value);
                var observation = stepResponse.Result ?? stepResponse.Preview;
                execution.Steps.Add(new AssistantAgentStepExecutionDto
                {
                    StepNumber = step.StepNumber,
                    Tool = step.Tool,
                    Intent = command.Intent,
                    Purpose = step.Purpose,
                    Outcome = stepResponse.Type == "error" ? "error" : stepResponse.Type,
                    ResponseType = stepResponse.Type,
                    Message = stepResponse.Message,
                    Observation = observation
                });

                if (stepResponse.Type == "error" || stepResponse.Type == "need_more_info")
                {
                    if (stepResponse.Type == "need_more_info")
                    {
                        plan.MissingInformation = command.MissingFields.ToList();
                    }
                    execution.StopReason = stepResponse.Message;
                    execution.NextStepNumber = step.StepNumber;
                    stepResponse.Parser = plan.Planner;
                    stepResponse.Confidence = plan.Confidence;
                    stepResponse.Reason = plan.Reason;
                    stepResponse.AgentPlan = plan;
                    stepResponse.AgentExecution = execution;
                    stepResponse.Result = execution;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber, message);
                    RecordAudit("agent_step_stopped", message, command, stepResponse, stepResponse.Type, error: stepResponse.Type == "error" ? stepResponse.Message : null, resultSummary: execution);
                    return stepResponse;
                }

                if (ShouldStopAfterObservation(step, observation, plan))
                {
                    execution.StopReason = step.StopIf;
                    execution.NextStepNumber = step.StepNumber + 1;
                    var stopResponse = MessageResponse(command, stepResponse.Message, execution);
                    stopResponse.Parser = plan.Planner;
                    stopResponse.Confidence = plan.Confidence;
                    stopResponse.Reason = plan.Reason;
                    stopResponse.AgentPlan = plan;
                    stopResponse.AgentExecution = execution;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber + 1, message);
                    RecordAudit("agent_step_condition_stop", message, command, stopResponse, "stopped", resultSummary: execution);
                    return stopResponse;
                }

                if (stepResponse.Type == "confirmation_required")
                {
                    execution.WaitingForConfirmation = true;
                    execution.PendingCommandId = stepResponse.CommandId;
                    execution.StopReason = "Waiting for user confirmation before executing a write/high-risk tool.";
                    execution.NextStepNumber = step.StepNumber + 1;
                    stepResponse.Parser = plan.Planner;
                    stepResponse.Confidence = plan.Confidence;
                    stepResponse.Reason = plan.Reason;
                    stepResponse.AgentPlan = plan;
                    stepResponse.AgentExecution = execution;
                    stepResponse.Result = execution;
                    _agentStateStore.Set(userId, plan, execution, step.StepNumber + 1, message);
                    RecordAudit("agent_waiting_confirmation", message, command, stepResponse, "waiting_confirmation", stepResponse.CommandId, resultSummary: execution);
                    return stepResponse;
                }
            }

            execution.Completed = true;
            execution.NextStepNumber = plan.Steps.Count + 1;
            _agentStateStore.Set(userId, plan, execution, execution.NextStepNumber, message);
            var completedResponse = new AssistantResponseDto
            {
                Type = "success",
                Intent = "agent.completed",
                Parser = plan.Planner,
                Confidence = plan.Confidence,
                Reason = plan.Reason,
                Message = BuildAgentCompletionMessage(execution),
                AgentPlan = plan,
                AgentExecution = execution,
                Result = execution
            };
            RecordAudit("agent_completed", message, new AssistantCommandDto { Intent = "agent.completed" }, completedResponse, "completed", resultSummary: execution);
            return completedResponse;
        }

        public async Task<AssistantResponseDto> ExecuteAsync(string commandId, bool? strongConfirm = null)
        {
            if (string.IsNullOrWhiteSpace(commandId))
            {
                return HelpResponse("Không tìm thấy lệnh cần xác nhận.");
            }

            var userId = _currentUserService.UserId;
            if (!_commandStore.TryGet(commandId, userId, out var pending) || pending == null)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "command.execute",
                    Message = "Lệnh không còn hiệu lực hoặc không thuộc tài khoản hiện tại."
                };
            }

            _toolRegistry.TryGet(pending.Command.Intent, out var tool);
            ValidateUserRolePermissions(pending.Command.Intent);
            var requiresStrong = tool?.RequiresStrongConfirmation ?? false;

            if (requiresStrong && strongConfirm != true)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "command.execute",
                    Message = "Đây là hành động có rủi ro cao. Vui lòng xác nhận qua hộp kiểm để thực hiện."
                };
            }

            if (!_commandStore.TryTake(commandId, userId, out var consumed) || consumed == null)
            {
                return new AssistantResponseDto
                {
                    Type = "error",
                    Intent = "command.execute",
                    Message = "Lệnh đã được thực hiện, đã hết hạn hoặc không còn khả dụng."
                };
            }

            pending = consumed;

            try
            {
                _conversationStore.Clear(userId);
                var response = pending!.Command.Intent switch
                {
                    AssistantActionRegistry.MeterReadingCreate => await ExecuteMeterReadingCreateAsync(pending.Command),
                    AssistantActionRegistry.RoomsCreate => await ExecuteRoomCreateAsync(pending.Command),
                    AssistantActionRegistry.TenantsCreate => await ExecuteTenantCreateAsync(pending.Command),
                    AssistantActionRegistry.ContractsCreate => await ExecuteContractCreateAsync(pending.Command),
                    AssistantActionRegistry.ContractsEnd => await ExecuteContractEndAsync(pending.Command),
                    AssistantActionRegistry.InvoicesCreateMonthlyBulk => await ExecuteInvoiceMonthlyBulkCreateAsync(pending.Command),
                    AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck => await ExecuteInvoiceMonthlyBulkCreateAsync(pending.Command),
                    AssistantActionRegistry.InvoicesMarkPaid => await ExecuteInvoiceMarkPaidAsync(pending.Command),
                    AssistantActionRegistry.TransactionsCreate => await ExecuteTransactionCreateAsync(pending.Command),
                    AssistantActionRegistry.RoomsUpdate => await ExecuteRoomUpdateAsync(pending.Command),
                    AssistantActionRegistry.RoomsUpdateStatus => await ExecuteRoomStatusUpdateAsync(pending.Command),
                    AssistantActionRegistry.TenantsUpdate => await ExecuteTenantUpdateAsync(pending.Command),
                    AssistantActionRegistry.ContractsUpdate => await ExecuteContractUpdateAsync(pending.Command),
                    AssistantActionRegistry.ContractsCancel => await ExecuteContractCancelAsync(pending.Command),
                    AssistantActionRegistry.ContractsDeleteEnded => await ExecuteContractDeleteEndedAsync(pending.Command),
                    AssistantActionRegistry.MeterReadingsUpdate => await ExecuteMeterReadingUpdateAsync(pending.Command),
                    AssistantActionRegistry.MeterReadingsDelete => await ExecuteMeterReadingDeleteAsync(pending.Command),
                    AssistantActionRegistry.MeterReadingsDeleteByEndedContract => await ExecuteMeterReadingsDeleteByEndedContractAsync(pending.Command),
                    AssistantActionRegistry.InvoicesCreate => await ExecuteInvoiceCreateAsync(pending.Command),
                    AssistantActionRegistry.InvoicesMarkUnpaid => await ExecuteInvoiceMarkUnpaidAsync(pending.Command),
                    AssistantActionRegistry.InvoicesUpdateElectricity => await ExecuteInvoiceUpdateElectricityAsync(pending.Command),
                    AssistantActionRegistry.InvoicesReplace => await ExecuteInvoiceReplaceAsync(pending.Command),
                    AssistantActionRegistry.InvoicesUpdate => await ExecuteInvoiceUpdateAsync(pending.Command),
                    AssistantActionRegistry.InvoicesDelete => await ExecuteInvoiceDeleteAsync(pending.Command),
                    AssistantActionRegistry.TransactionsUpdate => await ExecuteTransactionUpdateAsync(pending.Command),
                    AssistantActionRegistry.TransactionsDelete => await ExecuteTransactionDeleteAsync(pending.Command),
                    AssistantActionRegistry.PaymentsReconcile => await ExecutePaymentReconcileAsync(pending.Command),
                    AssistantActionRegistry.PaymentsDelete => await ExecutePaymentDeleteAsync(pending.Command),
                    _ => ErrorResponse(pending.Command, "Loại lệnh này chưa được hỗ trợ để thực thi.")
                };
                UpdateAgentStateAfterCommandExecution(userId, commandId, response.Type != "error", response.Message);
                RecordAudit("execute", null, pending.Command, response, response.Type == "error" ? "error" : "executed", commandId);
                return response;
            }
            catch (Exception ex)
            {
                var response = ErrorResponse(pending.Command, ex.Message);
                UpdateAgentStateAfterCommandExecution(userId, commandId, success: false, ex.Message);
                RecordAudit("execute", null, pending.Command, response, "error", commandId, ex.Message);
                return response;
            }
        }

        private void ValidateUserRolePermissions(string intent)
        {
            var role = _currentUserService.Role;
            if (role == "SuperAdmin")
            {
                throw new InvalidOperationException("SuperAdmin has no permission to use assistant tools.");
            }

            if (role == "Tenant")
            {
                var tenantAllowedIntents = new[]
                {
                    "assistant.help",
                    "assistant.cancel",
                    "assistant.correct",
                    "assistant.clarify_intent",
                    AssistantActionRegistry.InvoicesFindAll,
                    AssistantActionRegistry.InvoicesFindUnpaid,
                    AssistantActionRegistry.InvoicesFindByRoomMonth,
                    AssistantActionRegistry.InvoicesFindByPaymentCode,
                    AssistantActionRegistry.InvoicesFindById,
                    AssistantActionRegistry.InvoicesDownloadPdf,
                    AssistantActionRegistry.MeterReadingsFind,
                    AssistantActionRegistry.MeterReadingsFindAll,
                    AssistantActionRegistry.MeterReadingsFindById
                };

                if (!tenantAllowedIntents.Contains(intent))
                {
                    throw new InvalidOperationException("Tenant has no permission to perform this action.");
                }
            }
        }

        private async Task<AssistantResponseDto> DispatchAsync(AssistantCommandDto command)
        {
            ValidateUserRolePermissions(command.Intent);
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
                    AssistantActionRegistry.MeterReadingsFind => await HandleMeterReadingAsync(command),
                    AssistantActionRegistry.MeterReadingsFindMissing => await HandleMissingMeterReadingsAsync(command),
                    AssistantActionRegistry.MeterReadingsFindAll => await HandleMeterReadingsAsync(command),
                    AssistantActionRegistry.MeterReadingsFindById => await HandleMeterReadingByIdAsync(command),
                    AssistantActionRegistry.RoomsFindAll => await HandleRoomsAsync(command, null),
                    AssistantActionRegistry.RoomsFindVacant => await HandleRoomsAsync(command, "vacant"),
                    AssistantActionRegistry.RoomsFindOccupied => await HandleRoomsAsync(command, "occupied"),
                    AssistantActionRegistry.RoomsFindByCode => await HandleRoomByCodeAsync(command),
                    AssistantActionRegistry.RoomsFindById => await HandleRoomByIdAsync(command),
                    AssistantActionRegistry.RoomsCreate => ConfirmationResponse(command, BuildRoomCreatePreview(command)),
                    AssistantActionRegistry.TenantsFindAll => await HandleTenantsAsync(command),
                    AssistantActionRegistry.TenantsFind => await HandleTenantFindAsync(command),
                    AssistantActionRegistry.TenantsCreate => ConfirmationResponse(command, BuildTenantCreatePreview(command)),
                    AssistantActionRegistry.ContractsFindAll => await HandleContractsAsync(command, null),
                    AssistantActionRegistry.ContractsFindActive => await HandleContractsAsync(command, "active"),
                    AssistantActionRegistry.ContractsFindByRoom => await HandleContractByRoomAsync(command),
                    AssistantActionRegistry.ContractsFindById => await HandleContractByIdAsync(command),
                    AssistantActionRegistry.ContractsCreate => await PreviewContractCreateAsync(command),
                    AssistantActionRegistry.ContractsEnd => await PreviewContractEndAsync(command),
                    AssistantActionRegistry.InvoicesFindAll => await HandleInvoicesAsync(command),
                    AssistantActionRegistry.InvoicesFindUnpaid => await HandleUnpaidInvoicesAsync(command),
                    AssistantActionRegistry.InvoicesFindByRoomMonth => await HandleInvoiceByRoomMonthAsync(command),
                    AssistantActionRegistry.InvoicesFindByPaymentCode => await HandleInvoiceByPaymentCodeAsync(command),
                    AssistantActionRegistry.InvoicesFindById => await HandleInvoiceByIdAsync(command),
                    AssistantActionRegistry.InvoicesCreate => await PreviewInvoiceCreateAsync(command),
                    AssistantActionRegistry.InvoicesCreateMonthlyBulk => await PreviewInvoiceMonthlyBulkCreateAsync(command),
                    AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck => await PreviewInvoiceMonthlyBulkAfterMeterCheckAsync(command),
                    AssistantActionRegistry.InvoicesMarkPaid => await PreviewInvoiceMarkPaidAsync(command),
                    AssistantActionRegistry.TransactionsFind => await HandleTransactionsAsync(command),
                    AssistantActionRegistry.TransactionsFindById => await HandleTransactionByIdAsync(command),
                    AssistantActionRegistry.TransactionsCreate => ConfirmationResponse(command, BuildTransactionCreatePreview(command)),
                    AssistantActionRegistry.RoomsUpdate => await PreviewRoomUpdateAsync(command),
                    AssistantActionRegistry.RoomsUpdateStatus => await PreviewRoomStatusUpdateAsync(command),
                    AssistantActionRegistry.TenantsUpdate => await PreviewTenantUpdateAsync(command),
                    AssistantActionRegistry.ContractsUpdate => await PreviewContractUpdateAsync(command),
                    AssistantActionRegistry.ContractsCancel => await PreviewContractCancelAsync(command),
                    AssistantActionRegistry.ContractsDeleteEnded => await PreviewContractDeleteEndedAsync(command),
                    AssistantActionRegistry.MeterReadingsUpdate => await PreviewMeterReadingUpdateAsync(command),
                    AssistantActionRegistry.MeterReadingsDelete => await PreviewMeterReadingDeleteAsync(command),
                    AssistantActionRegistry.MeterReadingsDeleteByEndedContract => await PreviewMeterReadingsDeleteByEndedContractAsync(command),
                    AssistantActionRegistry.InvoicesMarkUnpaid => await PreviewInvoiceMarkUnpaidAsync(command),
                    AssistantActionRegistry.InvoicesUpdateElectricity => await PreviewInvoiceUpdateElectricityAsync(command),
                    AssistantActionRegistry.InvoicesReplace => await PreviewInvoiceReplaceAsync(command),
                    AssistantActionRegistry.InvoicesUpdate => await PreviewInvoiceUpdateAsync(command),
                    AssistantActionRegistry.InvoicesDelete => await PreviewInvoiceDeleteAsync(command),
                    AssistantActionRegistry.InvoicesDownloadPdf => await HandleInvoicePdfAsync(command),
                    AssistantActionRegistry.TransactionsUpdate => await PreviewTransactionUpdateAsync(command),
                    AssistantActionRegistry.TransactionsDelete => await PreviewTransactionDeleteAsync(command),
                    AssistantActionRegistry.PaymentsFind => await HandlePaymentsAsync(command),
                    AssistantActionRegistry.PaymentsFindById => await HandlePaymentByIdAsync(command),
                    AssistantActionRegistry.PaymentsReconcile => await PreviewPaymentReconcileAsync(command),
                    AssistantActionRegistry.PaymentsDelete => await PreviewPaymentDeleteAsync(command),
                    AssistantActionRegistry.ReportsMonthlyRevenue => await HandleMonthlyRevenueReportAsync(command),
                    AssistantActionRegistry.ReportsMonthlyExpense => await HandleMonthlyExpenseReportAsync(command),
                    AssistantActionRegistry.ReportsMonthlyProfitLoss => await HandleMonthlyProfitLossReportAsync(command),
                    AssistantActionRegistry.ReportsPaymentStatus => await HandlePaymentStatusReportAsync(command),
                    AssistantActionRegistry.ReportsSalesLedger => await HandleSalesLedgerAsync(command),
                    AssistantActionRegistry.ReportsSalesLedgerPdf => await HandleSalesLedgerPdfAsync(command),
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

        private async Task<AssistantResponseDto> HandleMeterReadingAsync(AssistantCommandDto command)
        {
            var room = await ResolveRoomAsync(command);
            var month = ParseDate(command, "billingMonth");
            var reading = (await _meterReadingService.GetAllAsync(room.RoomId, month))
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefault();

            if (reading == null)
            {
                return MessageResponse(command, $"Phòng {room.RoomCode} chưa có chỉ số điện tháng {month:MM/yyyy}.");
            }

            return MessageResponse(
                command,
                $"Chỉ số điện phòng {reading.RoomCode} tháng {reading.BillingMonth:MM/yyyy} là {reading.CurrentReading}. Chỉ số cũ {reading.PreviousReading}, đã dùng {reading.ConsumedUnits} kWh, tiền điện {FormatMoney(reading.Amount)}.",
                reading);
        }

        private async Task<AssistantResponseDto> HandleMeterReadingsAsync(AssistantCommandDto command)
        {
            var roomId = await ResolveOptionalRoomIdAsync(command);
            var month = ParseOptionalDate(command, "billingMonth");
            var readings = await _meterReadingService.GetAllAsync(roomId, month);
            var message = readings.Count == 0
                ? "Không có chỉ số điện phù hợp."
                : $"Có {readings.Count} bản ghi chỉ số điện: {string.Join(", ", readings.Take(20).Select(x => $"{x.RoomCode} {x.BillingMonth:MM/yyyy}: {x.PreviousReading} → {x.CurrentReading}"))}.";
            return MessageResponse(command, message, readings);
        }

        private async Task<AssistantResponseDto> HandleMeterReadingByIdAsync(AssistantCommandDto command)
        {
            var reading = await ResolveMeterReadingAsync(command);
            return MessageResponse(command, $"Chỉ số điện {reading.MeterReadingId}, phòng {reading.RoomCode}, tháng {reading.BillingMonth:MM/yyyy}: {reading.PreviousReading} → {reading.CurrentReading}, tiêu thụ {reading.ConsumedUnits} kWh.", reading);
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

        private async Task<AssistantResponseDto> HandleRoomByIdAsync(AssistantCommandDto command)
        {
            var roomId = ParseInt(command, "roomId");
            var room = await _roomService.GetByIdAsync(roomId);
            return room == null
                ? ErrorResponse(command, $"Không tìm thấy phòng ID {roomId}.")
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

        private async Task<AssistantResponseDto> HandleTenantFindAsync(AssistantCommandDto command)
        {
            if (int.TryParse(Param(command, "tenantId"), out var tenantId))
            {
                var byId = await _tenantService.GetByIdAsync(tenantId);
                return byId == null
                    ? ErrorResponse(command, $"Không tìm thấy khách thuê {tenantId}.")
                    : MessageResponse(command, $"Khách {byId.FullName}, SĐT {byId.Phone ?? "chưa có"}, CCCD {byId.CCCD ?? "chưa có"}.", byId);
            }

            var query = Param(command, "phone") ?? Param(command, "cccd") ?? Require(command, "tenantName");
            var matches = AssistantTenantMatcher.FindMatches(await _tenantService.GetAllAsync(), query);
            var message = matches.Count switch
            {
                0 => $"Không tìm thấy khách thuê khớp '{query}'.",
                1 => $"Khách {matches[0].FullName}, SĐT {matches[0].Phone ?? "chưa có"}, CCCD {matches[0].CCCD ?? "chưa có"}.",
                _ => $"Có {matches.Count} khách thuê khớp '{query}': {string.Join(", ", matches.Select((x, index) => $"{index + 1}. {x.FullName} ({x.Phone ?? "chưa có SĐT"})"))}."
            };
            return MessageResponse(command, message, matches.Count == 1 ? matches[0] : matches);
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

        private async Task<AssistantResponseDto> HandleContractByIdAsync(AssistantCommandDto command)
        {
            var contractId = ParseInt(command, "contractId");
            var contract = await _contractService.GetByIdAsync(contractId);
            return contract == null
                ? ErrorResponse(command, $"Không tìm thấy hợp đồng {contractId}.")
                : MessageResponse(command, $"Hợp đồng {contract.ContractId}, phòng {contract.RoomCode}, khách {contract.TenantName}, trạng thái {contract.Status}.", contract);
        }

        private async Task<AssistantResponseDto> PreviewContractCreateAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            var room = await _roomService.GetByRoomCodeAsync(roomCode)
                ?? throw new InvalidOperationException($"Không tìm thấy phòng {roomCode}.");
            var matches = await FindContractTenantMatchesAsync(command);
            if (matches.Count > 1)
            {
                SetTenantCandidates(command, matches);
                return BuildTenantSelectionResponse(command, matches);
            }

            var tenant = matches.SingleOrDefault();
            var tenantName = tenant?.FullName ?? Require(command, "tenantName");
            var startDate = ParseDate(command, "startDate");
            var price = ParseDecimal(command, "actualRoomPrice");
            var deposit = ParseOptionalDecimal(command, "depositAmount") ?? price;
            var depositPaid = ParseOptionalDecimal(command, "depositPaidAmount") ?? deposit;
            if (depositPaid > deposit)
            {
                throw new InvalidOperationException("Tiền cọc đã nhận không được lớn hơn tiền cọc phải thu.");
            }
            var occupants = ParseInt(command, "occupantCount");
            var createTenantText = tenant == null ? $"Khách {tenantName} chưa tồn tại, mình sẽ tạo khách này trước rồi " : "Mình sẽ ";
            var depositDebt = deposit - depositPaid;
            var depositText = depositDebt > 0
                ? $"cọc phải thu {FormatMoney(deposit)}, đã nhận {FormatMoney(depositPaid)}, còn nợ cọc {FormatMoney(depositDebt)} sẽ cộng vào hóa đơn tiếp theo"
                : $"đã nhận đủ cọc {FormatMoney(deposit)}";
            var message = $"{createTenantText}tạo hợp đồng phòng {room.RoomCode} cho {tenantName}, bắt đầu {startDate:dd/MM/yyyy}, giá {FormatMoney(price)}, {depositText}, {occupants} người ở.";
            return ConfirmationResponse(command, message, new { room, tenant, tenantName, willCreateTenant = tenant == null, startDate, price, deposit, depositPaid, depositDebt, occupants });
        }

        private async Task<AssistantResponseDto> ExecuteContractCreateAsync(AssistantCommandDto command)
        {
            var (room, tenant) = await ResolveRoomAndTenantAsync(command, createTenantIfMissing: true);
            var result = await _contractService.CreateAsync(new CreateContractDto
            {
                RoomId = room.RoomId,
                TenantId = tenant.TenantId,
                StartDate = ParseDate(command, "startDate"),
                ExpectedEndDate = ParseOptionalDate(command, "expectedEndDate"),
                DepositAmount = ParseOptionalDecimal(command, "depositAmount") ?? ParseDecimal(command, "actualRoomPrice"),
                DepositPaidAmount = ParseOptionalDecimal(command, "depositPaidAmount"),
                ActualRoomPrice = ParseDecimal(command, "actualRoomPrice"),
                OccupantCount = ParseInt(command, "occupantCount")
            });
            return SuccessResponse(command, $"Đã tạo hợp đồng phòng {result.RoomCode} cho {result.TenantName}.", result);
        }

        private async Task<(RoomDto Room, TenantDto Tenant)> ResolveRoomAndTenantAsync(
            AssistantCommandDto command,
            bool createTenantIfMissing = false)
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
                var matches = AssistantTenantMatcher.FindMatches(tenants, tenantName);
                tenant = matches.Count switch
                {
                    1 => matches[0],
                    > 1 => throw new InvalidOperationException($"Có nhiều khách thuê khớp '{tenantName}'. Hãy nhập tên đầy đủ, số điện thoại, CCCD hoặc ID."),
                    _ => null
                };

                if (tenant == null && createTenantIfMissing)
                {
                    tenant = await _tenantService.CreateAsync(new CreateTenantDto
                    {
                        FullName = AssistantTenantMatcher.CleanReference(tenantName),
                        Phone = Param(command, "phone"),
                        CCCD = Param(command, "cccd")
                    });
                }
            }

            return tenant == null
                ? throw new InvalidOperationException("Không tìm thấy khách thuê khớp tên/ID. Hãy tạo khách thuê trước hoặc nhập đúng tên.")
                : (room, tenant);
        }

        private async Task<IReadOnlyList<TenantDto>> FindContractTenantMatchesAsync(AssistantCommandDto command)
        {
            if (int.TryParse(Param(command, "tenantId"), out var tenantId))
            {
                var tenant = await _tenantService.GetByIdAsync(tenantId);
                return tenant == null ? Array.Empty<TenantDto>() : new[] { tenant };
            }

            return AssistantTenantMatcher.FindMatches(
                await _tenantService.GetAllAsync(),
                Require(command, "tenantName"));
        }

        private static void SetTenantCandidates(AssistantCommandDto command, IReadOnlyList<TenantDto> matches)
        {
            command.Params[TenantCandidateIdsParam] = string.Join(',', matches.Select(x => x.TenantId));
            if (!command.MissingFields.Contains(TenantSelectionField))
            {
                command.MissingFields.Add(TenantSelectionField);
            }
        }

        private static bool HasPendingTenantSelection(AssistantCommandDto command)
        {
            return command.Params.TryGetValue(TenantCandidateIdsParam, out var ids)
                && !string.IsNullOrWhiteSpace(ids);
        }

        private static bool TryApplyTenantSelection(AssistantCommandDto command, string message)
        {
            if (!command.Params.TryGetValue(TenantCandidateIdsParam, out var rawIds)
                || string.IsNullOrWhiteSpace(rawIds))
            {
                return false;
            }

            var ids = rawIds.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(x => int.TryParse(x, out var id) ? id : 0)
                .Where(x => x > 0)
                .ToList();
            var match = Regex.Match(message, @"^\s*(\d+)\b");
            if (!match.Success
                || !int.TryParse(match.Groups[1].Value, out var option)
                || option < 1
                || option > ids.Count)
            {
                return false;
            }

            command.Params["tenantId"] = ids[option - 1].ToString(CultureInfo.InvariantCulture);
            command.Params.Remove(TenantCandidateIdsParam);
            command.MissingFields.RemoveAll(x => x == TenantSelectionField);
            return true;
        }

        private async Task<AssistantResponseDto> BuildTenantSelectionResponseAsync(AssistantCommandDto command)
        {
            var ids = (Param(command, TenantCandidateIdsParam) ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(x => int.TryParse(x, out var id) ? id : 0)
                .Where(x => x > 0)
                .ToHashSet();
            var tenants = (await _tenantService.GetAllAsync()).Where(x => ids.Contains(x.TenantId)).ToList();
            return BuildTenantSelectionResponse(command, tenants);
        }

        private static AssistantResponseDto BuildTenantSelectionResponse(
            AssistantCommandDto command,
            IReadOnlyList<TenantDto> tenants)
        {
            var response = NeedMoreInfo(
                command,
                $"Có {tenants.Count} khách thuê cùng khớp '{Param(command, "tenantName")}'. Bạn chọn một người bên dưới:");
            response.Suggestions = tenants.Select((tenant, index) =>
                $"{index + 1}. {tenant.FullName}{(string.IsNullOrWhiteSpace(tenant.Phone) ? string.Empty : $" - {tenant.Phone}")}").ToList();
            return response;
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

        private async Task<AssistantResponseDto> HandleInvoiceByPaymentCodeAsync(AssistantCommandDto command)
        {
            var paymentCode = Require(command, "paymentCode");
            var invoice = await _invoiceService.GetByPaymentCodeAsync(paymentCode);
            return invoice == null
                ? ErrorResponse(command, $"Không tìm thấy hóa đơn có mã thanh toán {paymentCode}.")
                : MessageResponse(command, $"Hóa đơn {invoice.InvoiceId} phòng {invoice.RoomCode}: {FormatMoney(invoice.TotalAmount)}, trạng thái {invoice.Status}.", invoice);
        }

        private async Task<AssistantResponseDto> HandleInvoiceByIdAsync(AssistantCommandDto command)
        {
            var invoiceId = ParseInt(command, "invoiceId");
            var invoice = await _invoiceService.GetByIdAsync(invoiceId);
            return invoice == null
                ? ErrorResponse(command, $"Không tìm thấy hóa đơn {invoiceId}.")
                : MessageResponse(command, $"Hóa đơn {invoice.InvoiceId} phòng {invoice.RoomCode}: {FormatMoney(invoice.TotalAmount)}, trạng thái {invoice.Status}.", invoice);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceCreateAsync(AssistantCommandDto command)
        {
            var payload = await BuildSingleInvoicePayloadAsync(command);
            var preview = await _invoiceService.PreviewAsync(payload);
            var room = await _roomService.GetByIdAsync(payload.RoomId);
            return ConfirmationResponse(
                command,
                $"Mình sẽ tạo hóa đơn phòng {room?.RoomCode} tháng {payload.BillingMonth:MM/yyyy}, tổng dự kiến {FormatMoney(preview.TotalAmount)}.",
                preview);
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceCreateAsync(AssistantCommandDto command)
        {
            var payload = await BuildSingleInvoicePayloadAsync(command);
            var result = await _invoiceService.CreateAsync(payload);
            return SuccessResponse(command, $"Đã tạo hóa đơn {result.InvoiceId} phòng {result.RoomCode} tháng {result.BillingMonth:MM/yyyy}.", result);
        }

        private async Task<CreateInvoiceDto> BuildSingleInvoicePayloadAsync(AssistantCommandDto command)
        {
            var room = await ResolveRoomAsync(command);
            var contract = await _contractService.GetActiveByRoomCodeAsync(room.RoomCode)
                ?? throw new InvalidOperationException($"Phòng {room.RoomCode} chưa có hợp đồng đang hiệu lực.");
            return new CreateInvoiceDto
            {
                RoomId = room.RoomId,
                ContractId = contract.ContractId,
                BillingMonth = ParseDate(command, "billingMonth"),
                DiscountAmount = ParseOptionalDecimal(command, "discountAmount") ?? 0,
                DebtAmount = ParseOptionalDecimal(command, "debtAmount") ?? 0
            };
        }

        private async Task<AssistantResponseDto> PreviewInvoiceMonthlyBulkCreateAsync(AssistantCommandDto command)
        {
            var payload = BuildInvoiceBulkPayload(command);
            var preview = await _invoiceService.MonthlyBulkPreviewAsync(payload);
            var total = preview.Sum(x => x.TotalAmount);
            return ConfirmationResponse(command, $"Mình sẽ tạo {preview.Count} hóa đơn tháng {payload.BillingMonth:MM/yyyy}, tổng dự kiến {FormatMoney(total)}.", preview);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceMonthlyBulkAfterMeterCheckAsync(AssistantCommandDto command)
        {
            var month = ParseDate(command, "billingMonth");
            var missingReadings = await _meterReadingService.GetMissingAsync(month);
            if (missingReadings.Count > 0)
            {
                var roomCodes = string.Join(", ", missingReadings.Select(x => x.RoomCode));
                return MessageResponse(
                    command,
                    $"Mình đã kiểm tra trước khi tạo hóa đơn tháng {month:MM/yyyy}. Còn {missingReadings.Count} phòng chưa nhập số điện: {roomCodes}. Mình chưa tạo hóa đơn, bạn nhập đủ số điện rồi gọi lại nhé.",
                    new
                    {
                        steps = new[]
                        {
                            "checked_missing_meter_readings",
                            "stopped_before_invoice_preview"
                        },
                        missingReadings
                    });
            }

            var payload = BuildInvoiceBulkPayload(command);
            var preview = await _invoiceService.MonthlyBulkPreviewAsync(payload);
            var total = preview.Sum(x => x.TotalAmount);
            return ConfirmationResponse(
                command,
                $"Mình đã kiểm tra: tất cả phòng đang thuê đã có số điện tháng {month:MM/yyyy}. Mình sẽ tạo {preview.Count} hóa đơn, tổng dự kiến {FormatMoney(total)}.",
                new
                {
                    steps = new[]
                    {
                        "checked_missing_meter_readings",
                        "prepared_invoice_preview"
                    },
                    preview
                });
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
            var invoice = await ResolveInvoiceAsync(command);
            var amount = ParseOptionalDecimal(command, "amount") ?? invoice.TotalAmount;
            return ConfirmationResponse(command, $"Mình sẽ đánh dấu hóa đơn {invoice.InvoiceId} phòng {invoice.RoomCode} đã thanh toán {FormatMoney(amount)}.", new { invoice, amount });
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceMarkPaidAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            var result = await _invoiceService.MarkPaidAsync(invoice.InvoiceId, new MarkInvoicePaidDto
            {
                Amount = ParseOptionalDecimal(command, "amount") ?? invoice.TotalAmount,
                PaymentMethod = Param(command, "paymentMethod"),
                PaymentReference = Param(command, "paymentReference"),
                Note = Param(command, "note")
            });
            return result == null
                ? ErrorResponse(command, $"Không tìm thấy hóa đơn {invoice.InvoiceId}.")
                : SuccessResponse(command, $"Đã ghi nhận thanh toán hóa đơn {invoice.InvoiceId}.", result);
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

        private async Task<AssistantResponseDto> HandleTransactionByIdAsync(AssistantCommandDto command)
        {
            var transaction = await ResolveTransactionAsync(command);
            return MessageResponse(
                command,
                $"Giao dịch {transaction.TransactionId}: {transaction.TransactionDirection} {FormatMoney(transaction.Amount)}, ngày {transaction.TransactionDate:dd/MM/yyyy}, {transaction.ItemName}.",
                transaction);
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

        private async Task<AssistantResponseDto> HandleSalesLedgerAsync(AssistantCommandDto command)
        {
            var fromMonth = ParseDate(command, "fromMonth");
            var toMonth = ParseDate(command, "toMonth");
            var ledger = await _reportService.GetSalesLedgerAsync(fromMonth, toMonth);
            return MessageResponse(command, $"Sổ doanh thu từ {fromMonth:MM/yyyy} đến {toMonth:MM/yyyy} có {ledger.Rows.Count} dòng, tổng {FormatMoney(ledger.TotalAmount)}.", ledger);
        }

        private Task<AssistantResponseDto> HandleSalesLedgerPdfAsync(AssistantCommandDto command)
        {
            var fromMonth = ParseDate(command, "fromMonth");
            var toMonth = ParseDate(command, "toMonth");
            var query = new List<string>
            {
                $"fromMonth={Uri.EscapeDataString(fromMonth.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))}",
                $"toMonth={Uri.EscapeDataString(toMonth.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))}"
            };
            AddQueryValue(query, "businessOwnerName", Param(command, "businessOwnerName"));
            AddQueryValue(query, "address", Param(command, "address"));
            AddQueryValue(query, "taxCode", Param(command, "taxCode"));
            AddQueryValue(query, "businessLocation", Param(command, "businessLocation"));
            var url = $"/api/Reports/sales-ledger/pdf?{string.Join("&", query)}";
            return Task.FromResult(MessageResponse(command, $"Bạn có thể tải PDF sổ doanh thu từ {fromMonth:MM/yyyy} đến {toMonth:MM/yyyy}.", new { reportType = "salesLedger", fromMonth, toMonth, downloadUrl = url }));
        }

        private static void AddQueryValue(List<string> query, string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                query.Add($"{name}={Uri.EscapeDataString(value)}");
            }
        }

        private async Task<AssistantResponseDto> PreviewRoomUpdateAsync(AssistantCommandDto command)
        {
            var room = await ResolveRoomAsync(command);
            var price = ParseDecimal(command, "listedPrice");
            return ConfirmationResponse(command, $"Mình sẽ đổi giá phòng {room.RoomCode} từ {FormatMoney(room.ListedPrice)} thành {FormatMoney(price)}.", new { room, listedPrice = price });
        }

        private async Task<AssistantResponseDto> ExecuteRoomUpdateAsync(AssistantCommandDto command)
        {
            var room = await ResolveRoomAsync(command);
            var result = await _roomService.UpdateAsync(room.RoomId, new UpdateRoomDto
            {
                RoomCode = room.RoomCode,
                ListedPrice = ParseDecimal(command, "listedPrice"),
                Status = room.Status
            });
            return result == null ? ErrorResponse(command, "Không tìm thấy phòng cần cập nhật.") : SuccessResponse(command, $"Đã cập nhật phòng {result.RoomCode}.", result);
        }

        private async Task<AssistantResponseDto> PreviewRoomStatusUpdateAsync(AssistantCommandDto command)
        {
            var room = await ResolveRoomAsync(command);
            var status = Require(command, "roomStatus");
            return ConfirmationResponse(command, $"Mình sẽ đổi trạng thái phòng {room.RoomCode} từ {room.Status} thành {status}.", new { room, status });
        }

        private async Task<AssistantResponseDto> ExecuteRoomStatusUpdateAsync(AssistantCommandDto command)
        {
            var room = await ResolveRoomAsync(command);
            var result = await _roomService.UpdateStatusAsync(room.RoomId, new UpdateRoomStatusDto { Status = Require(command, "roomStatus") });
            return result == null ? ErrorResponse(command, "Không tìm thấy phòng cần cập nhật.") : SuccessResponse(command, $"Đã cập nhật trạng thái phòng {result.RoomCode} thành {result.Status}.", result);
        }

        private async Task<AssistantResponseDto> PreviewTenantUpdateAsync(AssistantCommandDto command)
        {
            var tenant = await ResolveTenantAsync(command);
            EnsureAnyParam(command, "phone", "cccd");
            return ConfirmationResponse(command, $"Mình sẽ cập nhật thông tin khách {tenant.FullName}.", new { tenant, phone = Param(command, "phone"), cccd = Param(command, "cccd") });
        }

        private async Task<AssistantResponseDto> ExecuteTenantUpdateAsync(AssistantCommandDto command)
        {
            var tenant = await ResolveTenantAsync(command);
            EnsureAnyParam(command, "phone", "cccd");
            var result = await _tenantService.UpdateAsync(tenant.TenantId, new UpdateTenantDto
            {
                FullName = tenant.FullName,
                Phone = Param(command, "phone") ?? tenant.Phone,
                CCCD = Param(command, "cccd") ?? tenant.CCCD
            });
            return result == null ? ErrorResponse(command, "Không tìm thấy khách thuê cần cập nhật.") : SuccessResponse(command, $"Đã cập nhật khách {result.FullName}.", result);
        }

        private async Task<AssistantResponseDto> PreviewContractUpdateAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: true);
            EnsureAnyParam(command, "startDate", "expectedEndDate", "depositAmount", "depositPaidAmount", "occupantCount", "actualRoomPrice");
            return ConfirmationResponse(command, $"Mình sẽ cập nhật hợp đồng phòng {contract.RoomCode}.", new { contract, changes = NonEmptyParams(command) });
        }

        private async Task<AssistantResponseDto> ExecuteContractUpdateAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: true);
            EnsureAnyParam(command, "startDate", "expectedEndDate", "depositAmount", "depositPaidAmount", "occupantCount", "actualRoomPrice");
            var result = await _contractService.UpdateAsync(contract.ContractId, new UpdateContractDto
            {
                StartDate = ParseOptionalDate(command, "startDate") ?? contract.StartDate,
                ExpectedEndDate = ParseOptionalDate(command, "expectedEndDate") ?? contract.ExpectedEndDate,
                DepositAmount = ParseOptionalDecimal(command, "depositAmount") ?? contract.DepositAmount,
                DepositPaidAmount = ParseOptionalDecimal(command, "depositPaidAmount") ?? contract.DepositPaidAmount,
                OccupantCount = ParseOptionalInt(command, "occupantCount") ?? contract.OccupantCount,
                ActualRoomPrice = ParseOptionalDecimal(command, "actualRoomPrice") ?? contract.ActualRoomPrice
            });
            return result == null ? ErrorResponse(command, "Không tìm thấy hợp đồng cần cập nhật.") : SuccessResponse(command, $"Đã cập nhật hợp đồng phòng {result.RoomCode}.", result);
        }

        private async Task<AssistantResponseDto> PreviewContractCancelAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: true);
            return ConfirmationResponse(command, $"Mình sẽ hủy hợp đồng phòng {contract.RoomCode}. Lý do: {Param(command, "note") ?? "không ghi"}.", contract);
        }

        private async Task<AssistantResponseDto> ExecuteContractCancelAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: true);
            var result = await _contractService.CancelAsync(contract.ContractId, new CancelContractDto { Reason = Param(command, "note") });
            return result == null ? ErrorResponse(command, "Không thể hủy hợp đồng.") : SuccessResponse(command, $"Đã hủy hợp đồng phòng {result.RoomCode}.", result);
        }

        private async Task<AssistantResponseDto> PreviewContractDeleteEndedAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: false);
            if (!IsEndedContract(contract)) throw new InvalidOperationException("Chỉ được xóa hợp đồng đã kết thúc/hủy.");
            return ConfirmationResponse(command, $"Mình sẽ xóa vĩnh viễn hợp đồng {contract.ContractId} của phòng {contract.RoomCode}.", contract);
        }

        private async Task<AssistantResponseDto> ExecuteContractDeleteEndedAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: false);
            if (!IsEndedContract(contract)) throw new InvalidOperationException("Chỉ được xóa hợp đồng đã kết thúc/hủy.");
            var deleted = await _contractService.DeleteEndedAsync(contract.ContractId);
            return deleted ? SuccessResponse(command, $"Đã xóa hợp đồng {contract.ContractId}.") : ErrorResponse(command, "Không thể xóa hợp đồng.");
        }

        private async Task<AssistantResponseDto> PreviewMeterReadingUpdateAsync(AssistantCommandDto command)
        {
            var reading = await ResolveMeterReadingAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ sửa chỉ số điện phòng {reading.RoomCode} tháng {reading.BillingMonth:MM/yyyy} từ {reading.CurrentReading} thành {Require(command, "currentReading")}.", reading);
        }

        private async Task<AssistantResponseDto> ExecuteMeterReadingUpdateAsync(AssistantCommandDto command)
        {
            var reading = await ResolveMeterReadingAsync(command);
            var result = await _meterReadingService.UpdateOriginalReadingAsync(new UpdateOriginalMeterReadingDto
            {
                MeterReadingId = reading.MeterReadingId,
                RoomCode = reading.RoomCode,
                BillingMonth = reading.BillingMonth,
                CurrentReading = ParseInt(command, "currentReading")
            });
            return SuccessResponse(command, $"Đã cập nhật chỉ số điện phòng {reading.RoomCode}.", result);
        }

        private async Task<AssistantResponseDto> PreviewMeterReadingDeleteAsync(AssistantCommandDto command)
        {
            var reading = await ResolveMeterReadingAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ xóa chỉ số điện phòng {reading.RoomCode} tháng {reading.BillingMonth:MM/yyyy}.", reading);
        }

        private async Task<AssistantResponseDto> ExecuteMeterReadingDeleteAsync(AssistantCommandDto command)
        {
            var reading = await ResolveMeterReadingAsync(command);
            var deleted = await _meterReadingService.DeleteAsync(reading.MeterReadingId);
            return deleted ? SuccessResponse(command, $"Đã xóa chỉ số điện phòng {reading.RoomCode}.") : ErrorResponse(command, "Không thể xóa chỉ số điện.");
        }

        private async Task<AssistantResponseDto> PreviewMeterReadingsDeleteByEndedContractAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: false);
            var readings = await _meterReadingService.GetAllAsync(contract.RoomId, null);
            var count = readings.Count(x => x.ContractId == contract.ContractId);
            return ConfirmationResponse(command, $"Mình sẽ xóa {count} bản ghi chỉ số điện của hợp đồng {contract.ContractId} phòng {contract.RoomCode}. Hành động này không thể hoàn tác.", new { contract, readingCount = count });
        }

        private async Task<AssistantResponseDto> ExecuteMeterReadingsDeleteByEndedContractAsync(AssistantCommandDto command)
        {
            var contract = await ResolveContractAsync(command, requireActive: false);
            var result = await _meterReadingService.DeleteByEndedContractAsync(contract.ContractId);
            return result == null
                ? ErrorResponse(command, "Không tìm thấy hợp đồng cần xóa chỉ số.")
                : SuccessResponse(command, $"Đã xóa {result.DeletedCount} bản ghi chỉ số của hợp đồng {result.ContractId} phòng {result.RoomCode}.", result);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceMarkUnpaidAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ chuyển hóa đơn {invoice.InvoiceId} về chưa thanh toán.", invoice);
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceMarkUnpaidAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            var result = await _invoiceService.MarkUnpaidAsync(invoice.InvoiceId);
            return result == null ? ErrorResponse(command, "Không thể chuyển hóa đơn về chưa thanh toán.") : SuccessResponse(command, $"Đã chuyển hóa đơn {result.InvoiceId} về chưa thanh toán.", result);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceUpdateElectricityAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ đổi tiền điện hóa đơn {invoice.InvoiceId} từ {FormatMoney(invoice.ElectricityFee)} thành {FormatMoney(ParseDecimal(command, "electricityFee"))}.", invoice);
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceUpdateElectricityAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            var result = await _invoiceService.UpdateElectricityAsync(new UpdateInvoiceElectricityDto
            {
                RoomCode = invoice.RoomCode ?? Require(command, "roomCode"),
                BillingMonth = invoice.BillingMonth ?? ParseDate(command, "billingMonth"),
                ElectricityFee = ParseDecimal(command, "electricityFee"),
                Note = Param(command, "note")
            });
            return result == null ? ErrorResponse(command, "Không thể cập nhật tiền điện hóa đơn.") : SuccessResponse(command, $"Đã cập nhật tiền điện hóa đơn {result.InvoiceId}.", result);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceReplaceAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ thay thế hóa đơn {invoice.InvoiceId} của phòng {invoice.RoomCode}.", new { invoice, changes = NonEmptyParams(command) });
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceReplaceAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            var result = await _invoiceService.ReplaceAsync(invoice.InvoiceId, new InvoiceReplaceDto
            {
                RoomFee = ParseOptionalDecimal(command, "roomFee") ?? invoice.RoomFee,
                ElectricityFee = ParseOptionalDecimal(command, "electricityFee") ?? invoice.ElectricityFee,
                WaterFee = ParseOptionalDecimal(command, "waterFee") ?? invoice.WaterFee,
                TrashFee = ParseOptionalDecimal(command, "trashFee") ?? invoice.TrashFee,
                DiscountAmount = ParseOptionalDecimal(command, "discountAmount") ?? invoice.DiscountAmount,
                DebtAmount = ParseOptionalDecimal(command, "debtAmount") ?? invoice.DebtAmount,
                Note = Param(command, "note") ?? invoice.Note
            });
            return result == null ? ErrorResponse(command, "Không thể thay thế hóa đơn.") : SuccessResponse(command, $"Đã tạo hóa đơn thay thế {result.InvoiceId}.", result);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceUpdateAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            EnsureAnyParam(command, "roomFee", "electricityFee", "waterFee", "trashFee", "discountAmount", "debtAmount", "note");
            return ConfirmationResponse(command, $"Mình sẽ cập nhật hóa đơn {invoice.InvoiceId}.", new { invoice, changes = NonEmptyParams(command) });
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceUpdateAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            EnsureAnyParam(command, "roomFee", "electricityFee", "waterFee", "trashFee", "discountAmount", "debtAmount", "note");
            var result = await _invoiceService.UpdateAsync(invoice.InvoiceId, new UpdateInvoiceDto
            {
                RoomFee = ParseOptionalDecimal(command, "roomFee"),
                ElectricityFee = ParseOptionalDecimal(command, "electricityFee"),
                WaterFee = ParseOptionalDecimal(command, "waterFee"),
                TrashFee = ParseOptionalDecimal(command, "trashFee"),
                DiscountAmount = ParseOptionalDecimal(command, "discountAmount"),
                DebtAmount = ParseOptionalDecimal(command, "debtAmount"),
                Note = Param(command, "note")
            });
            return result == null ? ErrorResponse(command, "Không thể cập nhật hóa đơn.") : SuccessResponse(command, $"Đã cập nhật hóa đơn {result.InvoiceId}.", result);
        }

        private async Task<AssistantResponseDto> PreviewInvoiceDeleteAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ xóa vĩnh viễn hóa đơn {invoice.InvoiceId} phòng {invoice.RoomCode}.", invoice);
        }

        private async Task<AssistantResponseDto> ExecuteInvoiceDeleteAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            var deleted = await _invoiceService.DeleteAsync(invoice.InvoiceId);
            return deleted ? SuccessResponse(command, $"Đã xóa hóa đơn {invoice.InvoiceId}.") : ErrorResponse(command, "Không thể xóa hóa đơn.");
        }

        private async Task<AssistantResponseDto> HandleInvoicePdfAsync(AssistantCommandDto command)
        {
            var invoice = await ResolveInvoiceAsync(command);
            var url = $"/api/Invoices/{invoice.InvoiceId}/pdf";
            return MessageResponse(command, $"Bạn có thể tải PDF hóa đơn {invoice.InvoiceId} tại {url}.", new { invoice.InvoiceId, invoice.RoomCode, downloadUrl = url });
        }

        private async Task<AssistantResponseDto> PreviewTransactionUpdateAsync(AssistantCommandDto command)
        {
            var transaction = await ResolveTransactionAsync(command);
            EnsureAnyParam(command, "transactionDirection", "category", "itemName", "amount", "transactionDate", "description", "roomCode");
            return ConfirmationResponse(command, $"Mình sẽ cập nhật giao dịch {transaction.TransactionId}.", new { transaction, changes = NonEmptyParams(command) });
        }

        private async Task<AssistantResponseDto> ExecuteTransactionUpdateAsync(AssistantCommandDto command)
        {
            var transaction = await ResolveTransactionAsync(command);
            var roomId = transaction.RelatedRoomId;
            if (!string.IsNullOrWhiteSpace(Param(command, "roomCode"))) roomId = (await ResolveRoomAsync(command)).RoomId;
            var result = await _transactionService.UpdateAsync(transaction.TransactionId, new UpdateTransactionDto
            {
                TransactionDirection = Param(command, "transactionDirection") ?? transaction.TransactionDirection,
                Category = Param(command, "category") ?? transaction.Category,
                ItemName = Param(command, "itemName") ?? transaction.ItemName,
                Amount = ParseOptionalDecimal(command, "amount") ?? transaction.Amount,
                TransactionDate = ParseOptionalDate(command, "transactionDate") ?? transaction.TransactionDate,
                Description = Param(command, "description") ?? transaction.Description,
                RelatedRoomId = roomId
            });
            return result == null ? ErrorResponse(command, "Không thể cập nhật giao dịch.") : SuccessResponse(command, $"Đã cập nhật giao dịch {result.TransactionId}.", result);
        }

        private async Task<AssistantResponseDto> PreviewTransactionDeleteAsync(AssistantCommandDto command)
        {
            var transaction = await ResolveTransactionAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ xóa giao dịch {transaction.TransactionId}, số tiền {FormatMoney(transaction.Amount)}.", transaction);
        }

        private async Task<AssistantResponseDto> ExecuteTransactionDeleteAsync(AssistantCommandDto command)
        {
            var transaction = await ResolveTransactionAsync(command);
            var deleted = await _transactionService.DeleteAsync(transaction.TransactionId);
            return deleted ? SuccessResponse(command, $"Đã xóa giao dịch {transaction.TransactionId}.") : ErrorResponse(command, "Không thể xóa giao dịch.");
        }

        private async Task<AssistantResponseDto> HandlePaymentsAsync(AssistantCommandDto command)
        {
            var items = await _paymentService.GetAllAsync(Param(command, "processStatus"));
            var message = items.Count == 0 ? "Không có giao dịch ngân hàng phù hợp." : $"Có {items.Count} giao dịch ngân hàng: {string.Join(", ", items.Take(10).Select(x => $"#{x.PaymentTransactionId} {FormatMoney(x.TransferAmount ?? 0)} ({x.ProcessStatus})"))}.";
            return MessageResponse(command, message, items);
        }

        private async Task<AssistantResponseDto> HandlePaymentByIdAsync(AssistantCommandDto command)
        {
            var payment = await ResolvePaymentAsync(command);
            return MessageResponse(command, $"Chuyển khoản #{payment.PaymentTransactionId}: {FormatMoney(payment.TransferAmount ?? 0)}, trạng thái {payment.ProcessStatus}, mã thanh toán {payment.PaymentCode ?? "không có"}.", payment);
        }

        private async Task<AssistantResponseDto> PreviewPaymentReconcileAsync(AssistantCommandDto command)
        {
            var payment = await ResolvePaymentAsync(command);
            var invoice = await ResolveInvoiceAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ đối soát giao dịch ngân hàng {payment.PaymentTransactionId} với hóa đơn {invoice.InvoiceId}.", new { payment, invoice });
        }

        private async Task<AssistantResponseDto> ExecutePaymentReconcileAsync(AssistantCommandDto command)
        {
            var payment = await ResolvePaymentAsync(command);
            var invoice = await ResolveInvoiceAsync(command);
            var result = await _paymentService.ReconcileAsync(payment.PaymentTransactionId, new ReconcilePaymentDto { InvoiceId = invoice.InvoiceId });
            return result == null ? ErrorResponse(command, "Không thể đối soát giao dịch.") : SuccessResponse(command, $"Đã đối soát giao dịch {result.PaymentTransactionId}.", result);
        }

        private async Task<AssistantResponseDto> PreviewPaymentDeleteAsync(AssistantCommandDto command)
        {
            var payment = await ResolvePaymentAsync(command);
            return ConfirmationResponse(command, $"Mình sẽ xóa giao dịch ngân hàng {payment.PaymentTransactionId}.", payment);
        }

        private async Task<AssistantResponseDto> ExecutePaymentDeleteAsync(AssistantCommandDto command)
        {
            var payment = await ResolvePaymentAsync(command);
            var deleted = await _paymentService.DeleteAsync(payment.PaymentTransactionId);
            return deleted ? SuccessResponse(command, $"Đã xóa giao dịch ngân hàng {payment.PaymentTransactionId}.") : ErrorResponse(command, "Không thể xóa giao dịch ngân hàng.");
        }

        private async Task<RoomDto> ResolveRoomAsync(AssistantCommandDto command)
        {
            var roomCode = Require(command, "roomCode");
            return await _roomService.GetByRoomCodeAsync(roomCode) ?? throw new InvalidOperationException($"Không tìm thấy phòng {roomCode}.");
        }

        private async Task<TenantDto> ResolveTenantAsync(AssistantCommandDto command)
        {
            if (int.TryParse(Param(command, "tenantId"), out var tenantId))
                return await _tenantService.GetByIdAsync(tenantId) ?? throw new InvalidOperationException($"Không tìm thấy khách thuê {tenantId}.");
            var name = Require(command, "tenantName");
            var matches = AssistantTenantMatcher.FindMatches(await _tenantService.GetAllAsync(), name);
            return matches.Count == 1 ? matches[0] : throw new InvalidOperationException(matches.Count == 0 ? $"Không tìm thấy khách {name}." : $"Có nhiều khách khớp {name}, hãy nhập tên đầy đủ hoặc ID.");
        }

        private async Task<ContractDto> ResolveContractAsync(AssistantCommandDto command, bool requireActive)
        {
            if (int.TryParse(Param(command, "contractId"), out var id))
                return await _contractService.GetByIdAsync(id) ?? throw new InvalidOperationException($"Không tìm thấy hợp đồng {id}.");
            var roomCode = Require(command, "roomCode");
            if (requireActive) return await _contractService.GetActiveByRoomCodeAsync(roomCode) ?? throw new InvalidOperationException($"Phòng {roomCode} không có hợp đồng hiệu lực.");
            var room = await ResolveRoomAsync(command);
            return (await _contractService.GetAllAsync(null, room.RoomId, includeArchived: true))
                .OrderByDescending(x => x.ActualEndDate ?? DateOnly.FromDateTime(x.UpdatedAt))
                .FirstOrDefault()
                ?? throw new InvalidOperationException($"Không tìm thấy hợp đồng phòng {roomCode}.");
        }

        private async Task<MeterReadingDto> ResolveMeterReadingAsync(AssistantCommandDto command)
        {
            if (int.TryParse(Param(command, "meterReadingId"), out var id))
                return (await _meterReadingService.GetAllAsync()).FirstOrDefault(x => x.MeterReadingId == id) ?? throw new InvalidOperationException($"Không tìm thấy chỉ số điện {id}.");
            var room = await ResolveRoomAsync(command);
            var month = ParseDate(command, "billingMonth");
            return (await _meterReadingService.GetAllAsync(room.RoomId, month)).SingleOrDefault() ?? throw new InvalidOperationException($"Không tìm thấy chỉ số điện phòng {room.RoomCode} tháng {month:MM/yyyy}.");
        }

        private async Task<InvoiceDto> ResolveInvoiceAsync(AssistantCommandDto command)
        {
            if (int.TryParse(Param(command, "invoiceId"), out var id))
                return await _invoiceService.GetByIdAsync(id) ?? throw new InvalidOperationException($"Không tìm thấy hóa đơn {id}.");
            var room = await ResolveRoomAsync(command);
            var month = ParseDate(command, "billingMonth");
            return await _invoiceService.GetByRoomAndMonthAsync(room.RoomId, month) ?? throw new InvalidOperationException($"Không tìm thấy hóa đơn phòng {room.RoomCode} tháng {month:MM/yyyy}.");
        }

        private async Task<TransactionDto> ResolveTransactionAsync(AssistantCommandDto command)
        {
            var id = ParseInt(command, "transactionId");
            return await _transactionService.GetByIdAsync(id) ?? throw new InvalidOperationException($"Không tìm thấy giao dịch {id}.");
        }

        private async Task<PaymentTransactionDto> ResolvePaymentAsync(AssistantCommandDto command)
        {
            var id = ParseInt(command, "paymentTransactionId");
            return await _paymentService.GetByIdAsync(id) ?? throw new InvalidOperationException($"Không tìm thấy giao dịch ngân hàng {id}.");
        }

        private static bool IsEndedContract(ContractDto contract) => contract.IsArchived || contract.ActualEndDate.HasValue || contract.Status is "ended" or "cancelled";

        private static void EnsureAnyParam(AssistantCommandDto command, params string[] names)
        {
            if (!names.Any(x => !string.IsNullOrWhiteSpace(Param(command, x))))
                throw new InvalidOperationException($"Bạn cần cung cấp ít nhất một giá trị: {string.Join(", ", names)}.");
        }

        private static Dictionary<string, string?> NonEmptyParams(AssistantCommandDto command) => command.Params.Where(x => !string.IsNullOrWhiteSpace(x.Value)).ToDictionary(x => x.Key, x => x.Value);

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

        private AssistantCommandDto BuildCommandFromAgentStep(AssistantAgentPlanStepDto step)
        {
            var command = new AssistantCommandDto
            {
                Intent = string.IsNullOrWhiteSpace(step.Intent) ? step.Tool : step.Intent,
                Params = step.Args.ToDictionary(x => x.Key, x => x.Value),
                RequiresConfirmation = step.RequiresConfirmation,
                Confidence = 1,
                Reason = $"Agent step {step.StepNumber}: {step.Purpose}"
            };

            return _commandParser.Normalize(command);
        }

        private static bool ShouldRunAgentStep(
            AssistantAgentPlanStepDto step,
            AssistantAgentExecutionDto execution,
            out string reason)
        {
            reason = string.Empty;
            var completedSteps = execution.Steps
                .Where(x => x.Outcome is not "error" and not "need_more_info")
                .GroupBy(x => x.StepNumber)
                .ToDictionary(x => x.Key, x => x.Last());

            var missingDependencies = step.DependsOn
                .Where(x => !completedSteps.ContainsKey(x))
                .ToList();
            if (missingDependencies.Count > 0)
            {
                reason = $"Skipped because dependencies were not completed: {string.Join(", ", missingDependencies)}.";
                return false;
            }

            var condition = NormalizeText(step.Condition ?? string.Empty);
            if (string.IsNullOrWhiteSpace(condition) || condition is "always" or "luon luon")
            {
                return true;
            }

            var sourceStep = step.DependsOn
                .Select(x => completedSteps.GetValueOrDefault(x))
                .LastOrDefault(x => x != null)
                ?? execution.Steps.LastOrDefault();
            var observationCount = sourceStep?.Observation == null ? 0 : GetObservationCount(sourceStep.Observation);

            if (condition.Contains("no missing")
                || condition.Contains("zero missing")
                || condition.Contains("khong thieu")
                || condition.Contains("khong co phong thieu"))
            {
                var shouldRun = observationCount == 0;
                reason = shouldRun ? string.Empty : "Skipped because the previous step still has missing items.";
                return shouldRun;
            }

            if (condition.Contains("missing") || condition.Contains("thieu"))
            {
                var shouldRun = observationCount > 0;
                reason = shouldRun ? string.Empty : "Skipped because the previous step has no missing items.";
                return shouldRun;
            }

            if (condition.Contains("success") || condition.Contains("completed") || condition.Contains("thanh cong"))
            {
                var shouldRun = sourceStep != null && sourceStep.Outcome is not "error" and not "need_more_info";
                reason = shouldRun ? string.Empty : "Skipped because the dependency did not complete successfully.";
                return shouldRun;
            }

            reason = $"Skipped because the executor cannot safely evaluate condition: {step.Condition}.";
            return false;
        }

        private static bool ShouldStopAfterObservation(AssistantAgentPlanStepDto step, object? observation, AssistantAgentPlanDto plan)
        {
            if (observation == null || string.IsNullOrWhiteSpace(step.StopIf))
            {
                return false;
            }

            var stopIf = NormalizeText(step.StopIf);
            if (stopIf is "never" or "none" or "khong")
            {
                return false;
            }

            var count = GetObservationCount(observation);
            if (count <= 0)
            {
                return false;
            }

            if (step.Tool == AssistantActionRegistry.MeterReadingsFindMissing
                && plan.Steps.Any(x => x.StepNumber > step.StepNumber
                    && x.Tool is AssistantActionRegistry.InvoicesCreateMonthlyBulk or AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck))
            {
                return true;
            }

            return stopIf.Contains("found")
                || stopIf.Contains("missing")
                || stopIf.Contains("co du lieu")
                || stopIf.Contains("co phong")
                || stopIf.Contains("thieu");
        }

        private static int GetObservationCount(object observation)
        {
            if (observation is string)
            {
                return 0;
            }

            if (observation is System.Collections.ICollection collection)
            {
                return collection.Count;
            }

            if (observation is System.Collections.IEnumerable enumerable)
            {
                var count = 0;
                foreach (var _ in enumerable)
                {
                    count++;
                    if (count > 0)
                    {
                        break;
                    }
                }

                return count;
            }

            return 0;
        }

        private static AssistantCommandDto CloneCommand(AssistantCommandDto command)
        {
            return new AssistantCommandDto
            {
                Intent = command.Intent,
                Params = command.Params.ToDictionary(x => x.Key, x => x.Value),
                MissingFields = command.MissingFields.ToList(),
                RequiresConfirmation = command.RequiresConfirmation,
                Confidence = command.Confidence,
                Reason = command.Reason
            };
        }

        private void RecordAudit(
            string eventType,
            string? userMessage,
            AssistantCommandDto command,
            AssistantResponseDto response,
            string outcome,
            string? commandId = null,
            string? error = null,
            object? resultSummary = null)
        {
            _toolRegistry.TryGet(command.Intent, out var tool);
            _auditStore.Record(new AssistantAuditItem
            {
                UserId = _currentUserService.UserId,
                EventType = eventType,
                UserMessage = userMessage,
                CommandId = commandId ?? response.CommandId,
                Parser = response.Parser,
                Confidence = response.Confidence,
                Reason = response.Reason,
                Intent = command.Intent,
                ToolName = tool?.Name ?? command.Intent,
                ToolMode = tool?.Mode ?? string.Empty,
                RiskLevel = tool?.RiskLevel ?? string.Empty,
                RequiresConfirmation = tool?.RequiresConfirmation ?? command.RequiresConfirmation,
                RequiresStrongConfirmation = tool?.RequiresStrongConfirmation ?? false,
                Params = command.Params.ToDictionary(x => x.Key, x => x.Value),
                MissingFields = command.MissingFields.ToList(),
                ResponseType = response.Type,
                ResponseMessage = response.Message,
                Outcome = outcome,
                Error = error,
                ResultSummary = resultSummary ?? response.Result ?? response.Preview
            });
        }

        private static bool IsCancelMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "huy" or "huy lenh" or "bo qua" or "thoi" or "thoi bo qua" or "cancel";
        }

        private static bool IsStopAgentMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "dung" or "dung lai" or "huy agent" or "huy ke hoach" or "stop";
        }

        private static bool IsContinueAgentMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "ok" or "oke" or "tiep" or "tiep tuc" or "chay tiep" or "lam tiep" or "continue";
        }

        private static bool IsStrongConfirmMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "xac nhan" or "dong y" or "chap nhan" or "xac nhan thuc hien" or "thuc hien" or "confirm" or "yes" or "approve";
        }

        private static bool TryExtractMonthUpdate(string message, out DateOnly month)
        {
            month = default;
            var normalized = NormalizeText(message);
            if (!normalized.Contains("doi") && !normalized.Contains("sua") && !normalized.Contains("thang"))
            {
                return false;
            }

            var match = Regex.Match(normalized, @"thang\s+(\d{1,2})(?:\s*(?:nam|/|-)\s*(\d{4}))?");
            if (!match.Success)
            {
                match = Regex.Match(normalized, @"\b(\d{1,2})/(\d{4})\b");
            }

            if (!match.Success || !int.TryParse(match.Groups[1].Value, out var monthNumber) || monthNumber < 1 || monthNumber > 12)
            {
                return false;
            }

            var year = DateTime.Now.Year;
            if (match.Groups.Count > 2 && int.TryParse(match.Groups[2].Value, out var parsedYear))
            {
                year = parsedYear;
            }

            month = new DateOnly(year, monthNumber, 1);
            return true;
        }

        private static void ApplyMonthToPlan(AssistantAgentPlanDto plan, DateOnly month)
        {
            var monthText = month.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            foreach (var step in plan.Steps)
            {
                if (step.Args.ContainsKey("billingMonth"))
                {
                    step.Args["billingMonth"] = monthText;
                }

                if (step.Args.ContainsKey("fromMonth"))
                {
                    step.Args["fromMonth"] = monthText;
                }

                if (step.Args.ContainsKey("toMonth"))
                {
                    step.Args["toMonth"] = monthText;
                }
            }
        }

        private void UpdateAgentStateAfterCommandExecution(int userId, string commandId, bool success, string message)
        {
            if (!_agentStateStore.TryGet(userId, out var state)
                || state == null
                || !string.Equals(state.Execution.PendingCommandId, commandId, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            state.Execution.WaitingForConfirmation = false;
            state.Execution.PendingCommandId = null;
            state.Execution.StopReason = success
                ? "Confirmed tool execution completed. Send 'tiếp tục' to run the next step."
                : $"Tool execution failed: {message}";

            if (!success)
            {
                state.NextStepNumber = Math.Max(1, state.NextStepNumber - 1);
                state.Execution.NextStepNumber = state.NextStepNumber;
            }

            _agentStateStore.Set(userId, state.Plan, state.Execution, state.NextStepNumber, state.OriginalMessage);
        }

        private static bool IsRejectMessage(string message)
        {
            var normalized = NormalizeText(message);
            return normalized is "sai" or "sai roi" or "khong dung" or "khong phai" or "nham" or "nham roi" or "wrong";
        }

        private static bool ShouldAskForIntentClarification(AssistantCommandDto command)
        {
            return command.Intent == AssistantActionRegistry.AssistantUnknown || command.Confidence < 0.45;
        }

        private bool TryExtractSelectedIntent(string message, out string intent)
        {
            intent = string.Empty;
            const string prefix = "__intent:";
            var trimmed = message.Trim();
            if (!trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var selected = trimmed[prefix.Length..].Trim();
            if (!_actionRegistry.TryGet(selected, out _))
            {
                return false;
            }

            intent = selected;
            return true;
        }

        private List<AssistantActionSuggestionDto> BuildActionSuggestions()
        {
            return _actionRegistry.Actions
                .Where(x => x.CanExecute && x.Intent != AssistantActionRegistry.AssistantUnknown)
                .OrderBy(x => x.Intent)
                .Select(x => new AssistantActionSuggestionDto
                {
                    Intent = x.Intent,
                    Label = BuildIntentLabel(x.Intent),
                    Description = x.Description
                })
                .ToList();
        }

        private static string BuildIntentLabel(string intent)
        {
            return intent switch
            {
                AssistantActionRegistry.MeterReadingCreate => "Nhập chỉ số điện",
                AssistantActionRegistry.MeterReadingsFind => "Xem chỉ số điện",
                AssistantActionRegistry.MeterReadingsFindMissing => "Tìm phòng chưa nhập điện",
                AssistantActionRegistry.MeterReadingsFindAll => "Danh sách chỉ số điện",
                AssistantActionRegistry.MeterReadingsFindById => "Chi tiết chỉ số điện",
                AssistantActionRegistry.MeterReadingsDeleteByEndedContract => "Xóa chỉ số hợp đồng cũ",
                AssistantActionRegistry.RoomsFindAll => "Danh sách phòng",
                AssistantActionRegistry.RoomsFindVacant => "Phòng còn trống",
                AssistantActionRegistry.RoomsFindOccupied => "Phòng đang thuê",
                AssistantActionRegistry.RoomsFindByCode => "Xem phòng",
                AssistantActionRegistry.RoomsFindById => "Xem phòng theo ID",
                AssistantActionRegistry.RoomsCreate => "Tạo phòng",
                AssistantActionRegistry.RoomsUpdate => "Cập nhật giá phòng",
                AssistantActionRegistry.RoomsUpdateStatus => "Cập nhật trạng thái phòng",
                AssistantActionRegistry.TenantsFindAll => "Danh sách khách thuê",
                AssistantActionRegistry.TenantsFind => "Tìm khách thuê",
                AssistantActionRegistry.TenantsCreate => "Tạo khách thuê",
                AssistantActionRegistry.TenantsUpdate => "Cập nhật khách thuê",
                AssistantActionRegistry.ContractsFindAll => "Danh sách hợp đồng",
                AssistantActionRegistry.ContractsFindActive => "Hợp đồng hiệu lực",
                AssistantActionRegistry.ContractsFindByRoom => "Hợp đồng theo phòng",
                AssistantActionRegistry.ContractsFindById => "Hợp đồng theo ID",
                AssistantActionRegistry.ContractsCreate => "Tạo hợp đồng",
                AssistantActionRegistry.ContractsEnd => "Kết thúc hợp đồng",
                AssistantActionRegistry.ContractsUpdate => "Cập nhật hợp đồng",
                AssistantActionRegistry.ContractsCancel => "Hủy hợp đồng",
                AssistantActionRegistry.ContractsDeleteEnded => "Xóa hợp đồng đã kết thúc",
                AssistantActionRegistry.InvoicesFindAll => "Danh sách hóa đơn",
                AssistantActionRegistry.InvoicesFindUnpaid => "Hóa đơn chưa thanh toán",
                AssistantActionRegistry.InvoicesFindByRoomMonth => "Hóa đơn theo phòng/tháng",
                AssistantActionRegistry.InvoicesFindByPaymentCode => "Tra mã thanh toán",
                AssistantActionRegistry.InvoicesFindById => "Hóa đơn theo ID",
                AssistantActionRegistry.InvoicesCreate => "Tạo hóa đơn một phòng",
                AssistantActionRegistry.InvoicesCreateMonthlyBulk => "Tạo hóa đơn tháng",
                AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck => "Kiểm tra điện rồi tạo hóa đơn",
                AssistantActionRegistry.InvoicesMarkPaid => "Đánh dấu đã thanh toán",
                AssistantActionRegistry.InvoicesMarkUnpaid => "Chuyển về chưa thanh toán",
                AssistantActionRegistry.InvoicesUpdateElectricity => "Cập nhật tiền điện hóa đơn",
                AssistantActionRegistry.InvoicesReplace => "Thay thế hóa đơn",
                AssistantActionRegistry.InvoicesUpdate => "Cập nhật hóa đơn",
                AssistantActionRegistry.InvoicesDelete => "Xóa hóa đơn",
                AssistantActionRegistry.InvoicesDownloadPdf => "Tải PDF hóa đơn",
                AssistantActionRegistry.TransactionsFind => "Xem thu chi",
                AssistantActionRegistry.TransactionsFindById => "Chi tiết giao dịch thu chi",
                AssistantActionRegistry.TransactionsCreate => "Tạo thu chi",
                AssistantActionRegistry.TransactionsUpdate => "Cập nhật thu chi",
                AssistantActionRegistry.TransactionsDelete => "Xóa thu chi",
                AssistantActionRegistry.MeterReadingsUpdate => "Cập nhật chỉ số điện",
                AssistantActionRegistry.MeterReadingsDelete => "Xóa chỉ số điện",
                AssistantActionRegistry.PaymentsFind => "Tra cứu chuyển khoản",
                AssistantActionRegistry.PaymentsFindById => "Chi tiết chuyển khoản",
                AssistantActionRegistry.PaymentsReconcile => "Đối soát chuyển khoản",
                AssistantActionRegistry.PaymentsDelete => "Xóa chuyển khoản",
                AssistantActionRegistry.ReportsMonthlyRevenue => "Báo cáo doanh thu",
                AssistantActionRegistry.ReportsMonthlyExpense => "Báo cáo chi phí",
                AssistantActionRegistry.ReportsMonthlyProfitLoss => "Báo cáo lãi lỗ",
                AssistantActionRegistry.ReportsPaymentStatus => "Báo cáo thanh toán",
                AssistantActionRegistry.ReportsSalesLedger => "Sổ doanh thu",
                AssistantActionRegistry.ReportsSalesLedgerPdf => "PDF sổ doanh thu",
                _ => intent
            };
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

        private bool IsClearlyNewAgentRequest(string message)
        {
            if (IsCancelMessage(message)
                || IsRejectMessage(message)
                || IsContinueAgentMessage(message)
                || IsStrongConfirmMessage(message))
            {
                return false;
            }

            var command = AssistantCommandParser.ParseWithRules(message);
            _commandParser.Normalize(command);
            return command.Intent != AssistantActionRegistry.AssistantUnknown;
        }

        private static string BuildAgentCompletionMessage(AssistantAgentExecutionDto execution)
        {
            var finalStepMessage = execution.Steps
                .LastOrDefault(x => x.Outcome != "skipped" && !string.IsNullOrWhiteSpace(x.Message))
                ?.Message;

            return !string.IsNullOrWhiteSpace(finalStepMessage)
                ? finalStepMessage
                : "Mình đã xử lý xong yêu cầu nhưng không có dữ liệu phù hợp để hiển thị.";
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
            _toolRegistry.TryGet(command.Intent, out var tool);
            var requiresStrong = tool?.RequiresStrongConfirmation ?? false;

            return new AssistantResponseDto
            {
                Type = "confirmation_required",
                Intent = command.Intent,
                Command = command,
                CommandId = commandId,
                Preview = preview,
                Message = $"{message} {(requiresStrong ? "Đây là hành động có rủi ro cao. Bạn vui lòng xác nhận để thực hiện." : "Bạn xác nhận để thực hiện.")}",
                RequiresStrongConfirmation = requiresStrong
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
                ["roomStatus"] = "trạng thái phòng",
                ["tenantName"] = "tên khách thuê",
                ["billingMonth"] = "tháng",
                ["currentReading"] = "chỉ số điện mới",
                ["startDate"] = "ngày bắt đầu",
                ["actualEndDate"] = "ngày kết thúc",
                ["actualRoomPrice"] = "giá thuê thực tế",
                ["occupantCount"] = "số người ở",
                ["amount"] = "số tiền",
                ["electricityFee"] = "tiền điện",
                ["transactionDirection"] = "loại thu/chi",
                ["category"] = "nhóm giao dịch",
                ["transactionDate"] = "ngày giao dịch",
                ["invoiceId"] = "mã hóa đơn",
                ["meterReadingId"] = "mã bản ghi chỉ số điện",
                ["transactionId"] = "mã giao dịch thu chi",
                ["paymentTransactionId"] = "mã giao dịch ngân hàng"
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
                "roomStatus" => "trạng thái phòng",
                "tenantName" => "tên khách thuê",
                "billingMonth" => "tháng",
                "currentReading" => "chỉ số điện mới",
                "startDate" => "ngày bắt đầu",
                "actualEndDate" => "ngày kết thúc",
                "actualRoomPrice" => "giá thuê",
                "depositAmount" => "tiền cọc phải thu",
                "depositPaidAmount" => "tiền cọc đã nhận",
                "occupantCount" => "số người ở",
                "amount" => "số tiền",
                "electricityFee" => "tiền điện",
                "transactionDate" => "ngày giao dịch",
                "invoiceId" => "mã hóa đơn",
                "meterReadingId" => "mã bản ghi chỉ số điện",
                "transactionId" => "mã giao dịch thu chi",
                "paymentTransactionId" => "mã giao dịch ngân hàng",
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
