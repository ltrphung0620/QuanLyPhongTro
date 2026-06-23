using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Globalization;
using NhaTro.Dtos.Assistant;
using NhaTro.Interfaces.Services;
using NhaTro.Services;

namespace NhaTro.Tests
{
    public class AgentFlowContractTests
    {
        [Fact]
        public void ToolRegistry_ShouldCoverEveryExecutableAction()
        {
            var actions = new AssistantActionRegistry();
            var tools = new AssistantToolRegistry(actions);
            var expected = actions.Actions
                .Where(x => x.Intent != AssistantActionRegistry.AssistantUnknown)
                .Select(x => x.Intent)
                .OrderBy(x => x)
                .ToArray();
            var actual = tools.Tools.Select(x => x.Intent).OrderBy(x => x).ToArray();

            Assert.Equal(expected, actual);
            Assert.All(tools.Tools, tool => Assert.True(tool.CanExecute));
        }

        [Fact]
        public void ContractParser_ShouldStripTenantRolePrefix()
        {
            var command = AssistantCommandParser.ParseWithRules("tạo hợp đồng cho khách Nam phòng A2");

            Assert.Equal("Nam", command.Params["tenantName"]);
        }

        [Fact]
        public void ContractParser_ShouldSeparateRequiredAndPaidDeposit()
        {
            var command = AssistantCommandParser.ParseWithRules(
                "tạo hợp đồng phòng A1 cho Hùng từ 1/7 giá 2tr5 cọc 2tr5 đã đưa 2tr 2 người");

            Assert.Equal(2_500_000m, decimal.Parse(command.Params["depositAmount"]!, CultureInfo.InvariantCulture));
            Assert.Equal(2_000_000m, decimal.Parse(command.Params["depositPaidAmount"]!, CultureInfo.InvariantCulture));
        }

        [Theory]
        [InlineData("tạo hóa đơn tháng 10 cho phòng A1", AssistantActionRegistry.InvoicesCreate)]
        [InlineData("xem thông tin khách Hùng", AssistantActionRegistry.TenantsFind)]
        [InlineData("danh sách chỉ số điện tháng 10", AssistantActionRegistry.MeterReadingsFindAll)]
        [InlineData("xem giao dịch ID 15", AssistantActionRegistry.TransactionsFindById)]
        [InlineData("xem chuyển khoản ngân hàng ID 5", AssistantActionRegistry.PaymentsFindById)]
        [InlineData("xem phòng ID 3", AssistantActionRegistry.RoomsFindById)]
        [InlineData("xem hợp đồng ID 5", AssistantActionRegistry.ContractsFindById)]
        [InlineData("xem hóa đơn ID 12", AssistantActionRegistry.InvoicesFindById)]
        [InlineData("xem chỉ số điện ID 8", AssistantActionRegistry.MeterReadingsFindById)]
        [InlineData("xóa toàn bộ chỉ số điện hợp đồng đã kết thúc phòng A1", AssistantActionRegistry.MeterReadingsDeleteByEndedContract)]
        public void ExtendedBusinessParser_ShouldRecognizeNewActions(string message, string expectedIntent)
        {
            var command = AssistantCommandParser.ParseWithRules(message);

            Assert.Equal(expectedIntent, command.Intent);
        }

        [Fact]
        public void SalesLedgerParser_ShouldExtractMonthRange()
        {
            var command = AssistantCommandParser.ParseWithRules("xem sổ doanh thu từ tháng 1 đến tháng 6 năm 2026");

            Assert.Equal(AssistantActionRegistry.ReportsSalesLedger, command.Intent);
            Assert.Equal("2026-01-01", command.Params["fromMonth"]);
            Assert.Equal("2026-06-01", command.Params["toMonth"]);
        }

        [Fact]
        public void InvoicePaymentCodeParser_ShouldExtractCode()
        {
            var command = AssistantCommandParser.ParseWithRules("tra hóa đơn mã thanh toán HD-A1-202610");

            Assert.Equal(AssistantActionRegistry.InvoicesFindByPaymentCode, command.Intent);
            Assert.Equal("HD-A1-202610", command.Params["paymentCode"]);
        }

