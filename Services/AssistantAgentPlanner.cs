using System.Globalization;
using System.Text;
using System.Text.Json;
using NhaTro.Dtos.Assistant;
using NhaTro.Interfaces.Services;

namespace NhaTro.Services
{
    public class AssistantAgentPlanner
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AssistantAgentPlanner> _logger;
        private readonly AssistantToolRegistry _toolRegistry;
        private readonly IAssistantCommandParser _commandParser;
        private readonly AssistantLearningStore _learningStore;

        public AssistantAgentPlanner(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<AssistantAgentPlanner> logger,
            AssistantToolRegistry toolRegistry,
            IAssistantCommandParser commandParser,
            AssistantLearningStore learningStore)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _toolRegistry = toolRegistry;
            _commandParser = commandParser;
            _learningStore = learningStore;
        }

        public virtual async Task<AssistantAgentPlanDto> PlanAsync(string message, int userId)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return new AssistantAgentPlanDto
                {
                    Goal = "No request",
                    Summary = "User did not provide a request.",
                    MissingInformation = { "message" },
                    Confidence = 0,
                    Reason = "Empty message.",
                    Planner = "fallback"
                };
            }

            var deterministicCommand = AssistantCommandParser.ParseWithRules(message);
            _commandParser.Normalize(deterministicCommand);
            if (deterministicCommand.Intent != AssistantActionRegistry.AssistantUnknown)
            {
                deterministicCommand.Confidence = Math.Max(deterministicCommand.Confidence, 0.9);
                deterministicCommand.Reason = $"Deterministic rule matched {deterministicCommand.Intent}.";
                return BuildSingleStepPlan(deterministicCommand, message, "rule_first");
            }

            if (!LooksLikeMultiStepRequest(message))
            {
                var semanticParse = await _commandParser.ParseAsync(message);
                if (semanticParse.Command.Intent != AssistantActionRegistry.AssistantUnknown
                    && semanticParse.Command.Confidence >= 0.55)
                {
                    return BuildSingleStepPlan(semanticParse.Command, message, semanticParse.Parser);
                }
            }

            var geminiPlan = await TryPlanWithGeminiAsync(message, userId);
            if (geminiPlan != null)
            {
                return NormalizePlan(geminiPlan, "gemini");
            }

            return await BuildFallbackPlanAsync(message);
        }

        private async Task<AssistantAgentPlanDto?> TryPlanWithGeminiAsync(string message, int userId)
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
                                new { text = $"{BuildPlannerInstructions(userId)}\n\nUser request: {message}" }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0,
                        responseMimeType = "application/json",
                        responseSchema = BuildPlanSchema()
                    }
                };

                request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
                using var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var errorText = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini planner failed with status {StatusCode}: {Error}", response.StatusCode, errorText);
                    return null;
                }

                var jsonText = await response.Content.ReadAsStringAsync();
                var outputText = ExtractGeminiOutputText(jsonText);
                return string.IsNullOrWhiteSpace(outputText)
                    ? null
                    : JsonSerializer.Deserialize<AssistantAgentPlanDto>(outputText, JsonOptions);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini planner failed. Falling back to single-step planner.");
                return null;
            }
        }

        private async Task<AssistantAgentPlanDto> BuildFallbackPlanAsync(string message)
        {
            var parseResult = await _commandParser.ParseAsync(message);
            return BuildSingleStepPlan(parseResult.Command, message, parseResult.Parser);
        }

        private AssistantAgentPlanDto BuildSingleStepPlan(AssistantCommandDto command, string message, string planner)
        {
            _toolRegistry.TryGet(command.Intent, out var tool);

            var plan = new AssistantAgentPlanDto
            {
                Goal = message.Trim(),
                Summary = message.Trim(),
                MissingInformation = command.MissingFields.ToList(),
                RequiresConfirmation = tool?.RequiresConfirmation ?? command.RequiresConfirmation,
                RiskLevel = tool?.RiskLevel ?? AssistantToolRiskLevels.Low,
                Confidence = command.Confidence,
                Reason = $"Single-step plan from {planner}: {command.Reason}",
                Planner = planner
            };

            if (tool != null)
            {
                plan.Steps.Add(new AssistantAgentPlanStepDto
                {
                    StepNumber = 1,
                    Tool = tool.Name,
                    Intent = tool.Intent,
                    Args = command.Params.ToDictionary(x => x.Key, x => x.Value),
                    Purpose = message.Trim(),
                    RequiresConfirmation = tool.RequiresConfirmation,
                    RiskLevel = tool.RiskLevel
                });
            }

            return NormalizePlan(plan, planner);
        }

        private AssistantAgentPlanDto NormalizePlan(AssistantAgentPlanDto plan, string planner)
        {
            plan.Goal = string.IsNullOrWhiteSpace(plan.Goal) ? "Handle user request" : plan.Goal.Trim();
            plan.Summary = string.IsNullOrWhiteSpace(plan.Summary) ? "Planner created a tool execution plan." : plan.Summary.Trim();
            plan.Planner = planner;
            plan.Confidence = double.IsFinite(plan.Confidence) ? Math.Clamp(plan.Confidence, 0, 1) : 0;
            plan.Reason = string.IsNullOrWhiteSpace(plan.Reason) ? "No planner reason provided." : plan.Reason.Trim();
            plan.MissingInformation ??= new List<string>();
            plan.Steps ??= new List<AssistantAgentPlanStepDto>();

            var maxRisk = AssistantToolRiskLevels.Low;
            var requiresConfirmation = false;

            for (var i = 0; i < plan.Steps.Count; i++)
            {
                var step = plan.Steps[i];
                step.StepNumber = step.StepNumber <= 0 ? i + 1 : step.StepNumber;
                step.Tool = string.IsNullOrWhiteSpace(step.Tool) ? step.Intent : step.Tool.Trim();
                step.Intent = string.IsNullOrWhiteSpace(step.Intent) ? step.Tool : step.Intent.Trim();
                step.Args ??= new Dictionary<string, string?>();
                step.DependsOn ??= new List<int>();
                step.Purpose = string.IsNullOrWhiteSpace(step.Purpose) ? "Run tool." : step.Purpose.Trim();
                step.Condition = string.IsNullOrWhiteSpace(step.Condition) ? "always" : step.Condition.Trim();
                step.StopIf = string.IsNullOrWhiteSpace(step.StopIf) ? "never" : step.StopIf.Trim();

                if (_toolRegistry.TryGet(step.Tool, out var tool))
                {
                    step.Intent = tool.Intent;
                    step.RequiresConfirmation = tool.RequiresConfirmation;
                    step.RiskLevel = tool.RiskLevel;
                    foreach (var parameter in tool.Parameters)
                    {
                        if (!step.Args.ContainsKey(parameter.Name))
                        {
                            step.Args[parameter.Name] = null;
                        }
                    }
                }

                if (step.RequiresConfirmation)
                {
                    requiresConfirmation = true;
                }

                maxRisk = MaxRisk(maxRisk, step.RiskLevel);
            }

            plan.RequiresConfirmation = plan.RequiresConfirmation || requiresConfirmation;
            plan.RiskLevel = string.IsNullOrWhiteSpace(plan.RiskLevel) ? maxRisk : MaxRisk(plan.RiskLevel, maxRisk);
            return plan;
        }

        private string BuildPlannerInstructions(int userId)
        {
            var today = DateTime.Now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            return $"""
You are an AI agent planner for a Vietnamese room-rental management system.
Today's date is {today}.

Your job is to create a tool execution plan, not execute it.
Use only tools listed in the tool catalog.
Plan at most 6 steps.
Use a single step for simple requests.
Use multiple steps when the user goal requires checking data before writing, finding IDs before updating, validating missing readings before creating invoices, or combining report/search operations.
For each step, provide tool name, args, purpose, condition, stopIf, dependencies, risk, and confirmation metadata.
Use yyyy-MM-dd for dates and the first day of the month for month values.
If the user omits year, use the year from today's date.
Do not invent IDs, room codes, tenant names, readings, or money amounts.
Put unknown required inputs in missingInformation and leave corresponding args empty.
High-risk or write tools must set requiresConfirmation true at either plan or step level.

Tool catalog:
{_toolRegistry.BuildPromptCatalog()}

User-specific correction history:
{_learningStore.BuildPromptLessons(userId)}

Return JSON only.
""";
        }

        private object BuildPlanSchema()
        {
            return new
            {
                type = "object",
                additionalProperties = false,
                required = new[] { "goal", "summary", "steps", "missingInformation", "requiresConfirmation", "riskLevel", "confidence", "reason" },
                properties = new
                {
                    goal = new { type = "string" },
                    summary = new { type = "string" },
                    steps = new
                    {
                        type = "array",
                        items = new
                        {
                            type = "object",
                            additionalProperties = false,
                            required = new[] { "stepNumber", "tool", "intent", "args", "purpose", "condition", "stopIf", "dependsOn", "requiresConfirmation", "riskLevel" },
                            properties = new
                            {
                                stepNumber = new { type = "integer" },
                                tool = new { type = "string", @enum = _toolRegistry.Tools.Select(x => x.Name).ToArray() },
                                intent = new { type = "string", @enum = _toolRegistry.Tools.Select(x => x.Intent).ToArray() },
                                args = new
                                {
                                    type = "object",
                                    additionalProperties = false,
                                    required = AssistantActionRegistry.ParamKeys,
                                    properties = AssistantActionRegistry.ParamKeys.ToDictionary(
                                        key => key,
                                        _ => new { type = "string" })
                                },
                                purpose = new { type = "string" },
                                condition = new { type = "string" },
                                stopIf = new { type = "string" },
                                dependsOn = new
                                {
                                    type = "array",
                                    items = new { type = "integer" }
                                },
                                requiresConfirmation = new { type = "boolean" },
                                riskLevel = new { type = "string", @enum = new[] { AssistantToolRiskLevels.Low, AssistantToolRiskLevels.Medium, AssistantToolRiskLevels.High } }
                            }
                        }
                    },
                    missingInformation = new
                    {
                        type = "array",
                        items = new { type = "string" }
                    },
                    requiresConfirmation = new { type = "boolean" },
                    riskLevel = new { type = "string", @enum = new[] { AssistantToolRiskLevels.Low, AssistantToolRiskLevels.Medium, AssistantToolRiskLevels.High } },
                    confidence = new { type = "number" },
                    reason = new { type = "string" }
                }
            };
        }

        private string? GetGeminiApiKey()
        {
            return _configuration["Gemini:ApiKey"]
                ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
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

        private static string MaxRisk(string left, string right)
        {
            return RiskRank(left) >= RiskRank(right) ? left : right;
        }

        private static bool LooksLikeMultiStepRequest(string message)
        {
            var normalized = message.ToLowerInvariant();
            return normalized.Contains(" rồi ")
                || normalized.Contains(" sau đó ")
                || normalized.Contains(" nếu ")
                || normalized.Contains(" trước khi ")
                || normalized.Contains(" đồng thời ")
                || normalized.Contains(" và tạo ")
                || normalized.Contains(" và cập nhật ")
                || normalized.Contains(" và xóa ");
        }

        private static int RiskRank(string risk)
        {
            return risk switch
            {
                AssistantToolRiskLevels.High => 3,
                AssistantToolRiskLevels.Medium => 2,
                _ => 1
            };
        }
    }
}
