using Xunit;
using Moq;
using NhaTro.Services;
using NhaTro.Dtos.Assistant;
using NhaTro.Interfaces.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace NhaTro.Tests
{
    public class LearningTests
    {
        private readonly Mock<IWebHostEnvironment> _mockEnv;
        private readonly AssistantLearningStore _learningStore;
        private readonly int _testUserId = 42;

        public LearningTests()
        {
            _mockEnv = new Mock<IWebHostEnvironment>();
            // Use temporary directory for testing JSON file
            var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
            _mockEnv.Setup(x => x.ContentRootPath).Returns(tempPath);
            _learningStore = new AssistantLearningStore(_mockEnv.Object);
        }

        [Fact]
        public void RecordMistake_ShouldStoreMistakeInFile()
        {
            var rawMessage = "Tính tiền phòng A1";
            var command = new AssistantCommandDto
            {
                Intent = "tao_hoa_don",
                Params = new Dictionary<string, string?> { { "roomCode", "A1" } }
            };

            // Record mistake on first store instance
            _learningStore.RecordMistake(_testUserId, rawMessage, command);

            // Create a second store instance pointing to same directory
            var secondStore = new AssistantLearningStore(_mockEnv.Object);
            
            // Record correction on second instance
            var commandCorrection = new AssistantCommandDto
            {
                Intent = "xem_hop_dong",
                Params = new Dictionary<string, string?> { { "roomCode", "A1" } }
            };
            secondStore.RecordCorrection(_testUserId, rawMessage, commandCorrection);

            var prompt = secondStore.BuildPromptLessons(_testUserId);
            Assert.Contains("Avoid previous rejected intent tao_hoa_don", prompt);
            Assert.Contains("prefer intent xem_hop_dong", prompt);
        }

        [Fact]
        public void RecordCorrection_ShouldLinkCorrectionToLatestMistake()
        {
            var rawMessage = "Tính tiền phòng A1";
            var commandMistake = new AssistantCommandDto
            {
                Intent = "tao_hoa_don",
                Params = new Dictionary<string, string?> { { "roomCode", "A1" } }
            };

            _learningStore.RecordMistake(_testUserId, rawMessage, commandMistake);

            var commandCorrection = new AssistantCommandDto
            {
                Intent = "xem_hop_dong",
                Params = new Dictionary<string, string?> { { "roomCode", "A1" } }
            };

            _learningStore.RecordCorrection(_testUserId, rawMessage, commandCorrection);
            var prompt = _learningStore.BuildPromptLessons(_testUserId);

            Assert.Contains("prefer intent xem_hop_dong", prompt);
            Assert.Contains("Avoid previous rejected intent tao_hoa_don", prompt);
        }

        [Fact]
        public void RecordValueAlias_ShouldStoreAndApplyValueAliases()
        {
            var intent = "nhap_chi_so_dien_nuoc";
            var field = "roomCode";
            var rawValue = "p A1";
            var normalizedValue = "A1";

            _learningStore.RecordValueAlias(_testUserId, intent, field, rawValue, normalizedValue);

            var testCommand = new AssistantCommandDto
            {
                Intent = intent,
                Params = new Dictionary<string, string?> { { "roomCode", "" } }
            };

            _learningStore.ApplyValueAliases(_testUserId, intent, "điện p A1 tháng 10", testCommand);

            Assert.Equal("A1", testCommand.Params["roomCode"]);
        }

        [Fact]
        public async Task AssistantService_ShouldRecordMistakeOnReject()
        {
            // Mock dependencies for AssistantService
            var mockRoomService = new Mock<IRoomService>();
            var mockTenantService = new Mock<ITenantService>();
            var mockContractService = new Mock<IContractService>();
            var mockMeterReadingService = new Mock<IMeterReadingService>();
            var mockInvoiceService = new Mock<IInvoiceService>();
            var mockTransactionService = new Mock<ITransactionService>();
            var mockReportService = new Mock<IReportService>();
            var mockPaymentService = new Mock<IPaymentService>();

            var mockCurrentUserService = new Mock<ICurrentUserService>();
            mockCurrentUserService.Setup(x => x.UserId).Returns(_testUserId);

            var commandStore = new AssistantCommandStore();
            var conversationStore = new AssistantConversationStore();
            var agentStateStore = new AssistantAgentStateStore();
            var auditStore = new AssistantAuditStore(_mockEnv.Object);

            var mockParser = new Mock<IAssistantCommandParser>();
            mockParser.Setup(x => x.Normalize(It.IsAny<AssistantCommandDto>()))
                .Returns<AssistantCommandDto>(c => c);
            var actionRegistry = new AssistantActionRegistry();
            var toolRegistry = new AssistantToolRegistry(actionRegistry);

            var mockPlanner = new Mock<AssistantAgentPlanner>(
                new Mock<HttpClient>().Object,
                new Mock<IConfiguration>().Object,
                new Mock<ILogger<AssistantAgentPlanner>>().Object,
                toolRegistry,
                mockParser.Object,
                _learningStore,
                mockCurrentUserService.Object
            );

            var assistantService = new AssistantService(
                mockRoomService.Object,
                mockTenantService.Object,
                mockContractService.Object,
                mockMeterReadingService.Object,
                mockInvoiceService.Object,
                mockTransactionService.Object,
                mockReportService.Object,
                mockPaymentService.Object,
                mockCurrentUserService.Object,
                commandStore,
                conversationStore,
                agentStateStore,
                mockParser.Object,
                actionRegistry,
                toolRegistry,
                _learningStore,
                auditStore,
                mockPlanner.Object
            );

            // Setup a running agent state
            var plan = new AssistantAgentPlanDto
            {
                Goal = "Tính tiền phòng A1",
                Steps = new List<AssistantAgentPlanStepDto>
                {
                    new AssistantAgentPlanStepDto
                    {
                        StepNumber = 1,
                        Tool = "calculate_rent",
                        Intent = "tao_hoa_don",
                        Args = new Dictionary<string, string?> { { "roomCode", "A1" } }
                    }
                }
            };
            var execution = new AssistantAgentExecutionDto
            {
                StateId = "testState",
                WaitingForConfirmation = true,
                PendingCommandId = "cmd123"
            };

            agentStateStore.Set(_testUserId, plan, execution, nextStepNumber: 2, originalMessage: "Tính tiền phòng A1");

            // User sends "Không đúng"
            var response = await assistantService.HandleAgentAsync("Không đúng");

            // Verify
            Assert.Equal("need_more_info", response.Type);
            Assert.Equal("assistant.correct", response.Intent);
            
            // Check that agentState was cleared
            Assert.False(agentStateStore.TryGet(_testUserId, out _));

            // Check that mistake was recorded in LearningStore by completing it with a correction
            _learningStore.RecordCorrection(_testUserId, "Tính tiền phòng A1", new AssistantCommandDto { Intent = "xem_hop_dong" });
            var prompt = _learningStore.BuildPromptLessons(_testUserId);
            Assert.Contains("Avoid previous rejected intent tao_hoa_don", prompt);
            Assert.Contains("prefer intent xem_hop_dong", prompt);
        }
    }
}