        [Fact]
        public void TenantMatcher_ShouldMatchShortNameWithoutAccentsOrRolePrefix()
        {
            var tenants = new[]
            {
                new NhaTro.Dtos.Tenants.TenantDto { TenantId = 1, FullName = "Nguyễn Văn Nam" },
                new NhaTro.Dtos.Tenants.TenantDto { TenantId = 2, FullName = "Trần Thị Hùng" }
            };

            var matches = AssistantTenantMatcher.FindMatches(tenants, "khách nam");

            Assert.Single(matches);
            Assert.Equal(1, matches[0].TenantId);
        }

        [Fact]
        public void TenantMatcher_ShouldNotGuessWhenShortNameIsAmbiguous()
        {
            var tenants = new[]
            {
                new NhaTro.Dtos.Tenants.TenantDto { TenantId = 1, FullName = "Nguyễn Văn Nam" },
                new NhaTro.Dtos.Tenants.TenantDto { TenantId = 2, FullName = "Trần Hoàng Nam" }
            };

            var matches = AssistantTenantMatcher.FindMatches(tenants, "Nam");

            Assert.Equal(2, matches.Count);
        }

        [Fact]
        public void SafetyPolicy_ShouldRequireStrongConfirmationForEveryHighRiskTool()
        {
            var tools = new AssistantToolRegistry(new AssistantActionRegistry());
            var highRiskTools = tools.Tools
                .Where(x => x.RiskLevel == AssistantToolRiskLevels.High)
                .ToList();

            Assert.NotEmpty(highRiskTools);
            Assert.All(highRiskTools, tool =>
            {
                Assert.True(tool.RequiresConfirmation);
                Assert.True(tool.RequiresStrongConfirmation);
            });
            Assert.All(tools.Tools.Where(x => x.Mode == AssistantToolModes.Write), tool => Assert.True(tool.RequiresConfirmation));
        }

        [Fact]
        public void MissingFeatureCatalog_ShouldBeFullyRegistered()
        {
            var tools = new AssistantToolRegistry(new AssistantActionRegistry());
            var expected = new[]
            {
                AssistantActionRegistry.RoomsUpdate,
                AssistantActionRegistry.RoomsUpdateStatus,
                AssistantActionRegistry.TenantsUpdate,
                AssistantActionRegistry.ContractsUpdate,
                AssistantActionRegistry.ContractsCancel,
                AssistantActionRegistry.ContractsDeleteEnded,
                AssistantActionRegistry.MeterReadingsUpdate,
                AssistantActionRegistry.MeterReadingsDelete,
                AssistantActionRegistry.InvoicesMarkUnpaid,
                AssistantActionRegistry.InvoicesUpdateElectricity,
                AssistantActionRegistry.InvoicesReplace,
                AssistantActionRegistry.InvoicesUpdate,
                AssistantActionRegistry.InvoicesDelete,
                AssistantActionRegistry.InvoicesDownloadPdf,
                AssistantActionRegistry.TransactionsUpdate,
                AssistantActionRegistry.TransactionsDelete,
                AssistantActionRegistry.PaymentsFind,
                AssistantActionRegistry.PaymentsReconcile,
                AssistantActionRegistry.PaymentsDelete
            };

            Assert.All(expected, intent => Assert.True(tools.TryGet(intent, out var tool) && tool.CanExecute, intent));
        }

        [Fact]
        public void TrainingCorpus_ShouldContainOneHundredDistinctPhrasesForEveryAction()
        {
            var actions = new AssistantActionRegistry();
            var catalog = new AssistantTrainingPhraseCatalog();

            foreach (var action in actions.Actions.Where(x => x.CanExecute))
            {
                var phrases = catalog.GetPhrases(action.Intent, action.Examples);
                Assert.Equal(AssistantTrainingPhraseCatalog.PhrasesPerAction, phrases.Count);
                Assert.Equal(AssistantTrainingPhraseCatalog.PhrasesPerAction, phrases.Distinct(StringComparer.OrdinalIgnoreCase).Count());
            }
        }

        [Fact]
        public void LocalSemanticMatcher_ShouldGeneralizeAOneWordRoomSynonym()
        {
            var actions = new AssistantActionRegistry();
            var matcher = new AssistantLocalIntentMatcher(actions, new AssistantTrainingPhraseCatalog());

            var matched = matcher.TryMatch("phòng nào đã cho mướn", out var intent, out var confidence);

            Assert.True(matched);
            Assert.Equal(AssistantActionRegistry.RoomsFindOccupied, intent);
            Assert.True(confidence >= 0.66);
        }

