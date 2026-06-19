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

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AssistantCommandParser> _logger;
        private readonly AssistantActionRegistry _actionRegistry;
        private readonly AssistantLearningStore _learningStore;
        private readonly ICurrentUserService _currentUserService;

        public AssistantCommandParser(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<AssistantCommandParser> logger,
            AssistantActionRegistry actionRegistry,
            AssistantLearningStore learningStore,
            ICurrentUserService currentUserService)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _actionRegistry = actionRegistry;
            _learningStore = learningStore;
            _currentUserService = currentUserService;
        }

        public async Task<AssistantParseResult> ParseAsync(string message, AssistantCommandDto? context = null)
        {
            var aiCommand = await TryParseWithGeminiAsync(message, context);
            if (aiCommand != null)
            {
                _learningStore.ApplyValueAliases(_currentUserService.UserId, context?.Intent ?? aiCommand.Intent, message, aiCommand);

                if (context != null)
                {
                    FillMissingParamsFromRuleFragment(aiCommand, ParseWithRules(message, context));
                }

                Normalize(aiCommand);
                return new AssistantParseResult
                {
                    Command = aiCommand,
                    Parser = "gemini"
                };
            }

            var ruleCommand = ParseWithRules(message, context);
            _learningStore.ApplyValueAliases(_currentUserService.UserId, context?.Intent ?? ruleCommand.Intent, message, ruleCommand);
            Normalize(ruleCommand);

            return new AssistantParseResult
            {
                Command = ruleCommand,
                Parser = "rule"
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
                                new { text = $"{BuildParserInstructions(context)}\n\nUser request: {message}" }
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

        private string BuildParserInstructions(AssistantCommandDto? context)
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
Supported action catalog:
{_actionRegistry.BuildPromptCatalog()}

User-specific correction history:
{_learningStore.BuildPromptLessons(_currentUserService.UserId)}

Return only fields in the schema.
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
                required = new[] { "intent", "params", "missingFields", "requiresConfirmation" },
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
                    requiresConfirmation = new { type = "boolean" }
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
                return followUpCommand;
            }

            if (LooksLikeMeterReadingCommand(normalized))
            {
                var command = CreateCommand(AssistantActionRegistry.MeterReadingCreate, requiresConfirmation: true);
                FillCommonParams(command, rawMessage, normalized);
                FillIntentSpecificParams(command, normalized, command.Intent);
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
            return command;
        }

        public AssistantCommandDto Normalize(AssistantCommandDto command)
        {
            command.Intent = string.IsNullOrWhiteSpace(command.Intent) ? AssistantActionRegistry.AssistantUnknown : command.Intent.Trim();
            command.Params ??= new Dictionary<string, string?>();
            command.MissingFields ??= new List<string>();

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
                return command;
            }

            command.RequiresConfirmation = action.RequiresConfirmation;
            command.MissingFields.Clear();
            AddMissing(command, action.RequiredFields);

            if (!action.CanExecute)
            {
                command.RequiresConfirmation = false;
            }

            return command;
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
                RequiresConfirmation = requiresConfirmation
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

            var explicitDate = ExtractExplicitDate(normalized);
            if (explicitDate.HasValue)
            {
                SetParam(command, "startDate", explicitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "actualEndDate", explicitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                SetParam(command, "transactionDate", explicitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }

            SetParam(command, "phone", ExtractPhone(rawMessage));
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
            FillIdAndCountFields(command, context, numbers);
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
            foreach (var field in new[] { "listedPrice", "actualRoomPrice", "depositAmount", "discountAmount", "debtAmount", "amount" })
            {
                if (!context.MissingFields.Contains(field) || !string.IsNullOrWhiteSpace(GetParam(command, field)))
                {
                    continue;
                }

                var value = money ?? numbers.LastOrDefault(x => x > 0);
                if (value > 0)
                {
                    SetParam(command, field, value.ToString(CultureInfo.InvariantCulture));
                }
            }
        }

        private static void FillIdAndCountFields(AssistantCommandDto command, AssistantCommandDto context, IReadOnlyList<int> numbers)
        {
            foreach (var field in new[] { "invoiceId", "contractId", "tenantId", "occupantCount", "currentReading" })
            {
                if (!context.MissingFields.Contains(field) || !string.IsNullOrWhiteSpace(GetParam(command, field)))
                {
                    continue;
                }

                var value = field == "occupantCount"
                    ? numbers.FirstOrDefault(x => x > 0 && x <= 30)
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

            if (context.MissingFields.Contains("roomCode") && string.IsNullOrWhiteSpace(GetParam(command, "roomCode")))
            {
                SetParam(command, "roomCode", text);
            }

            if (context.MissingFields.Contains("tenantName") && string.IsNullOrWhiteSpace(GetParam(command, "tenantName")))
            {
                SetParam(command, "tenantName", text);
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
            var match = Regex.Match(normalized, @"\b(\d+(?:[.,]\d+)*)\s*(trieu|k|nghin|ngan)?\b");
            return match.Success && TryParseNaturalMoney(match.Groups[1].Value, match.Groups[2].Value, out var amount)
                ? amount
                : null;
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
                && (normalized.Contains("tao") || normalized.Contains("them") || normalized.Contains("lap"));
        }

        private static bool LooksLikeTenantCreateCommand(string normalized)
        {
            return (normalized.Contains("khach") || normalized.Contains("nguoi thue") || normalized.Contains("tenant"))
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
            if (rawRoom.Success)
            {
                return rawRoom.Groups[1].Value.ToUpperInvariant();
            }

            var normalizedCode = Regex.Match(normalized, @"\b([a-z]{1,4}\d{1,4}[a-z0-9\-]*)\b");
            return normalizedCode.Success ? normalizedCode.Groups[1].Value.ToUpperInvariant() : null;
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
                var match = Regex.Match(normalized, $@"(?:{Regex.Escape(keyword)})\s*(?:la|=|:)?\s*(\d+(?:[.,]\d+)*)\s*(trieu|k|nghin|ngan)?");
                if (match.Success && TryParseNaturalMoney(match.Groups[1].Value, match.Groups[2].Value, out var amount))
                {
                    return amount;
                }
            }

            var fallback = Regex.Match(normalized, @"\b(\d+(?:[.,]\d+)*)\s*(trieu|k|nghin|ngan)\b");
            return fallback.Success && TryParseNaturalMoney(fallback.Groups[1].Value, fallback.Groups[2].Value, out var fallbackAmount)
                ? fallbackAmount
                : null;
        }

        private static bool TryParseNaturalMoney(string numberText, string unitText, out decimal amount)
        {
            amount = 0;
            var normalizedNumber = numberText.Replace(".", string.Empty).Replace(",", ".");
            if (!decimal.TryParse(normalizedNumber, NumberStyles.Number, CultureInfo.InvariantCulture, out var number))
            {
                return false;
            }

            amount = unitText switch
            {
                "trieu" => number * 1_000_000,
                "k" or "nghin" or "ngan" => number * 1_000,
                _ => number
            };
            return true;
        }

        private static int? ExtractPeopleCount(string normalized)
        {
            var match = Regex.Match(normalized, @"\b(\d+)\s*(?:nguoi|ng)\b");
            return match.Success && int.TryParse(match.Groups[1].Value, out var count) ? count : null;
        }

        private static int? ExtractIdAfterKeywords(string normalized, params string[] keywords)
        {
            foreach (var keyword in keywords)
            {
                var match = Regex.Match(normalized, $@"(?:{Regex.Escape(keyword)})\s*#?\s*(\d+)");
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
