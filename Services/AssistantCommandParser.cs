using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NhaTro.Dtos.Assistant;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class AssistantCommandParser : IAssistantCommandParser
    {
        public const string IntentMeterReadingCreate = "meter_reading.create";
        public const string IntentRoomsFindVacant = "rooms.find_vacant";
        public const string IntentInvoicesFindUnpaid = "invoices.find_unpaid";
        public const string IntentUnknown = "assistant.unknown";
        private const double GeminiLowConfidenceThreshold = 0.45;

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AssistantCommandParser> _logger;
        private readonly AssistantActionRegistry _actionRegistry;
        private readonly AssistantToolRegistry _toolRegistry;
        private readonly AssistantLearningStore _learningStore;
        private readonly AssistantSemanticMemoryStore _semanticMemoryStore;
        private readonly AssistantTrainingPhraseCatalog _trainingPhraseCatalog;
        private readonly AssistantLocalIntentMatcher _localIntentMatcher;
        private readonly ICurrentUserService _currentUserService;

        public AssistantCommandParser(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<AssistantCommandParser> logger,
            AssistantActionRegistry actionRegistry,
            AssistantToolRegistry toolRegistry,
            AssistantLearningStore learningStore,
            AssistantSemanticMemoryStore semanticMemoryStore,
            AssistantTrainingPhraseCatalog trainingPhraseCatalog,
            AssistantLocalIntentMatcher localIntentMatcher,
            ICurrentUserService currentUserService)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _actionRegistry = actionRegistry;
            _toolRegistry = toolRegistry;
            _learningStore = learningStore;
            _semanticMemoryStore = semanticMemoryStore;
            _trainingPhraseCatalog = trainingPhraseCatalog;
            _localIntentMatcher = localIntentMatcher;
            _currentUserService = currentUserService;
        }

        public async Task<AssistantParseResult> ParseAsync(string message, AssistantCommandDto? context = null)
        {
            if (context == null)
            {
                var deterministicCommand = ParseWithRules(message);
                Normalize(deterministicCommand);
                if (deterministicCommand.Intent != AssistantActionRegistry.AssistantUnknown)
                {
                    deterministicCommand.Confidence = Math.Max(deterministicCommand.Confidence, 0.9);
                    deterministicCommand.Reason = $"Deterministic rule matched {deterministicCommand.Intent}.";
                    return new AssistantParseResult
                    {
                        Command = deterministicCommand,
                        Parser = "rule_first",
                        Confidence = deterministicCommand.Confidence,
                        Reason = deterministicCommand.Reason
                    };
                }
            }

            if (context == null
                && _learningStore.TryGetCorrectedIntent(_currentUserService.UserId, message, out var learnedIntent)
                && learnedIntent != AssistantActionRegistry.AssistantUnknown
                && _actionRegistry.TryGet(learnedIntent, out var learnedAction))
            {
                var learnedContext = new AssistantCommandDto
                {
                    Intent = learnedIntent,
                    RequiresConfirmation = learnedAction.RequiresConfirmation,
                    MissingFields = learnedAction.RequiredFields.ToList()
                };
                var learnedCommand = ParseWithRules(message, learnedContext);
                _learningStore.ApplyValueAliases(_currentUserService.UserId, learnedIntent, message, learnedCommand);
                Normalize(learnedCommand);
                learnedCommand.Confidence = 1;
                learnedCommand.Reason = "Matched a previous user correction.";

                return new AssistantParseResult
                {
                    Command = learnedCommand,
                    Parser = "learned",
                    Confidence = learnedCommand.Confidence,
                    Reason = learnedCommand.Reason
                };
            }

            if (context == null
                && _localIntentMatcher.TryMatch(message, out var localIntent, out var localConfidence)
                && _actionRegistry.TryGet(localIntent, out var localAction))
            {
                var localContext = new AssistantCommandDto
                {
                    Intent = localIntent,
                    RequiresConfirmation = localAction.RequiresConfirmation,
                    MissingFields = localAction.RequiredFields.ToList()
                };
                var localCommand = ParseWithRules(message, localContext);
                Normalize(localCommand);
                localCommand.Confidence = localConfidence;
                localCommand.Reason = $"Local semantic corpus matched {localIntent}.";
                return new AssistantParseResult
                {
                    Command = localCommand,
                    Parser = "local_semantic",
                    Confidence = localConfidence,
                    Reason = localCommand.Reason
                };
            }

            var aiCommand = await TryParseWithGeminiAsync(message, context);
            if (aiCommand != null)
            {
                _learningStore.ApplyValueAliases(_currentUserService.UserId, context?.Intent ?? aiCommand.Intent, message, aiCommand);
                FillLabeledParams(aiCommand, message);

                if (context != null)
                {
                    FillMissingParamsFromRuleFragment(aiCommand, ParseWithRules(message, context));
                }

                Normalize(aiCommand);

                if (aiCommand.Confidence < GeminiLowConfidenceThreshold)
                {
                    var fallbackCommand = ParseWithRules(message, context);
                    _learningStore.ApplyValueAliases(_currentUserService.UserId, context?.Intent ?? fallbackCommand.Intent, message, fallbackCommand);
                    Normalize(fallbackCommand);

                    if (fallbackCommand.Intent != AssistantActionRegistry.AssistantUnknown)
                    {
                        fallbackCommand.Confidence = 0.72;
                        fallbackCommand.Reason = $"Gemini confidence was low ({aiCommand.Confidence:0.##}); rule fallback matched {fallbackCommand.Intent}.";

                        return new AssistantParseResult
                        {
                            Command = fallbackCommand,
                            Parser = "rule_after_low_confidence",
                            Confidence = fallbackCommand.Confidence,
                            Reason = fallbackCommand.Reason
                        };
                    }
                }

                return new AssistantParseResult
                {
                    Command = aiCommand,
                    Parser = "gemini",
                    Confidence = aiCommand.Confidence,
                    Reason = aiCommand.Reason
                };
            }

            var ruleCommand = ParseWithRules(message, context);
            _learningStore.ApplyValueAliases(_currentUserService.UserId, context?.Intent ?? ruleCommand.Intent, message, ruleCommand);
            Normalize(ruleCommand);

            return new AssistantParseResult
            {
                Command = ruleCommand,
                Parser = "rule",
                Confidence = ruleCommand.Confidence,
                Reason = ruleCommand.Reason
            };
        }

        private async Task<AssistantCommandDto?> TryParseWithGeminiAsync(string message, AssistantCommandDto? context)
        {
            var apiKey = GetGeminiApiKey();
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return null;
            }

            try
            {
                var model = _configuration["Gemini:Model"] ?? "gemini-3.5-flash";
                var semanticHints = await BuildSemanticHintsAsync(message);
                var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent";
                using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
                request.Headers.Add("x-goog-api-key", apiKey);

                var body = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = $"{BuildParserInstructions(context, semanticHints)}\n\nUser request: {message}" }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0,
                        responseMimeType = "application/json",
                        responseSchema = BuildCommandSchema()
                    }
                };

                request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
                using var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var errorText = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini parser failed with status {StatusCode}: {Error}", response.StatusCode, errorText);
                    return null;
                }

                var jsonText = await response.Content.ReadAsStringAsync();
                var outputText = ExtractGeminiOutputText(jsonText);
                if (string.IsNullOrWhiteSpace(outputText))
                {
                    return null;
                }

                return JsonSerializer.Deserialize<AssistantCommandDto>(outputText, JsonOptions);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini parser failed. Falling back to rule parser.");
                return null;
            }
        }

        private string? GetGeminiApiKey()
        {
            return _configuration["Gemini:ApiKey"]
                ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        }

        private async Task<string> BuildSemanticHintsAsync(string message)
        {
            var apiKey = GetGeminiApiKey();
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return "No semantic memory available because Gemini API key is not configured.";
            }

            try
            {
                var candidates = BuildSemanticCandidates();
                if (candidates.Count == 0)
                {
                    return "No semantic memory candidates.";
                }

                var queryVector = await EmbedTextAsync(apiKey, message);
                if (queryVector.Length == 0)
                {
                    return "Semantic embedding failed.";
                }

                var vectors = await EnsureSemanticVectorsAsync(apiKey, candidates);
                var matches = vectors
                    .Where(x => x.Vector.Length > 0)
                    .Select(x => new
                    {
                        Candidate = x,
                        Score = CosineSimilarity(queryVector, x.Vector)
                    })
                    .OrderByDescending(x => x.Score)
                    .Take(8)
                    .Where(x => x.Score >= 0.68)
                    .ToList();

                if (matches.Count == 0)
                {
                    return "No close semantic matches.";
                }

                return string.Join("\n", matches.Select(x =>
                    $"- score {x.Score:0.00}, intent {x.Candidate.Intent}, kind {x.Candidate.Kind}: {x.Candidate.Text}"));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Semantic memory retrieval failed.");
                return "Semantic memory retrieval failed; continue with action catalog and rules.";
            }
        }

        private List<AssistantSemanticMemoryCandidate> BuildSemanticCandidates()
        {
            var candidates = new List<AssistantSemanticMemoryCandidate>();

            foreach (var tool in _toolRegistry.Tools.Where(x => x.CanExecute))
            {
                var phrases = _trainingPhraseCatalog.GetPhrases(tool.Intent, tool.Examples);
                candidates.Add(new AssistantSemanticMemoryCandidate(
                    0,
                    "tool_training_corpus",
                    $"tool:{tool.Name}:training:v1",
                    tool.Intent,
                    $"Intent: {tool.Intent}. Description: {tool.Description}. Vietnamese requests with the same meaning: {string.Join(" | ", phrases)}"));
            }

            candidates.AddRange(_learningStore.BuildSemanticCorrectionCandidates(_currentUserService.UserId));
            return candidates;
        }

        private async Task<List<AssistantSemanticMemoryItem>> EnsureSemanticVectorsAsync(
            string apiKey,
            IReadOnlyList<AssistantSemanticMemoryCandidate> candidates)
        {
            var existing = _semanticMemoryStore.GetMany(candidates.Select(x => x.SourceKey))
                .ToDictionary(x => x.SourceKey, StringComparer.OrdinalIgnoreCase);
            var result = new List<AssistantSemanticMemoryItem>();
            var missingCandidates = new List<AssistantSemanticMemoryCandidate>();

            foreach (var candidate in candidates)
            {
                if (existing.TryGetValue(candidate.SourceKey, out var item)
                    && item.Vector.Length > 0
                    && string.Equals(item.Text, candidate.Text, StringComparison.Ordinal))
                {
                    result.Add(item);
                    continue;
                }

                missingCandidates.Add(candidate);
            }

            using var throttler = new SemaphoreSlim(4);
            var embeddingTasks = missingCandidates.Select(async candidate =>
            {
                await throttler.WaitAsync();
                try
                {
                    var vector = await EmbedTextAsync(apiKey, candidate.Text);
                    return vector.Length == 0
                        ? null
                        : new AssistantSemanticMemoryItem
                        {
                            UserId = candidate.UserId,
                            Kind = candidate.Kind,
                            SourceKey = candidate.SourceKey,
                            Intent = candidate.Intent,
                            Text = candidate.Text,
                            Vector = vector,
                            UpdatedAt = DateTime.UtcNow
                        };
                }
                finally
                {
                    throttler.Release();
                }
            });

            var newItems = (await Task.WhenAll(embeddingTasks)).Where(x => x != null).Cast<AssistantSemanticMemoryItem>().ToList();
            result.AddRange(newItems);

            if (newItems.Count > 0)
            {
                _semanticMemoryStore.UpsertMany(newItems);
            }

            return result;
        }

        private async Task<float[]> EmbedTextAsync(string apiKey, string text)
        {
            var model = _configuration["Gemini:EmbeddingModel"] ?? "gemini-embedding-2";
            var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:embedContent";
            using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
            request.Headers.Add("x-goog-api-key", apiKey);

            var body = new
            {
                content = new
                {
                    parts = new[]
                    {
                        new { text }
                    }
                }
            };

            request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
            using var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Gemini embedding failed with status {StatusCode}: {Error}", response.StatusCode, errorText);
                return Array.Empty<float>();
            }

            var jsonText = await response.Content.ReadAsStringAsync();
            return ExtractEmbeddingValues(jsonText);
        }

        private static float[] ExtractEmbeddingValues(string jsonText)
        {
            using var document = JsonDocument.Parse(jsonText);
            if (!document.RootElement.TryGetProperty("embedding", out var embedding)
                || !embedding.TryGetProperty("values", out var values)
                || values.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<float>();
            }

            return values
                .EnumerateArray()
                .Where(x => x.ValueKind == JsonValueKind.Number)
                .Select(x => x.GetSingle())
                .ToArray();
        }

        private static double CosineSimilarity(IReadOnlyList<float> left, IReadOnlyList<float> right)
        {
            if (left.Count == 0 || right.Count == 0 || left.Count != right.Count)
            {
                return 0;
            }

            double dot = 0;
            double leftNorm = 0;
            double rightNorm = 0;

            for (var i = 0; i < left.Count; i++)
            {
                dot += left[i] * right[i];
                leftNorm += left[i] * left[i];
                rightNorm += right[i] * right[i];
            }

            return leftNorm == 0 || rightNorm == 0
                ? 0
                : dot / (Math.Sqrt(leftNorm) * Math.Sqrt(rightNorm));
        }

        private static string NormalizeSemanticKey(string value)
        {
            return Regex.Replace(value.Trim().ToLowerInvariant(), @"\s+", "-");
        }

        private string BuildParserInstructions(AssistantCommandDto? context, string semanticHints)
        {
            var today = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var contextText = context == null
                ? "No active command context."
                : $"""
Active command context:
- intent: {context.Intent}
- current params: {JsonSerializer.Serialize(context.Params, JsonOptions)}
- missing fields: {string.Join(", ", context.MissingFields)}

The user message may be a follow-up that fills missing fields for this active command.
If it is a follow-up, keep the same intent and only fill fields that are present in the new message.
""";

            return $"""
You parse Vietnamese room-rental management requests into one JSON command.
Today's date is {today}.
{contextText}
Supported tool catalog:
{_toolRegistry.BuildPromptCatalog(_currentUserService.Role)}

User-specific correction history:
{_learningStore.BuildPromptLessons(_currentUserService.UserId)}

Relevant semantic memory:
{semanticHints}

Return only fields in the schema.
confidence must be 0 to 1. Use high confidence only when the user intent clearly maps to one supported action.
If the request can map to multiple actions, choose the most likely action, set confidence below 0.65, and explain ambiguity in reason.
If the request is outside the catalog, use assistant.unknown with confidence below 0.3.
reason should briefly explain why you chose the intent, in Vietnamese or English.
Use an empty string for any unknown parameter value.
Date and month fields must be yyyy-MM-dd, month fields must use the first day of the month.
If user omits year, use the current year from today's date.
Money and numeric fields must contain only digits, no currency symbols.
Normalize roomCode to uppercase.
For transactionDirection use income or expense.
For category use operating or other.
Never invent IDs, room codes, tenant names, readings, or amounts.
""";
        }

        private object BuildCommandSchema()
        {
            return new
            {
                type = "object",
                additionalProperties = false,
                required = new[] { "intent", "params", "missingFields", "requiresConfirmation", "confidence", "reason" },
                properties = new
                {
                    intent = new
                    {
                        type = "string",
                        @enum = _actionRegistry.Actions.Select(x => x.Intent).ToArray()
                    },
                    @params = new
                    {
                        type = "object",
                        additionalProperties = false,
                        required = AssistantActionRegistry.ParamKeys,
                        properties = AssistantActionRegistry.ParamKeys.ToDictionary(
                            key => key,
                            _ => new { type = "string" })
                    },
                    missingFields = new
                    {
                        type = "array",
                        items = new
                        {
                            type = "string",
                            @enum = AssistantActionRegistry.ParamKeys
                        }
                    },
                    requiresConfirmation = new { type = "boolean" },
                    confidence = new { type = "number" },
                    reason = new { type = "string" }
                }
            };
        }

        private static string? ExtractGeminiOutputText(string jsonText)
        {
            using var document = JsonDocument.Parse(jsonText);
            var root = document.RootElement;

            if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            foreach (var candidate in candidates.EnumerateArray())
            {
                if (!candidate.TryGetProperty("content", out var content)
                    || !content.TryGetProperty("parts", out var parts)
                    || parts.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
                    {
                        return text.GetString();
                    }
                }
            }

            return null;
        }

        public static AssistantCommandDto ParseWithRules(string rawMessage, AssistantCommandDto? context = null)
        {
            var normalized = Normalize(rawMessage);

            if (context != null)
            {
                var followUpCommand = CreateCommand(context.Intent, context.RequiresConfirmation);
                FillCommonParams(followUpCommand, rawMessage, normalized);
                FillIntentSpecificParams(followUpCommand, normalized, context.Intent);
                FillContextualParams(followUpCommand, rawMessage, normalized, context);
                FillLabeledParams(followUpCommand, rawMessage);
                return followUpCommand;
            }

            if (normalized.Contains("so doanh thu") || normalized.Contains("so ban hang"))
            {
                return BuildRuleCommand(
                    normalized.Contains("pdf") || normalized.Contains("xuat") || normalized.Contains("tai")
                        ? AssistantActionRegistry.ReportsSalesLedgerPdf
                        : AssistantActionRegistry.ReportsSalesLedger,
                    rawMessage,
                    normalized,
                    requiresConfirmation: false);
            }

            var extendedCommand = ParseExtendedManagementCommand(rawMessage, normalized);
            if (extendedCommand != null)
            {
                return extendedCommand;
            }

            if ((normalized.Contains("danh sach") || normalized.Contains("lich su"))
                && (normalized.Contains("so dien") || normalized.Contains("chi so dien")))
            {
                return BuildRuleCommand(AssistantActionRegistry.MeterReadingsFindAll, rawMessage, normalized, requiresConfirmation: false);
            }

            if (LooksLikeMeterReadingQuery(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.MeterReadingsFind, rawMessage, normalized, requiresConfirmation: false);
            }

            if (LooksLikeMeterReadingCommand(normalized))
            {
                var command = CreateCommand(AssistantActionRegistry.MeterReadingCreate, requiresConfirmation: true);
                FillCommonParams(command, rawMessage, normalized);
                FillIntentSpecificParams(command, normalized, command.Intent);
                FillLabeledParams(command, rawMessage);
                AddMissing(command, "roomCode", "billingMonth", "currentReading");
                return command;
            }

            if (LooksLikeRoomCreateCommand(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.RoomsCreate, rawMessage, normalized, requiresConfirmation: true);
            }

            if (LooksLikeTenantCreateCommand(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.TenantsCreate, rawMessage, normalized, requiresConfirmation: true);
            }

            if (LooksLikeContractCreateCommand(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.ContractsCreate, rawMessage, normalized, requiresConfirmation: true);
            }

            if (LooksLikeInvoiceBulkCreateAfterMeterCheckCommand(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck, rawMessage, normalized, requiresConfirmation: true);
            }

            if (LooksLikeInvoiceBulkCreateCommand(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.InvoicesCreateMonthlyBulk, rawMessage, normalized, requiresConfirmation: true);
            }

            if (LooksLikeRevenueReportQuery(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.ReportsMonthlyRevenue, rawMessage, normalized, requiresConfirmation: false);
            }

            if (LooksLikeExpenseReportQuery(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.ReportsMonthlyExpense, rawMessage, normalized, requiresConfirmation: false);
            }

            if (LooksLikeProfitLossReportQuery(normalized))
            {
                return BuildRuleCommand(AssistantActionRegistry.ReportsMonthlyProfitLoss, rawMessage, normalized, requiresConfirmation: false);
            }

            if (LooksLikeOccupiedRoomQuery(normalized))
            {
                return CreateCommand(AssistantActionRegistry.RoomsFindOccupied, requiresConfirmation: false);
            }

            if (LooksLikeVacantRoomQuery(normalized))
            {
                return CreateCommand(AssistantActionRegistry.RoomsFindVacant, requiresConfirmation: false);
            }

            if (LooksLikeUnpaidInvoiceQuery(normalized))
            {
                var command = CreateCommand(AssistantActionRegistry.InvoicesFindUnpaid, requiresConfirmation: false);
                FillCommonParams(command, rawMessage, normalized);
                return command;
            }

            return CreateCommand(AssistantActionRegistry.AssistantUnknown, requiresConfirmation: false);
        }

        private static AssistantCommandDto BuildRuleCommand(string intent, string rawMessage, string normalized, bool requiresConfirmation)
        {
            var command = CreateCommand(intent, requiresConfirmation);
            FillCommonParams(command, rawMessage, normalized);
            FillIntentSpecificParams(command, normalized, intent);
            FillLabeledParams(command, rawMessage);
            if (intent is AssistantActionRegistry.ContractsCreate or AssistantActionRegistry.TenantsCreate or AssistantActionRegistry.TenantsFind)
            {
                SetParam(command, "tenantName", ExtractTenantName(rawMessage));
            }
            return command;
        }

        private static AssistantCommandDto? ParseExtendedManagementCommand(string rawMessage, string normalized)
        {
            string? intent = null;

            if (normalized.Contains("giao dich ngan hang") || normalized.Contains("chuyen khoan ngan hang"))
            {
                intent = normalized.Contains("xoa")
                    ? AssistantActionRegistry.PaymentsDelete
                    : normalized.Contains("doi soat") || normalized.Contains("khop")
                        ? AssistantActionRegistry.PaymentsReconcile
                        : normalized.Contains("id") || Regex.IsMatch(normalized, @"\b#?\d+\b")
                            ? AssistantActionRegistry.PaymentsFindById
                            : AssistantActionRegistry.PaymentsFind;
            }
            else if (normalized.Contains("hoa don"))
            {
                intent = normalized.Contains("ma thanh toan") && (normalized.Contains("tim") || normalized.Contains("tra") || normalized.Contains("xem"))
                    ? AssistantActionRegistry.InvoicesFindByPaymentCode
                    : (normalized.Contains("xem") || normalized.Contains("chi tiet")) && normalized.Contains("id")
                        ? AssistantActionRegistry.InvoicesFindById
                    : normalized.Contains("tao") && !normalized.Contains("tao lai") && !normalized.Contains("tat ca") && !normalized.Contains("hang loat")
                        ? AssistantActionRegistry.InvoicesCreate
                    : normalized.Contains("pdf") || normalized.Contains("tai") || normalized.Contains("xuat file")
                    ? AssistantActionRegistry.InvoicesDownloadPdf
                    : normalized.Contains("xoa") || normalized.Contains("huy hoa don")
                        ? AssistantActionRegistry.InvoicesDelete
                        : normalized.Contains("tao lai") || normalized.Contains("replace") || normalized.Contains("thay the")
                            ? AssistantActionRegistry.InvoicesReplace
                            : normalized.Contains("chua thanh toan") || normalized.Contains("huy thanh toan") || normalized.Contains("mark unpaid")
                                ? AssistantActionRegistry.InvoicesMarkUnpaid
                                : normalized.Contains("da thanh toan") || normalized.Contains("ghi nhan thanh toan") || normalized.Contains("thu tien")
                                    ? AssistantActionRegistry.InvoicesMarkPaid
                                : normalized.Contains("tien dien") && (normalized.Contains("sua") || normalized.Contains("cap nhat"))
                                    ? AssistantActionRegistry.InvoicesUpdateElectricity
                                    : (normalized.Contains("giam gia") || normalized.Contains("no cu") || normalized.Contains("ghi chu"))
                                        && (normalized.Contains("sua") || normalized.Contains("cap nhat") || normalized.Contains("giam"))
                                        ? AssistantActionRegistry.InvoicesUpdate
                                        : null;
            }
            else if ((normalized.Contains("so dien") || normalized.Contains("chi so dien")) && normalized.Contains("xoa"))
            {
                intent = normalized.Contains("hop dong") && (normalized.Contains("toan bo") || normalized.Contains("tat ca"))
                    ? AssistantActionRegistry.MeterReadingsDeleteByEndedContract
                    : AssistantActionRegistry.MeterReadingsDelete;
            }
            else if ((normalized.Contains("so dien") || normalized.Contains("chi so dien"))
                && (normalized.Contains("sua") || normalized.Contains("cap nhat")))
            {
                intent = AssistantActionRegistry.MeterReadingsUpdate;
            }
            else if ((normalized.Contains("so dien") || normalized.Contains("chi so dien"))
                && (normalized.Contains("xem") || normalized.Contains("chi tiet")) && normalized.Contains("id"))
            {
                intent = AssistantActionRegistry.MeterReadingsFindById;
            }
            else if (normalized.Contains("hop dong"))
            {
                intent = normalized.Contains("xoa")
                    ? AssistantActionRegistry.ContractsDeleteEnded
                    : normalized.Contains("huy")
                        ? AssistantActionRegistry.ContractsCancel
                        : normalized.Contains("sua") || normalized.Contains("cap nhat") || normalized.Contains("doi")
                            ? AssistantActionRegistry.ContractsUpdate
                            : (normalized.Contains("xem") || normalized.Contains("chi tiet")) && normalized.Contains("id")
                                ? AssistantActionRegistry.ContractsFindById
                            : null;
            }
            else if ((normalized.Contains("khach") || normalized.Contains("nguoi thue"))
                && (normalized.Contains("sua") || normalized.Contains("cap nhat") || normalized.Contains("doi")))
            {
                intent = AssistantActionRegistry.TenantsUpdate;
            }
            else if ((normalized.Contains("khach") || normalized.Contains("nguoi thue"))
                && (normalized.Contains("xem") || normalized.Contains("tim") || normalized.Contains("thong tin")))
            {
                intent = AssistantActionRegistry.TenantsFind;
            }
            else if (normalized.Contains("phong") && (normalized.Contains("sua") || normalized.Contains("cap nhat") || normalized.Contains("doi")))
            {
                intent = normalized.Contains("trang thai") || normalized.Contains("sang trong") || normalized.Contains("sua chua")
                    ? AssistantActionRegistry.RoomsUpdateStatus
                    : normalized.Contains("gia")
                        ? AssistantActionRegistry.RoomsUpdate
                        : null;
            }
            else if (normalized.Contains("phong") && normalized.Contains("id")
                && (normalized.Contains("xem") || normalized.Contains("chi tiet")))
            {
                intent = AssistantActionRegistry.RoomsFindById;
            }
            else if (normalized.Contains("giao dich") && normalized.Contains("xoa"))
            {
                intent = AssistantActionRegistry.TransactionsDelete;
            }
            else if (normalized.Contains("giao dich") && (normalized.Contains("sua") || normalized.Contains("cap nhat")))
            {
                intent = AssistantActionRegistry.TransactionsUpdate;
            }
            else if (normalized.Contains("giao dich") && (normalized.Contains("xem") || normalized.Contains("chi tiet"))
                && (normalized.Contains("id") || Regex.IsMatch(normalized, @"\b#?\d+\b")))
            {
                intent = AssistantActionRegistry.TransactionsFindById;
            }

            if (intent == null)
            {
                return null;
            }

            var command = BuildRuleCommand(intent, rawMessage, normalized, requiresConfirmation: intent != AssistantActionRegistry.PaymentsFind && intent != AssistantActionRegistry.InvoicesDownloadPdf);
            FillExtendedManagementParams(command, rawMessage, normalized);
            return command;
        }

        private static void FillExtendedManagementParams(AssistantCommandDto command, string rawMessage, string normalized)
        {
            SetParam(command, "contractId", ExtractIdAfterKeywords(normalized, "hop dong", "contract", "id")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "roomId", ExtractIdAfterKeywords(normalized, "phong", "room")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "invoiceId", ExtractIdAfterKeywords(normalized, "hoa don", "invoice")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "meterReadingId", ExtractIdAfterKeywords(normalized, "chi so", "so dien", "meter")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "transactionId", ExtractIdAfterKeywords(normalized, "giao dich", "transaction")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "paymentTransactionId", ExtractIdAfterKeywords(normalized, "giao dich ngan hang", "chuyen khoan ngan hang", "chuyen khoan", "transaction")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "paymentCode", ExtractPaymentCode(rawMessage));

            SetParam(command, "listedPrice", ExtractMoneyAfterKeywords(normalized, "gia phong", "gia")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "depositAmount", ExtractMoneyAfterKeywords(normalized, "tien coc", "coc")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "depositPaidAmount", ExtractMoneyAfterKeywords(normalized, "coc da dua", "coc da tra", "da dua", "da coc", "da dong coc")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "actualRoomPrice", ExtractMoneyAfterKeywords(normalized, "gia thue", "tien phong")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "occupantCount", ExtractPeopleCount(normalized)?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "discountAmount", ExtractMoneyAfterKeywords(normalized, "giam gia", "giam")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "debtAmount", ExtractMoneyAfterKeywords(normalized, "no cu", "no")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "electricityFee", ExtractMoneyAfterKeywords(normalized, "tien dien")?.ToString(CultureInfo.InvariantCulture));
            SetParam(command, "amount", ExtractMoneyAfterKeywords(normalized, "thanh", "so tien", "tien")?.ToString(CultureInfo.InvariantCulture));

            if (command.Intent == AssistantActionRegistry.RoomsUpdateStatus)
            {
                var status = normalized.Contains("trong") ? "vacant"
                    : normalized.Contains("sua") ? "maintenance"
                    : normalized.Contains("thue") || normalized.Contains("co nguoi") ? "occupied"
                    : null;
                SetParam(command, "roomStatus", status);
            }

            if (command.Intent == AssistantActionRegistry.PaymentsFind && normalized.Contains("chua doi soat"))
            {
                SetParam(command, "processStatus", "pending");
            }

            var cccdMatch = Regex.Match(rawMessage, @"\b\d{9,12}\b");
            if (normalized.Contains("cccd") && cccdMatch.Success)
            {
                SetParam(command, "cccd", cccdMatch.Value);
            }
        }

        public AssistantCommandDto Normalize(AssistantCommandDto command)
        {
            command.Intent = string.IsNullOrWhiteSpace(command.Intent) ? AssistantActionRegistry.AssistantUnknown : command.Intent.Trim();
            command.Params ??= new Dictionary<string, string?>();
            command.MissingFields ??= new List<string>();
            command.Confidence = double.IsFinite(command.Confidence) ? Math.Clamp(command.Confidence, 0, 1) : 0;
            command.Reason = string.IsNullOrWhiteSpace(command.Reason) ? string.Empty : command.Reason.Trim();

            foreach (var key in AssistantActionRegistry.ParamKeys)
            {
                EnsureParam(command, key);
                command.Params[key] = string.IsNullOrWhiteSpace(command.Params[key]) ? null : command.Params[key]!.Trim();
            }

            if (command.Params["roomCode"] != null)
            {
                command.Params["roomCode"] = command.Params["roomCode"]!.Trim().ToUpperInvariant();
            }

            if (!_actionRegistry.TryGet(command.Intent, out var action))
            {
                command.Intent = AssistantActionRegistry.AssistantUnknown;
                _actionRegistry.TryGet(command.Intent, out action);
            }

            if (action == null)
            {
                command.RequiresConfirmation = false;
                command.MissingFields.Clear();
                command.Confidence = Math.Min(command.Confidence, 0.2);
                command.Reason = string.IsNullOrWhiteSpace(command.Reason) ? "No supported action matched." : command.Reason;
                return command;
            }

            command.RequiresConfirmation = action.RequiresConfirmation;
            command.MissingFields.Clear();
            AddMissing(command, action.RequiredFields);
            AddAlternativeLocatorMissingFields(command);

            if (!action.CanExecute)
            {
                command.RequiresConfirmation = false;
                command.Confidence = Math.Min(command.Confidence, 0.3);
            }

            if (string.IsNullOrWhiteSpace(command.Reason))
            {
                command.Reason = command.Intent == AssistantActionRegistry.AssistantUnknown
                    ? "No supported action matched."
                    : $"Matched {command.Intent}.";
            }

            return command;
        }

        private static void AddAlternativeLocatorMissingFields(AssistantCommandDto command)
        {
            static bool Has(AssistantCommandDto value, string key) =>
                value.Params.TryGetValue(key, out var parameter) && !string.IsNullOrWhiteSpace(parameter);

            void RequireIdOr(string idField, params string[] alternativeFields)
            {
                if (!Has(command, idField))
                {
                    AddMissing(command, alternativeFields);
                }
            }

            switch (command.Intent)
            {
                case AssistantActionRegistry.TenantsUpdate:
                case AssistantActionRegistry.TenantsFind:
                    if (!Has(command, "tenantId") && !Has(command, "tenantName") && !Has(command, "phone") && !Has(command, "cccd"))
                    {
                        AddMissing(command, "tenantName");
                    }
                    break;
                case AssistantActionRegistry.ContractsUpdate:
                case AssistantActionRegistry.ContractsCancel:
                case AssistantActionRegistry.ContractsDeleteEnded:
                case AssistantActionRegistry.MeterReadingsDeleteByEndedContract:
                    RequireIdOr("contractId", "roomCode");
                    break;
                case AssistantActionRegistry.MeterReadingsUpdate:
                case AssistantActionRegistry.MeterReadingsDelete:
                    RequireIdOr("meterReadingId", "roomCode", "billingMonth");
                    break;
                case AssistantActionRegistry.InvoicesMarkUnpaid:
                case AssistantActionRegistry.InvoicesMarkPaid:
                case AssistantActionRegistry.InvoicesReplace:
                case AssistantActionRegistry.InvoicesUpdate:
                case AssistantActionRegistry.InvoicesDelete:
                case AssistantActionRegistry.InvoicesDownloadPdf:
                    RequireIdOr("invoiceId", "roomCode", "billingMonth");
                    break;
                case AssistantActionRegistry.PaymentsReconcile:
                    RequireIdOr("invoiceId", "roomCode", "billingMonth");
                    break;
            }
        }

        private static void EnsureParam(AssistantCommandDto command, string key)
        {
            if (!command.Params.ContainsKey(key))
            {
                command.Params[key] = null;
            }
        }

        private static AssistantCommandDto CreateCommand(string intent, bool requiresConfirmation)
        {
            return new AssistantCommandDto
            {
                Intent = intent,
                RequiresConfirmation = requiresConfirmation,
                Confidence = intent == AssistantActionRegistry.AssistantUnknown ? 0.2 : 0.7,
                Reason = intent == AssistantActionRegistry.AssistantUnknown
                    ? "Rule parser could not match the request."
                    : $"Rule parser matched {intent}."
            };
        }

        private static void AddMissing(AssistantCommandDto command, params string[] fieldNames)
        {
            foreach (var fieldName in fieldNames)
            {
                if (!command.Params.TryGetValue(fieldName, out var value) || string.IsNullOrWhiteSpace(value))
                {
                    command.MissingFields.Add(fieldName);
                }
            }
        }

        private static void FillCommonParams(AssistantCommandDto command, string rawMessage, string normalized)
        {
            SetParam(command, "roomCode", ExtractRoomCode(rawMessage, normalized));

            var month = ExtractMonth(normalized);
            if (month.HasValue)
            {
                SetParam(command, "billingMonth", month.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "fromMonth", month.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "toMonth", month.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }

            var monthRange = ExtractMonthRange(normalized);
            if (monthRange.HasValue)
            {
                SetParam(command, "fromMonth", monthRange.Value.From.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "toMonth", monthRange.Value.To.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }

            var explicitDate = ExtractExplicitDate(normalized);
            if (explicitDate.HasValue)
            {
                SetParam(command, "startDate", explicitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "actualEndDate", explicitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "transactionDate", explicitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }

            SetParam(command, "phone", ExtractPhone(rawMessage));
        }

        private static void FillLabeledParams(AssistantCommandDto command, string rawMessage)
        {
            var lines = Regex.Split(rawMessage, @"[\r\n;]+")
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x));

            foreach (var line in lines)
            {
                var match = Regex.Match(line, @"^([^:=\-]{2,40})\s*[:=\-]\s*(.+)$");
                if (!match.Success)
                {
                    continue;
                }

                var label = Normalize(match.Groups[1].Value);
                var rawValue = match.Groups[2].Value.Trim();
                var field = MapLabelToField(command.Intent, label);
                if (field == null)
                {
                    continue;
                }

                SetParam(command, field, ParseLabeledValue(field, rawValue));
            }
        }

        private static string? MapLabelToField(string intent, string label)
        {
            if (label is "phong" or "ma phong" or "room" or "room code") return "roomCode";
            if (label is "trang thai phong" or "trang thai") return "roomStatus";
            if (label is "khach" or "khach thue" or "nguoi thue" or "ten khach" or "ten nguoi thue") return "tenantName";
            if (label is "dien thoai" or "so dien thoai" or "sdt" or "phone") return "phone";
            if (label is "cccd" or "cmnd" or "can cuoc") return "cccd";
            if (label is "thang" or "ky" or "ky hoa don" or "billing month") return "billingMonth";
            if (label is "chi so dien" or "so dien" or "cong to" or "chi so moi") return "currentReading";
            if (label is "ngay bat dau" or "bat dau" or "tu ngay") return "startDate";
            if (label is "ngay ket thuc du kien" or "ket thuc du kien") return "expectedEndDate";
            if (label is "ngay ket thuc" or "ngay tra phong" or "tra phong") return "actualEndDate";
            if (label is "tien coc" or "dat coc" or "coc phai thu" or "coc") return "depositAmount";
            if (label is "tien coc da nhan" or "coc da dua" or "coc da tra" or "da coc") return "depositPaidAmount";
            if (label is "gia thue" or "tien phong" or "gia thuc te")
                return intent.StartsWith("invoices.", StringComparison.OrdinalIgnoreCase) ? "roomFee" : "actualRoomPrice";
            if (label is "gia phong" or "gia niem yet")
                return intent.StartsWith("contracts.", StringComparison.OrdinalIgnoreCase) ? "actualRoomPrice"
                    : intent.StartsWith("invoices.", StringComparison.OrdinalIgnoreCase) ? "roomFee"
                    : "listedPrice";
            if (label is "so nguoi" or "nguoi o" or "so nguoi o") return "occupantCount";
            if (label is "giam gia" or "chiet khau") return "discountAmount";
            if (label is "no" or "no cu" or "cong no") return "debtAmount";
            if (label is "so tien" or "tien" or "amount") return "amount";
            if (label is "phuong thuc thanh toan" or "thanh toan bang") return "paymentMethod";
            if (label is "ma thanh toan") return "paymentCode";
            if (label is "tham chieu thanh toan") return "paymentReference";
            if (label is "ghi chu" or "ly do") return "note";
            if (label is "loai thu chi" or "loai giao dich" or "thu chi") return "transactionDirection";
            if (label is "danh muc" or "nhom giao dich") return "category";
            if (label is "khoan" or "noi dung" or "ten khoan") return "itemName";
            if (label is "ngay giao dich") return "transactionDate";
            if (label is "mo ta") return "description";
            if (label is "tu thang") return "fromMonth";
            if (label is "den thang") return "toMonth";
            if (label is "trang thai xu ly") return "processStatus";
            if (label is "trang thai hoa don" or "trang thai hop dong") return "status";
            if (label is "ma hoa don" or "invoice id") return "invoiceId";
            if (label is "ma hop dong" or "contract id") return "contractId";
            if (label is "ma khach" or "tenant id") return "tenantId";
            if (label is "ma chi so" or "meter id") return "meterReadingId";
            if (label is "ma giao dich" or "transaction id") return "transactionId";
            if (label is "ma giao dich ngan hang" or "payment id") return "paymentTransactionId";
            if (label is "tien dien" or "phi dien") return "electricityFee";
            if (label is "tien nuoc" or "phi nuoc") return "waterFee";
            if (label is "tien rac" or "phi rac") return "trashFee";
            return null;
        }

        private static string? ParseLabeledValue(string field, string rawValue)
        {
            var normalizedValue = Normalize(rawValue);
            if (field is "listedPrice" or "actualRoomPrice" or "depositAmount" or "depositPaidAmount" or "discountAmount" or "debtAmount"
                or "amount" or "roomFee" or "electricityFee" or "waterFee" or "trashFee")
            {
                return ExtractNaturalMoney(normalizedValue)?.ToString(CultureInfo.InvariantCulture);
            }

            if (field is "startDate" or "expectedEndDate" or "actualEndDate" or "transactionDate")
            {
                return ExtractExplicitDate(normalizedValue)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }

            if (field is "billingMonth" or "fromMonth" or "toMonth")
            {
                var month = ExtractMonth(normalizedValue) ?? ExtractMonth($"thang {normalizedValue}");
                return month?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }

            if (field is "currentReading" or "occupantCount" or "invoiceId" or "contractId" or "tenantId"
                or "meterReadingId" or "transactionId" or "paymentTransactionId")
            {
                var number = Regex.Match(normalizedValue, @"\d+");
                return number.Success ? number.Value : null;
            }

            if (field == "roomCode") return rawValue.Trim().ToUpperInvariant();
            if (field == "roomStatus")
            {
                return normalizedValue.Contains("trong") ? "vacant"
                    : normalizedValue.Contains("sua") ? "maintenance"
                    : normalizedValue.Contains("thue") || normalizedValue.Contains("nguoi") ? "occupied"
                    : normalizedValue;
            }
            if (field == "transactionDirection")
            {
                return normalizedValue.Contains("chi") ? "expense" : normalizedValue.Contains("thu") ? "income" : normalizedValue;
            }

            return rawValue.Trim();
        }

        private static void FillIntentSpecificParams(AssistantCommandDto command, string normalized, string intent)
        {
            if (intent == AssistantActionRegistry.MeterReadingCreate)
            {
                SetParam(command, "currentReading", ExtractCurrentReading(normalized)?.ToString(CultureInfo.InvariantCulture));
            }

            if (intent is AssistantActionRegistry.RoomsCreate or AssistantActionRegistry.ContractsCreate)
            {
                SetParam(command, "listedPrice", ExtractMoneyAfterKeywords(normalized, "gia", "gia phong")?.ToString(CultureInfo.InvariantCulture));
                SetParam(command, "actualRoomPrice", ExtractMoneyAfterKeywords(normalized, "gia", "gia thue")?.ToString(CultureInfo.InvariantCulture));
                SetParam(command, "depositAmount", ExtractMoneyAfterKeywords(normalized, "coc", "dat coc")?.ToString(CultureInfo.InvariantCulture));
                SetParam(command, "depositPaidAmount", ExtractMoneyAfterKeywords(normalized, "coc da dua", "coc da tra", "da dua", "da coc", "da dong coc")?.ToString(CultureInfo.InvariantCulture));
                SetParam(command, "occupantCount", ExtractPeopleCount(normalized)?.ToString(CultureInfo.InvariantCulture));
            }

            if (intent == AssistantActionRegistry.TransactionsCreate)
            {
                SetParam(command, "amount", ExtractMoneyAfterKeywords(normalized, "chi phi", "thu", "chi", "tien")?.ToString(CultureInfo.InvariantCulture));
                if (normalized.Contains("chi") || normalized.Contains("mua") || normalized.Contains("sua"))
                {
                    SetParam(command, "transactionDirection", "expense");
                }
                else if (normalized.Contains("thu"))
                {
                    SetParam(command, "transactionDirection", "income");
                }
            }

            if (intent == AssistantActionRegistry.InvoicesMarkPaid)
            {
                SetParam(command, "invoiceId", ExtractIdAfterKeywords(normalized, "hoa don", "hd")?.ToString(CultureInfo.InvariantCulture));
                SetParam(command, "amount", ExtractMoneyAfterKeywords(normalized, "thanh toan", "tra", "dong")?.ToString(CultureInfo.InvariantCulture));
            }
        }

        private static void FillContextualParams(
            AssistantCommandDto command,
            string rawMessage,
            string normalized,
            AssistantCommandDto context)
        {
            var numbers = ExtractIntegerTokens(normalized);
            if (context.Intent == AssistantActionRegistry.MeterReadingCreate)
            {
                FillMeterReadingContextualParams(command, context, numbers);
                FillTextFields(command, rawMessage, normalized, context);
                return;
            }

            FillMonthFields(command, context, numbers);
            FillDateFields(command, context, numbers);
            FillMoneyFields(command, normalized, context, numbers);
            FillIdAndCountFields(command, normalized, context, numbers);
            FillClassificationFields(command, normalized, context);
            FillTextFields(command, rawMessage, normalized, context);
        }

        private static void FillMonthFields(AssistantCommandDto command, AssistantCommandDto context, IReadOnlyList<int> numbers)
        {
            foreach (var field in new[] { "billingMonth", "fromMonth", "toMonth" })
            {
                if (!context.MissingFields.Contains(field) || !string.IsNullOrWhiteSpace(GetParam(command, field)))
                {
                    continue;
                }

                var month = numbers.FirstOrDefault(x => x >= 1 && x <= 12);
                if (month > 0)
                {
                    SetParam(command, field, ToMonthString(month));
                }
            }
        }

        private static void FillDateFields(AssistantCommandDto command, AssistantCommandDto context, IReadOnlyList<int> numbers)
        {
            foreach (var field in new[] { "startDate", "expectedEndDate", "actualEndDate", "transactionDate" })
            {
                if (!context.MissingFields.Contains(field) || !string.IsNullOrWhiteSpace(GetParam(command, field)))
                {
                    continue;
                }

                var date = ExtractDateFromNumbers(numbers);
                if (date.HasValue)
                {
                    SetParam(command, field, date.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                }
            }
        }

        private static void FillMoneyFields(
            AssistantCommandDto command,
            string normalized,
            AssistantCommandDto context,
            IReadOnlyList<int> numbers)
        {
            var money = ExtractNaturalMoney(normalized);
            var isDateOnlyInput = IsDateOnlyInput(normalized);
            foreach (var field in new[]
            {
                "listedPrice", "actualRoomPrice", "depositAmount", "depositPaidAmount", "discountAmount", "debtAmount", "amount",
                "roomFee", "electricityFee", "waterFee", "trashFee"
            })
            {
                if (!context.MissingFields.Contains(field) || !string.IsNullOrWhiteSpace(GetParam(command, field)))
                {
                    continue;
                }

                var numericFallback = isDateOnlyInput ? 0 : numbers.LastOrDefault(x => x >= 1_000);
                decimal? value = money ?? (numericFallback > 0 ? numericFallback : null);
                if (value.HasValue && value.Value > 0)
                {
                    SetParam(command, field, value.Value.ToString(CultureInfo.InvariantCulture));
                }
            }
        }

        private static void FillIdAndCountFields(
            AssistantCommandDto command,
            string normalized,
            AssistantCommandDto context,
            IReadOnlyList<int> numbers)
        {
            var isDateOnlyInput = IsDateOnlyInput(normalized);
            foreach (var field in new[]
            {
                "invoiceId", "contractId", "tenantId", "meterReadingId", "transactionId",
                "paymentTransactionId", "occupantCount", "currentReading"
            })
            {
                if (!context.MissingFields.Contains(field) || !string.IsNullOrWhiteSpace(GetParam(command, field)))
                {
                    continue;
                }

                var value = isDateOnlyInput
                    ? 0
                    : field == "occupantCount"
                    ? Regex.IsMatch(normalized, @"\b(nguoi|ng)\b") || (numbers.Count == 1 && !Regex.IsMatch(normalized, @"(trieu|tr|k|nghin|ngan)\b"))
                        ? numbers.FirstOrDefault(x => x > 0 && x <= 30)
                        : 0
                    : numbers.LastOrDefault(x => x > 0);

                if (value > 0)
                {
                    SetParam(command, field, value.ToString(CultureInfo.InvariantCulture));
                }
            }
        }

        private static void FillClassificationFields(AssistantCommandDto command, string normalized, AssistantCommandDto context)
        {
            if (context.MissingFields.Contains("transactionDirection") && string.IsNullOrWhiteSpace(GetParam(command, "transactionDirection")))
            {
                if (normalized.Contains("chi") || normalized.Contains("mua") || normalized.Contains("sua") || normalized.Contains("tra"))
                {
                    SetParam(command, "transactionDirection", "expense");
                }
                else if (normalized.Contains("thu") || normalized.Contains("nhan"))
                {
                    SetParam(command, "transactionDirection", "income");
                }
            }

            if (context.MissingFields.Contains("category") && string.IsNullOrWhiteSpace(GetParam(command, "category")))
            {
                SetParam(command, "category", normalized.Contains("van hanh") || normalized.Contains("dien") || normalized.Contains("nuoc") || normalized.Contains("sua")
                    ? "operating"
                    : "other");
            }

            if (context.MissingFields.Contains("roomStatus") && string.IsNullOrWhiteSpace(GetParam(command, "roomStatus")))
            {
                if (normalized.Contains("trong") || normalized.Contains("vacant"))
                {
                    SetParam(command, "roomStatus", "vacant");
                }
                else if (normalized.Contains("dang thue") || normalized.Contains("occupied"))
                {
                    SetParam(command, "roomStatus", "occupied");
                }
            }
        }

        private static void FillTextFields(
            AssistantCommandDto command,
            string rawMessage,
            string normalized,
            AssistantCommandDto context)
        {
            var text = CleanFreeText(rawMessage);
            if (string.IsNullOrWhiteSpace(text))
            {
                return;
            }

            if (context.MissingFields.Contains("tenantName") && string.IsNullOrWhiteSpace(GetParam(command, "tenantName")))
            {
                var roomCodeFromMessage = GetParam(command, "roomCode");
                var tenantText = string.IsNullOrWhiteSpace(roomCodeFromMessage)
                    ? text
                    : Regex.Replace(text, $@"\b{Regex.Escape(roomCodeFromMessage)}\b", string.Empty, RegexOptions.IgnoreCase).Trim();
                if (!string.IsNullOrWhiteSpace(tenantText))
                {
                    SetParam(command, "tenantName", CleanTenantReference(tenantText));
                }
            }

            if (context.MissingFields.Contains("phone") && string.IsNullOrWhiteSpace(GetParam(command, "phone")))
            {
                SetParam(command, "phone", ExtractPhone(rawMessage));
            }

            if (context.MissingFields.Contains("itemName") && string.IsNullOrWhiteSpace(GetParam(command, "itemName")))
            {
                SetParam(command, "itemName", text);
            }

            if (context.MissingFields.Contains("description") && string.IsNullOrWhiteSpace(GetParam(command, "description")))
            {
                SetParam(command, "description", text);
            }

            if (context.MissingFields.Contains("note") && string.IsNullOrWhiteSpace(GetParam(command, "note")))
            {
                SetParam(command, "note", text);
            }
        }

        private static void FillMeterReadingContextualParams(
            AssistantCommandDto command,
            AssistantCommandDto context,
            IReadOnlyList<int> numbers)
        {
            var assignedMonth = false;
            var monthNumber = numbers.FirstOrDefault(x => x >= 1 && x <= 12);

            if (context.MissingFields.Contains("billingMonth")
                && string.IsNullOrWhiteSpace(GetParam(command, "billingMonth"))
                && monthNumber > 0)
            {
                SetParam(command, "billingMonth", ToMonthString(monthNumber));
                assignedMonth = true;
            }

            if (!context.MissingFields.Contains("currentReading")
                || !string.IsNullOrWhiteSpace(GetParam(command, "currentReading")))
            {
                return;
            }

            int? reading = null;
            if (assignedMonth)
            {
                reading = numbers.FirstOrDefault(x => x != monthNumber);
            }
            else if (!context.MissingFields.Contains("billingMonth"))
            {
                reading = numbers.Last();
            }
            else if (numbers.Count >= 2)
            {
                reading = numbers.Last();
            }

            if (reading.HasValue && reading.Value > 0)
            {
                SetParam(command, "currentReading", reading.Value.ToString(CultureInfo.InvariantCulture));
            }
        }

        private static List<int> ExtractIntegerTokens(string normalized)
        {
            return Regex.Matches(normalized, @"\b\d+\b")
                .Select(x => int.Parse(x.Value, CultureInfo.InvariantCulture))
                .ToList();
        }

        private static DateOnly? ExtractDateFromNumbers(IReadOnlyList<int> numbers)
        {
            if (numbers.Count >= 3)
            {
                var day = numbers[0];
                var month = numbers[1];
                var year = numbers[2] < 100 ? 2000 + numbers[2] : numbers[2];
                return TryCreateDate(year, month, day);
            }

            if (numbers.Count >= 2)
            {
                return TryCreateDate(DateTime.Now.Year, numbers[1], numbers[0]);
            }

            return null;
        }

        private static DateOnly? TryCreateDate(int year, int month, int day)
        {
            try
            {
                return new DateOnly(year, month, day);
            }
            catch
            {
                return null;
            }
        }

        private static decimal? ExtractNaturalMoney(string normalized)
        {
            if (IsDateOnlyInput(normalized))
            {
                return null;
            }

            var match = Regex.Match(normalized, @"\b(\d+(?:[.,]\d+)*)\s*(trieu|tr|k|nghin|ngan)?(\d+)?\b");
            if (!match.Success || !TryParseNaturalMoney(match.Groups[1].Value, match.Groups[2].Value, out var amount, match.Groups[3].Value))
            {
                return null;
            }

            return !string.IsNullOrWhiteSpace(match.Groups[2].Value) || amount >= 1_000 ? amount : null;
        }

        private static bool IsDateOnlyInput(string normalized)
        {
            return Regex.IsMatch(
                normalized.Trim(),
                @"^(?:(?:ngay|tu|bat dau)\s*)?\d{1,2}\s*/\s*\d{1,2}(?:\s*/\s*\d{2,4})?$");
        }

        private static string CleanFreeText(string rawMessage)
        {
            var text = Regex.Replace(rawMessage.Trim(), @"\b\d+(?:[.,/]\d+)*\b", " ");
            text = Regex.Replace(text, @"\b(tháng|thang|ngày|ngay|năm|nam|giá|gia|cọc|coc|là|la|vnd|đ|d|triệu|trieu|nghìn|nghin|ngàn|ngan|người|nguoi|phòng|phong|hóa đơn|hoa don|hd)\b", " ", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"[,;:=]+", " ");
            return Regex.Replace(text, @"\s+", " ").Trim();
        }

        private static string ToMonthString(int month)
        {
            return new DateOnly(DateTime.Now.Year, month, 1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        private static string? GetParam(AssistantCommandDto command, string key)
        {
            return command.Params.TryGetValue(key, out var value) ? value : null;
        }

        private static void SetParam(AssistantCommandDto command, string key, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                command.Params[key] = value;
            }
        }

        private static void FillMissingParamsFromRuleFragment(AssistantCommandDto target, AssistantCommandDto fragment)
        {
            foreach (var item in fragment.Params)
            {
                if (!string.IsNullOrWhiteSpace(item.Value)
                    && (!target.Params.TryGetValue(item.Key, out var currentValue) || string.IsNullOrWhiteSpace(currentValue)))
                {
                    target.Params[item.Key] = item.Value;
                }
            }
        }

        private static bool LooksLikeMeterReadingCommand(string normalized)
        {
            return normalized.Contains("dien")
                && (normalized.Contains("nhap") || normalized.Contains("ghi") || normalized.Contains("chi so") || normalized.Contains("cong to"));
        }

        private static bool LooksLikeRoomCreateCommand(string normalized)
        {
            return normalized.Contains("phong")
                && !normalized.Contains("hop dong")
                && !normalized.Contains("hoa don")
                && (normalized.Contains("tao") || normalized.Contains("them") || normalized.Contains("lap"));
        }

        private static bool LooksLikeTenantCreateCommand(string normalized)
        {
            return (normalized.Contains("khach") || normalized.Contains("nguoi thue") || normalized.Contains("tenant"))
                && !normalized.Contains("hop dong")
                && (normalized.Contains("tao") || normalized.Contains("them"));
        }

        private static bool LooksLikeContractCreateCommand(string normalized)
        {
            return normalized.Contains("hop dong")
                && (normalized.Contains("tao") || normalized.Contains("them") || normalized.Contains("lap"));
        }

        private static bool LooksLikeInvoiceBulkCreateCommand(string normalized)
        {
            return normalized.Contains("hoa don")
                && (normalized.Contains("tao") || normalized.Contains("lap") || normalized.Contains("xuat"));
        }

        private static bool LooksLikeInvoiceBulkCreateAfterMeterCheckCommand(string normalized)
        {
            return LooksLikeInvoiceBulkCreateCommand(normalized)
                && (normalized.Contains("kiem tra")
                    || normalized.Contains("thieu dien")
                    || normalized.Contains("chua nhap dien")
                    || normalized.Contains("bao truoc")
                    || normalized.Contains("neu thieu")
                    || normalized.Contains("neu phong nao"));
        }

        private static bool LooksLikeRevenueReportQuery(string normalized)
        {
            return normalized.Contains("doanh thu") || normalized.Contains("tong thu");
        }

        private static bool LooksLikeExpenseReportQuery(string normalized)
        {
            return normalized.Contains("chi phi") || normalized.Contains("tong chi");
        }

        private static bool LooksLikeProfitLossReportQuery(string normalized)
        {
            return normalized.Contains("lai lo") || normalized.Contains("lo lai") || normalized.Contains("loi nhuan");
        }

        private static bool LooksLikeVacantRoomQuery(string normalized)
        {
            if (LooksLikeOccupiedRoomQuery(normalized))
            {
                return false;
            }

            return normalized.Contains("phong")
                && (normalized.Contains("trong") || normalized.Contains("chua cho thue") || normalized.Contains("con phong"));
        }

        private static bool LooksLikeMeterReadingQuery(string normalized)
        {
            var asksForValue = normalized.Contains("bao nhieu")
                || normalized.Contains("xem")
                || normalized.Contains("cho biet")
                || normalized.Contains("la may");
            var mentionsElectricity = normalized.Contains("chi so dien")
                || normalized.Contains("so dien")
                || normalized.Contains("cong to");
            var implicitPreviousMonthQuestion = (normalized.Contains("thang vua roi") || normalized.Contains("thang truoc"))
                && normalized.Contains("phong")
                && normalized.Contains("bao nhieu");

            return (mentionsElectricity && asksForValue) || implicitPreviousMonthQuestion;
        }

        private static bool LooksLikeOccupiedRoomQuery(string normalized)
        {
            return normalized.Contains("phong")
                && (normalized.Contains("khong con trong")
                    || normalized.Contains("khong trong")
                    || normalized.Contains("het trong")
                    || normalized.Contains("da thue")
                    || normalized.Contains("dang thue")
                    || Regex.IsMatch(normalized, @"\b(?:da|dang)\s+(?:duoc\s+)?cho thue\b")
                    || normalized.Contains("cho thue roi")
                    || normalized.Contains("co khach")
                    || normalized.Contains("co nguoi")
                    || normalized.Contains("da co khach"));
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
            if (rawRoom.Success)
            {
                return rawRoom.Groups[1].Value.ToUpperInvariant();
            }

            var normalizedCode = Regex.Match(normalized, @"\b([a-z]{1,4}\d{1,4}[a-z0-9\-]*)\b");
            return normalizedCode.Success ? normalizedCode.Groups[1].Value.ToUpperInvariant() : null;
        }

        private static DateOnly? ExtractMonth(string normalized)
        {
            if (normalized.Contains("thang vua roi") || normalized.Contains("thang truoc"))
            {
                return DateOnly.FromDateTime(DateTime.Today.AddMonths(-1)).AddDays(1 - DateTime.Today.AddMonths(-1).Day);
            }

            if (normalized.Contains("thang nay"))
            {
                return new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1);
            }

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

        private static (DateOnly From, DateOnly To)? ExtractMonthRange(string normalized)
        {
            var match = Regex.Match(
                normalized,
                @"tu\s+thang\s+(\d{1,2})(?:\s*(?:nam|/|-)\s*(\d{4}))?.*?den\s+thang\s+(\d{1,2})(?:\s*(?:nam|/|-)\s*(\d{4}))?");
            if (!match.Success
                || !int.TryParse(match.Groups[1].Value, out var fromMonth)
                || !int.TryParse(match.Groups[3].Value, out var toMonth)
                || fromMonth is < 1 or > 12
                || toMonth is < 1 or > 12)
            {
                return null;
            }

            var fallbackYear = int.TryParse(match.Groups[4].Value, out var toYear) ? toYear : DateTime.Now.Year;
            var fromYear = int.TryParse(match.Groups[2].Value, out var parsedFromYear) ? parsedFromYear : fallbackYear;
            return (new DateOnly(fromYear, fromMonth, 1), new DateOnly(fallbackYear, toMonth, 1));
        }

        private static DateOnly? ExtractExplicitDate(string normalized)
        {
            var dateMatch = Regex.Match(normalized, @"\b(\d{1,2})/(\d{1,2})(?:/(\d{4}))?\b");
            if (!dateMatch.Success)
            {
                dateMatch = Regex.Match(normalized, @"(?:ngay|tu|den)\s+(\d{1,2})(?:\s*/\s*|\s+thang\s+)(\d{1,2})(?:\s*/\s*|\s+nam\s+)?(\d{4})?");
            }

            if (!dateMatch.Success
                || !int.TryParse(dateMatch.Groups[1].Value, out var day)
                || !int.TryParse(dateMatch.Groups[2].Value, out var month))
            {
                return null;
            }

            var yearText = dateMatch.Groups.Count > 3 ? dateMatch.Groups[3].Value : string.Empty;
            var year = int.TryParse(yearText, out var parsedYear) ? parsedYear : DateTime.Now.Year;

            try
            {
                return new DateOnly(year, month, day);
            }
            catch
            {
                return null;
            }
        }

        private static int? ExtractCurrentReading(string normalized)
        {
            var explicitMatch = Regex.Match(normalized, @"(?:la|=|:)\s*(\d+)");
            if (explicitMatch.Success && int.TryParse(explicitMatch.Groups[1].Value, out var explicitValue))
            {
                return explicitValue;
            }

            var numbers = Regex.Matches(normalized, @"\b\d+\b")
                .Select(x => int.Parse(x.Value, CultureInfo.InvariantCulture))
                .Where(x => x > 31)
                .ToList();

            return numbers.Count == 0 ? null : numbers[^1];
        }

        private static decimal? ExtractMoneyAfterKeywords(string normalized, params string[] keywords)
        {
            foreach (var keyword in keywords)
            {
                var match = Regex.Match(normalized, $@"(?:{Regex.Escape(keyword)})\s*(?:la|=|:)?\s*(\d+(?:[.,]\d+)*)\s*(trieu|tr|k|nghin|ngan)?(\d+)?");
                if (match.Success && TryParseNaturalMoney(match.Groups[1].Value, match.Groups[2].Value, out var amount, match.Groups[3].Value))
                {
                    return amount;
                }
            }

            var fallback = Regex.Match(normalized, @"\b(\d+(?:[.,]\d+)*)\s*(trieu|tr|k|nghin|ngan)(\d+)?\b");
            return fallback.Success && TryParseNaturalMoney(fallback.Groups[1].Value, fallback.Groups[2].Value, out var fallbackAmount, fallback.Groups[3].Value)
                ? fallbackAmount
                : null;
        }

        private static bool TryParseNaturalMoney(string numberText, string unitText, out decimal amount, string? fractionalText = null)
        {
            amount = 0;
            var normalizedNumber = numberText.Replace(".", string.Empty).Replace(",", ".");
            if (!decimal.TryParse(normalizedNumber, NumberStyles.Number, CultureInfo.InvariantCulture, out var number))
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(fractionalText)
                && unitText is "trieu" or "tr"
                && decimal.TryParse(fractionalText, NumberStyles.None, CultureInfo.InvariantCulture, out var fraction))
            {
                number += fraction / (decimal)Math.Pow(10, fractionalText.Length);
            }

            amount = unitText switch
            {
                "trieu" or "tr" => number * 1_000_000,
                "k" or "nghin" or "ngan" => number * 1_000,
                _ => number
            };
            return true;
        }

        private static int? ExtractPeopleCount(string normalized)
        {
            var match = Regex.Match(normalized, @"(?:\b(\d+)\s*(?:nguoi|ng)\b|(?:so nguoi|nguoi o)\s*[:=\-]?\s*(\d+))");
            var value = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
            return match.Success && int.TryParse(value, out var count) ? count : null;
        }

        private static int? ExtractIdAfterKeywords(string normalized, params string[] keywords)
        {
            foreach (var keyword in keywords)
            {
                var match = Regex.Match(normalized, $@"(?:{Regex.Escape(keyword)})\s*(?:id\s*)?#?\s*(\d+)");
                if (match.Success && int.TryParse(match.Groups[1].Value, out var id))
                {
                    return id;
                }
            }

            return null;
        }

        private static string? ExtractPhone(string rawMessage)
        {
            var match = Regex.Match(rawMessage, @"(?<!\d)(0\d{8,10})(?!\d)");
            return match.Success ? match.Groups[1].Value : null;
        }

        private static string? ExtractPaymentCode(string rawMessage)
        {
            var match = Regex.Match(
                rawMessage,
                @"(?:mã\s+thanh\s+toán|ma\s+thanh\s+toan)\s*(?:là|la|:|=|#)?\s*([A-Za-z0-9][A-Za-z0-9._-]*)",
                RegexOptions.IgnoreCase);
            return match.Success ? match.Groups[1].Value.Trim() : null;
        }

        private static string? ExtractTenantName(string rawMessage)
        {
            var match = Regex.Match(
                rawMessage,
                @"(?:cho|khách|khach|người thuê|nguoi thue|người|nguoi)\s+([\p{L}][\p{L}\s.]*?)(?=\s+(?:từ|tu|ngày|ngay|giá|gia|với|voi|số|so|phòng|phong)\b|$)",
                RegexOptions.IgnoreCase);
            return match.Success ? CleanTenantReference(match.Groups[1].Value) : null;
        }

        private static string CleanTenantReference(string value)
        {
            return Regex.Replace(
                value.Trim(),
                @"^(?:(?:khách(?:\s+thuê)?|khach(?:\s+thue)?|người\s+thuê|nguoi\s+thue|anh|chị|chi|ông|ong|bà|ba|cô|co|chú|chu|em|bạn|ban)\s+)+",
                string.Empty,
                RegexOptions.IgnoreCase).Trim();
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
    }
}
