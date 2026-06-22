using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using NhaTro.Dtos.Assistant;
using NhaTro.Dtos.Contracts;
using NhaTro.Dtos.Rooms;
using NhaTro.Dtos.Tenants;
using NhaTro.Interfaces.Services;
using NhaTro.Services;

namespace NhaTro.Tests
{
    public class ContractTenantFlowTests
    {
        [Fact]
        public async Task ContractCreate_ShouldOfferMatchesAndContinueWithSelectedTenant()
        {
            var tenants = new List<TenantDto>
            {
                new() { TenantId = 11, FullName = "Nguyễn Văn Hùng", Phone = "0901111111" },
                new() { TenantId = 12, FullName = "Trần Quốc Hùng", Phone = "0902222222" }
            };
            var fixture = CreateFixture(tenants);

            var first = await fixture.Service.HandleMessageAsync("tạo hợp đồng cho Hùng phòng A2");

            Assert.Equal("need_more_info", first.Type);
            Assert.Equal(2, first.Suggestions.Count);
            Assert.StartsWith("1. Nguyễn Văn Hùng", first.Suggestions[0]);
            Assert.StartsWith("2. Trần Quốc Hùng", first.Suggestions[1]);

            var selected = await fixture.Service.HandleMessageAsync("2");

            Assert.Equal("confirmation_required", selected.Type);
            Assert.Contains("Trần Quốc Hùng", selected.Message);
            Assert.Equal("tenant_selection", selected.Parser);
        }

        [Fact]
        public async Task AgentContractCreate_ShouldKeepPlanAndContinueWithSelectedTenant()
        {
            const string request = "tạo hợp đồng cho Hùng phòng A2";
            var tenants = new List<TenantDto>
            {
                new() { TenantId = 11, FullName = "Nguyễn Văn Hùng" },
                new() { TenantId = 12, FullName = "Trần Quốc Hùng" }
            };
            var fixture = CreateFixture(tenants);
            var command = BuildContractCommand();
            fixture.Planner.Setup(x => x.PlanAsync(request, It.IsAny<int>()))
                .ReturnsAsync(new AssistantAgentPlanDto
                {
                    Goal = request,
                    Planner = "test",
                    Steps =
                    {
                        new AssistantAgentPlanStepDto
                        {
                            StepNumber = 1,
                            Tool = AssistantActionRegistry.ContractsCreate,
                            Intent = AssistantActionRegistry.ContractsCreate,
                            Args = command.Params,
                            RequiresConfirmation = true
                        }
                    }
                });

            var first = await fixture.Service.HandleAgentAsync(request);
            var selected = await fixture.Service.HandleAgentAsync("1");

            Assert.Equal("need_more_info", first.Type);
            Assert.Equal(2, first.Suggestions.Count);
            Assert.Equal("confirmation_required", selected.Type);
            Assert.Contains("Nguyễn Văn Hùng", selected.Message);
            Assert.Equal("11", selected.AgentPlan!.Steps[0].Args["tenantId"]);
        }

        [Fact]
        public async Task ContractCreate_ShouldCreateMissingTenantBeforeContractAfterConfirmation()
        {
            var fixture = CreateFixture(new List<TenantDto>());
            fixture.TenantService
                .Setup(x => x.CreateAsync(It.IsAny<CreateTenantDto>()))
                .ReturnsAsync((CreateTenantDto dto) => new TenantDto { TenantId = 21, FullName = dto.FullName });
            fixture.ContractService
                .Setup(x => x.CreateAsync(It.IsAny<CreateContractDto>()))
                .ReturnsAsync((CreateContractDto dto) => new ContractDto
                {
                    ContractId = 31,
                    RoomId = dto.RoomId,
                    RoomCode = "A2",
                    TenantId = dto.TenantId,
                    TenantName = "Khách Mới"
                });

            var preview = await fixture.Service.HandleMessageAsync("tạo hợp đồng cho khách Lê Minh phòng A2");

            Assert.Equal("confirmation_required", preview.Type);
            Assert.Contains("chưa tồn tại", preview.Message);
            Assert.NotNull(preview.CommandId);

            var executed = await fixture.Service.ExecuteAsync(preview.CommandId!);

            Assert.Equal("success", executed.Type);
            fixture.TenantService.Verify(x => x.CreateAsync(It.Is<CreateTenantDto>(dto => dto.FullName == "Lê Minh")), Times.Once);
            fixture.ContractService.Verify(x => x.CreateAsync(It.Is<CreateContractDto>(dto => dto.TenantId == 21)), Times.Once);
        }