        [Fact]
        public void LocalSemanticMatcher_ShouldRejectUnrelatedAmbiguousText()
        {
            var actions = new AssistantActionRegistry();
            var matcher = new AssistantLocalIntentMatcher(actions, new AssistantTrainingPhraseCatalog());

            var matched = matcher.TryMatch("xin xử lý việc này", out _, out _);

            Assert.False(matched);
        }

        [Fact]
        public void MeterReadingQuestionWithoutMonth_ShouldSelectReadAction()
        {
            var command = AssistantCommandParser.ParseWithRules("chỉ số điện phòng A1 là bao nhiêu");

            Assert.Equal(AssistantActionRegistry.MeterReadingsFind, command.Intent);
            Assert.Equal("A1", command.Params["roomCode"]);
            Assert.False(command.Params.ContainsKey("currentReading"));
        }

        [Fact]
        public void PreviousMonthRoomQuestion_ShouldSelectReadActionAndResolveMonth()
        {
            var command = AssistantCommandParser.ParseWithRules("tháng vừa rồi phòng A1 là bao nhiêu");
            var previousMonth = new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-1);

            Assert.Equal(AssistantActionRegistry.MeterReadingsFind, command.Intent);
            Assert.Equal(previousMonth.ToString("yyyy-MM-dd"), command.Params["billingMonth"]);
        }

        [Fact]
        public void ContractCreateRule_ShouldExtractTenantFromCompleteSentence()
        {
            var command = AssistantCommandParser.ParseWithRules("tạo hợp đồng phòng A1 cho Hùng từ 1/7 giá 3tr 2 người");

            Assert.Equal(AssistantActionRegistry.ContractsCreate, command.Intent);
            Assert.Equal("A1", command.Params["roomCode"]);
            Assert.Equal("Hùng", command.Params["tenantName"]);
            Assert.Equal("3000000", command.Params["actualRoomPrice"]);
            Assert.Equal("2", command.Params["occupantCount"]);
        }

        [Fact]
        public void ContractCreateFollowUps_ShouldAssignRoomAndTenantSeparately()
        {
            var context = new AssistantCommandDto
            {
                Intent = AssistantActionRegistry.ContractsCreate,
                RequiresConfirmation = true,
                MissingFields = new List<string> { "roomCode", "tenantName", "startDate", "actualRoomPrice", "occupantCount" }
            };

            var roomFragment = AssistantCommandParser.ParseWithRules("A1", context);
            var tenantFragment = AssistantCommandParser.ParseWithRules("Hùng", context);

            Assert.Equal("A1", roomFragment.Params["roomCode"]);
            Assert.False(roomFragment.Params.ContainsKey("tenantName"));
            Assert.Equal("Hùng", tenantFragment.Params["tenantName"]);
            Assert.False(tenantFragment.Params.ContainsKey("roomCode"));
        }

        [Theory]
        [InlineData("1/7", "startDate")]
        [InlineData("3tr", "actualRoomPrice")]
        [InlineData("2 người", "occupantCount")]
        public void ContractCreateFollowUps_ShouldFillExpectedField(string message, string expectedField)
        {
            var context = new AssistantCommandDto
            {
                Intent = AssistantActionRegistry.ContractsCreate,
                RequiresConfirmation = true,
                MissingFields = new List<string> { "startDate", "actualRoomPrice", "occupantCount" }
            };

            var fragment = AssistantCommandParser.ParseWithRules(message, context);

            Assert.True(fragment.Params.ContainsKey(expectedField));
            Assert.Single(fragment.Params, x => x.Key is "startDate" or "actualRoomPrice" or "occupantCount");
        }

        [Fact]
        public void ContractDateFollowUp_ShouldNotTreatYearAsRoomPrice()
        {
            var context = new AssistantCommandDto
            {
                Intent = AssistantActionRegistry.ContractsCreate,
                RequiresConfirmation = true,
                MissingFields = new List<string> { "startDate", "actualRoomPrice", "occupantCount" }
            };

            var fragment = AssistantCommandParser.ParseWithRules("21/06/2026", context);

            Assert.Equal("2026-06-21", fragment.Params["startDate"]);
            Assert.False(fragment.Params.ContainsKey("actualRoomPrice"));
            Assert.False(fragment.Params.ContainsKey("occupantCount"));
        }

