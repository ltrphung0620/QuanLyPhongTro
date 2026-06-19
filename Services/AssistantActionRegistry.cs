namespace NhaTro.Services
{
    public class AssistantActionRegistry
    {
        public const string MeterReadingCreate = "meter_reading.create";
        public const string MeterReadingsFindMissing = "meter_readings.find_missing";
        public const string RoomsFindAll = "rooms.find_all";
        public const string RoomsFindVacant = "rooms.find_vacant";
        public const string RoomsFindOccupied = "rooms.find_occupied";
        public const string RoomsFindByCode = "rooms.find_by_code";
        public const string RoomsCreate = "rooms.create";
        public const string TenantsFindAll = "tenants.find_all";
        public const string TenantsCreate = "tenants.create";
        public const string ContractsFindAll = "contracts.find_all";
        public const string ContractsFindActive = "contracts.find_active";
        public const string ContractsFindByRoom = "contracts.find_by_room";
        public const string ContractsCreate = "contracts.create";
        public const string ContractsEnd = "contracts.end";
        public const string InvoicesFindAll = "invoices.find_all";
        public const string InvoicesFindUnpaid = "invoices.find_unpaid";
        public const string InvoicesFindByRoomMonth = "invoices.find_by_room_month";
        public const string InvoicesCreateMonthlyBulk = "invoices.create_monthly_bulk";
        public const string InvoicesMarkPaid = "invoices.mark_paid";
        public const string TransactionsFind = "transactions.find";
        public const string TransactionsCreate = "transactions.create";
        public const string ReportsMonthlyRevenue = "reports.monthly_revenue";
        public const string ReportsMonthlyExpense = "reports.monthly_expense";
        public const string ReportsMonthlyProfitLoss = "reports.monthly_profit_loss";
        public const string ReportsPaymentStatus = "reports.payment_status";
        public const string AssistantUnknown = "assistant.unknown";

        public static readonly string[] ParamKeys =
        {
            "roomCode",
            "roomStatus",
            "listedPrice",
            "tenantName",
            "phone",
            "cccd",
            "billingMonth",
            "currentReading",
            "startDate",
            "expectedEndDate",
            "actualEndDate",
            "depositAmount",
            "actualRoomPrice",
            "occupantCount",
            "discountAmount",
            "debtAmount",
            "amount",
            "paymentMethod",
            "paymentReference",
            "note",
            "transactionDirection",
            "category",
            "itemName",
            "transactionDate",
            "description",
            "fromMonth",
            "toMonth",
            "status",
            "invoiceId",
            "contractId",
            "tenantId"
        };

        private readonly Dictionary<string, AssistantActionDefinition> _actions;

        public AssistantActionRegistry()
        {
            _actions = BuildActions().ToDictionary(x => x.Intent, StringComparer.OrdinalIgnoreCase);
        }

        public IReadOnlyCollection<AssistantActionDefinition> Actions => _actions.Values;

        public bool TryGet(string intent, out AssistantActionDefinition action)
        {
            return _actions.TryGetValue(intent, out action!);
        }

        public string BuildPromptCatalog()
        {
            return string.Join("\n", Actions.Select(action =>
            {
                var fields = action.RequiredFields.Length == 0 ? "none" : string.Join(", ", action.RequiredFields);
                var examples = action.Examples.Length == 0 ? string.Empty : $" Examples: {string.Join(" | ", action.Examples)}";
                return $"- {action.Intent}: {action.Description}. Required fields: {fields}.{examples}";
            }));
        }

        private static IEnumerable<AssistantActionDefinition> BuildActions()
        {
            yield return new() { Intent = MeterReadingCreate, Description = "enter or update electricity meter reading for a room and month", RequiredFields = new[] { "roomCode", "billingMonth", "currentReading" }, RequiresConfirmation = true, Examples = new[] { "nhập điện tháng 10 phòng A1 là 1000", "chốt công tơ A1 kỳ này 1000" } };
            yield return new() { Intent = MeterReadingsFindMissing, Description = "find rooms missing meter readings for a month", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "tháng 10 phòng nào chưa nhập điện" } };
            yield return new() { Intent = RoomsFindAll, Description = "list all rooms", Examples = new[] { "danh sách phòng" } };
            yield return new() { Intent = RoomsFindVacant, Description = "list vacant rooms", Examples = new[] { "phòng nào còn trống" } };
            yield return new() { Intent = RoomsFindOccupied, Description = "list occupied rooms", Examples = new[] { "phòng nào đang thuê" } };
            yield return new() { Intent = RoomsFindByCode, Description = "find a room by room code", RequiredFields = new[] { "roomCode" }, Examples = new[] { "xem phòng A1" } };
            yield return new() { Intent = RoomsCreate, Description = "create a new room", RequiredFields = new[] { "roomCode", "listedPrice" }, RequiresConfirmation = true, Examples = new[] { "tạo phòng A2 giá 2500000" } };
            yield return new() { Intent = TenantsFindAll, Description = "list all tenants", Examples = new[] { "danh sách khách thuê" } };
            yield return new() { Intent = TenantsCreate, Description = "create a tenant", RequiredFields = new[] { "tenantName" }, RequiresConfirmation = true, Examples = new[] { "thêm khách Nguyễn Văn A số 090..." } };
            yield return new() { Intent = ContractsFindAll, Description = "list contracts", Examples = new[] { "danh sách hợp đồng" } };
            yield return new() { Intent = ContractsFindActive, Description = "list active contracts", Examples = new[] { "hợp đồng đang hiệu lực" } };
            yield return new() { Intent = ContractsFindByRoom, Description = "find active contract by room code", RequiredFields = new[] { "roomCode" }, Examples = new[] { "hợp đồng phòng A1" } };
            yield return new() { Intent = ContractsCreate, Description = "create a contract for an existing room and tenant", RequiredFields = new[] { "roomCode", "tenantName", "startDate", "actualRoomPrice", "occupantCount" }, RequiresConfirmation = true, Examples = new[] { "tạo hợp đồng phòng A1 cho Nguyễn Văn A từ 1/7 giá 3000000" } };
            yield return new() { Intent = ContractsEnd, Description = "end an active contract for a room", RequiredFields = new[] { "roomCode", "actualEndDate" }, RequiresConfirmation = true, Examples = new[] { "kết thúc hợp đồng phòng A1 ngày 30/6" } };
            yield return new() { Intent = InvoicesFindAll, Description = "list invoices optionally filtered by month or status", Examples = new[] { "danh sách hóa đơn tháng 10" } };
            yield return new() { Intent = InvoicesFindUnpaid, Description = "list unpaid invoices optionally filtered by month", Examples = new[] { "hóa đơn nào chưa thanh toán tháng 10" } };
            yield return new() { Intent = InvoicesFindByRoomMonth, Description = "find invoice by room code and month", RequiredFields = new[] { "roomCode", "billingMonth" }, Examples = new[] { "hóa đơn phòng A1 tháng 10" } };
            yield return new() { Intent = InvoicesCreateMonthlyBulk, Description = "create monthly invoices for all active contracts", RequiredFields = new[] { "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "tạo hóa đơn tháng 10 cho tất cả phòng" } };
            yield return new() { Intent = InvoicesMarkPaid, Description = "mark an invoice as paid", RequiredFields = new[] { "invoiceId", "amount" }, RequiresConfirmation = true, Examples = new[] { "đánh dấu hóa đơn 12 đã thanh toán 3000000" } };
            yield return new() { Intent = TransactionsFind, Description = "list income or expense transactions optionally by month", Examples = new[] { "xem chi phí tháng 10", "thu nhập tháng này" } };
            yield return new() { Intent = TransactionsCreate, Description = "create income or expense transaction", RequiredFields = new[] { "transactionDirection", "amount", "transactionDate" }, RequiresConfirmation = true, Examples = new[] { "ghi chi phí sửa điện 500000 ngày hôm nay" } };
            yield return new() { Intent = ReportsMonthlyRevenue, Description = "show monthly revenue report", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "doanh thu tháng 10" } };
            yield return new() { Intent = ReportsMonthlyExpense, Description = "show monthly expense report", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "chi phí tháng 10" } };
            yield return new() { Intent = ReportsMonthlyProfitLoss, Description = "show monthly profit and loss report", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "lãi lỗ tháng 10" } };
            yield return new() { Intent = ReportsPaymentStatus, Description = "show payment status report for a month", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "tình trạng thanh toán tháng 10" } };
            yield return new() { Intent = AssistantUnknown, Description = "unsupported request", CanExecute = false };
        }
    }
}