        private static Fixture CreateFixture(List<TenantDto> tenants)
        {
            var environment = new Mock<IWebHostEnvironment>();
            environment.Setup(x => x.ContentRootPath).Returns(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N")));

            var roomService = new Mock<IRoomService>();
            roomService.Setup(x => x.GetByRoomCodeAsync("A2"))
                .ReturnsAsync(new RoomDto { RoomId = 2, RoomCode = "A2", ListedPrice = 2_500_000, Status = "vacant" });

            var tenantService = new Mock<ITenantService>();
            tenantService.Setup(x => x.GetAllAsync()).ReturnsAsync(tenants);
            tenantService.Setup(x => x.GetByIdAsync(It.IsAny<int>()))
                .ReturnsAsync((int id) => tenants.SingleOrDefault(x => x.TenantId == id));

            var contractService = new Mock<IContractService>();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(x => x.UserId).Returns(77);

            var parser = new Mock<IAssistantCommandParser>();
            parser.Setup(x => x.ParseAsync(It.IsAny<string>(), null))
                .ReturnsAsync((string message, AssistantCommandDto? _) =>
                {
                    var command = BuildContractCommand();
                    if (message.Contains("Lê Minh", StringComparison.OrdinalIgnoreCase))
                    {
                        command.Params["tenantName"] = "Lê Minh";
                    }

                    return new AssistantParseResult
                    {
                        Command = command,
                        Parser = "test",
                        Confidence = 1,
                        Reason = "Test contract command."
                    };
                });
            parser.Setup(x => x.Normalize(It.IsAny<AssistantCommandDto>()))
                .Returns<AssistantCommandDto>(value => value);

            var actionRegistry = new AssistantActionRegistry();
            var toolRegistry = new AssistantToolRegistry(actionRegistry);
            var learningStore = new AssistantLearningStore(environment.Object);
            var planner = new Mock<AssistantAgentPlanner>(
                new HttpClient(),
                new Mock<IConfiguration>().Object,
                new Mock<ILogger<AssistantAgentPlanner>>().Object,
                toolRegistry,
                parser.Object,
                learningStore);

            var service = new AssistantService(
                roomService.Object,
                tenantService.Object,
                contractService.Object,
                new Mock<IMeterReadingService>().Object,
                new Mock<IInvoiceService>().Object,
                new Mock<ITransactionService>().Object,
                new Mock<IReportService>().Object,
                new Mock<IPaymentService>().Object,
                currentUser.Object,
                new AssistantCommandStore(),
                new AssistantConversationStore(),
                new AssistantAgentStateStore(),
                parser.Object,
                actionRegistry,
                toolRegistry,
                learningStore,
                new AssistantAuditStore(environment.Object),
                planner.Object);

            return new Fixture(service, tenantService, contractService, planner);
        }

        private static AssistantCommandDto BuildContractCommand()
        {
            return new AssistantCommandDto
            {
                Intent = AssistantActionRegistry.ContractsCreate,
                RequiresConfirmation = true,
                Params = new Dictionary<string, string?>
                {
                    ["roomCode"] = "A2",
                    ["tenantName"] = "Hùng",
                    ["startDate"] = "2026-06-21",
                    ["actualRoomPrice"] = "2500000",
                    ["occupantCount"] = "1"
                }
            };
        }

        private sealed record Fixture(
            AssistantService Service,
            Mock<ITenantService> TenantService,
            Mock<IContractService> ContractService,
            Mock<AssistantAgentPlanner> Planner);
    }
}