        [Fact]
        public void ContractCreate_ShouldUnderstandMultilineFieldsInAnyOrder()
        {
            const string message = """
                Số người: 2
                Giá thuê: 3tr
                Tạo hợp đồng
                Khách thuê: Hùng
                Phòng: A1
                Ngày bắt đầu: 1/7
                """;

            var command = AssistantCommandParser.ParseWithRules(message);

            Assert.Equal(AssistantActionRegistry.ContractsCreate, command.Intent);
            Assert.Equal("A1", command.Params["roomCode"]);
            Assert.Equal("Hùng", command.Params["tenantName"]);
            Assert.Equal("3000000", command.Params["actualRoomPrice"]);
            Assert.Equal("2", command.Params["occupantCount"]);
            Assert.Equal(new DateOnly(DateTime.Today.Year, 7, 1).ToString("yyyy-MM-dd"), command.Params["startDate"]);
        }

        [Fact]
        public void MeterReadingCreate_ShouldUnderstandMultilineFields()
        {
            const string message = """
                Nhập điện
                Phòng: A1
                Tháng: 10
                Chỉ số điện: 1000
                """;

            var command = AssistantCommandParser.ParseWithRules(message);

            Assert.Equal(AssistantActionRegistry.MeterReadingCreate, command.Intent);
            Assert.Equal("A1", command.Params["roomCode"]);
            Assert.Equal("1000", command.Params["currentReading"]);
            Assert.Equal(new DateOnly(DateTime.Today.Year, 10, 1).ToString("yyyy-MM-dd"), command.Params["billingMonth"]);
        }

        [Theory]
        [InlineData("doi gia phong A1 thanh 2.8 trieu", AssistantActionRegistry.RoomsUpdate)]
        [InlineData("phòng nào còn trống", AssistantActionRegistry.RoomsFindVacant)]
        [InlineData("phòng nào đã thuê", AssistantActionRegistry.RoomsFindOccupied)]
        [InlineData("huy hop dong phong A1 ly do khach chuyen di", AssistantActionRegistry.ContractsCancel)]
        [InlineData("xoa so dien thang 10 cua phong A1", AssistantActionRegistry.MeterReadingsDelete)]
        [InlineData("tai PDF hoa don phong A1 thang 10", AssistantActionRegistry.InvoicesDownloadPdf)]
        [InlineData("xoa giao dich ngan hang ID 8", AssistantActionRegistry.PaymentsDelete)]
        public void RuleFallback_ShouldRecognizeExtendedManagementActions(string message, string expectedIntent)
        {
            var command = AssistantCommandParser.ParseWithRules(message);

            Assert.Equal(expectedIntent, command.Intent);
        }

        [Theory]
        [InlineData("phòng nào đã thuê")]
        [InlineData("phòng nào đã cho thuê")]
        [InlineData("phòng nào đã được cho thuê")]
        [InlineData("phòng nào đang cho thuê")]
        [InlineData("phòng nào cho thuê rồi")]
        public void OccupiedRoomSynonyms_ShouldSelectTheSameAction(string message)
        {
            var command = AssistantCommandParser.ParseWithRules(message);

            Assert.Equal(AssistantActionRegistry.RoomsFindOccupied, command.Intent);
        }

        [Fact]
        public void RuleFallback_ShouldExtractIdWrittenAfterIdKeyword()
        {
            var command = AssistantCommandParser.ParseWithRules("xoa giao dich ngan hang ID 8");

            Assert.Equal("8", command.Params["paymentTransactionId"]);
        }

        [Fact]
        public async Task PlannerRuleFirst_ShouldReturnARegisteredRealTool()
        {
            var actions = new AssistantActionRegistry();
            var tools = new AssistantToolRegistry(actions);
            var parser = new Mock<IAssistantCommandParser>();
            parser.Setup(x => x.ParseAsync(It.IsAny<string>(), It.IsAny<AssistantCommandDto?>()))
                .ReturnsAsync(new AssistantParseResult
                {
                    Parser = "test",
                    Command = new AssistantCommandDto
                    {
                        Intent = AssistantActionRegistry.AssistantUnknown,
                        Confidence = 0.1,
                        Reason = "simulated stale learned result"
                    }
                });

            var environment = new Mock<IWebHostEnvironment>();
            environment.Setup(x => x.ContentRootPath).Returns(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N")));
            var planner = new AssistantAgentPlanner(
                new HttpClient(),
                new ConfigurationBuilder().Build(),
                Mock.Of<ILogger<AssistantAgentPlanner>>(),
                tools,
                parser.Object,
                new AssistantLearningStore(environment.Object),
                Mock.Of<ICurrentUserService>());

            var plan = await planner.PlanAsync("phong nao con trong", userId: 7);

            var step = Assert.Single(plan.Steps);
            Assert.Equal(AssistantActionRegistry.RoomsFindVacant, step.Tool);
            Assert.True(tools.TryGet(step.Tool, out _));
            Assert.Equal("rule_first", plan.Planner);
        }

        [Fact]
        public async Task PlannerUnknownFallback_ShouldNotCreateAnUnregisteredToolStep()
        {
            var actions = new AssistantActionRegistry();
            var tools = new AssistantToolRegistry(actions);
            var parser = new Mock<IAssistantCommandParser>();
            parser.Setup(x => x.ParseAsync(It.IsAny<string>(), It.IsAny<AssistantCommandDto?>()))
                .ReturnsAsync(new AssistantParseResult
                {
                    Parser = "rule",
                    Command = new AssistantCommandDto
                    {
                        Intent = AssistantActionRegistry.AssistantUnknown,
                        Confidence = 0.1,
                        Reason = "unsupported"
                    }
                });
            parser.Setup(x => x.Normalize(It.IsAny<AssistantCommandDto>()))
                .Returns<AssistantCommandDto>(command => command);
            var environment = new Mock<IWebHostEnvironment>();
            environment.Setup(x => x.ContentRootPath).Returns(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N")));
            var planner = new AssistantAgentPlanner(
                new HttpClient(),
                new ConfigurationBuilder().Build(),
                Mock.Of<ILogger<AssistantAgentPlanner>>(),
                tools,
                parser.Object,
                new AssistantLearningStore(environment.Object),
                Mock.Of<ICurrentUserService>());

            var plan = await planner.PlanAsync("một yêu cầu hoàn toàn không thuộc hệ thống", userId: 7);

            Assert.Empty(plan.Steps);
            Assert.Equal("rule", plan.Planner);
        }

        [Fact]
        public void AgentState_ShouldRoundTripAndClearPerUser()
        {
            var store = new AssistantAgentStateStore();
            var plan = new AssistantAgentPlanDto
            {
                Goal = "test",
                Steps = { new AssistantAgentPlanStepDto { StepNumber = 1, Tool = AssistantActionRegistry.RoomsFindAll } }
            };
            var execution = new AssistantAgentExecutionDto
            {
                StateId = "state-1",
                Plan = plan,
                NextStepNumber = 1
            };

            store.Set(9, plan, execution, 1, "test request");

            Assert.True(store.TryGet(9, out var state));
            Assert.NotNull(state);
            Assert.Equal("state-1", state!.Execution.StateId);
            Assert.Equal(1, state.NextStepNumber);

            store.Clear(9);
            Assert.False(store.TryGet(9, out _));
        }

        [Fact]
        public async Task CommandStore_ShouldAllowOnlyOneAtomicTake()
        {
            var store = new AssistantCommandStore();
            var commandId = store.AddCommand(11, new AssistantCommandDto
            {
                Intent = AssistantActionRegistry.TransactionsCreate
            });

            var attempts = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(() =>
                store.TryTake(commandId, 11, out var command) && command != null)));

            Assert.Equal(1, attempts.Count(x => x));
            Assert.False(store.TryGet(commandId, 11, out _));
        }

        [Fact]
        public void CommandStore_ClearForUser_ShouldNotAffectOtherUsers()
        {
            var store = new AssistantCommandStore();
            var firstUserCommand = store.AddCommand(11, new AssistantCommandDto { Intent = AssistantActionRegistry.ContractsCreate });
            var secondUserCommand = store.AddCommand(12, new AssistantCommandDto { Intent = AssistantActionRegistry.RoomsCreate });

            store.ClearForUser(11);

            Assert.False(store.TryGet(firstUserCommand, 11, out _));
            Assert.True(store.TryGet(secondUserCommand, 12, out _));
        }
    }
}
