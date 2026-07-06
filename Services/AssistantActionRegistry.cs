namespace NhaTro.Services
{
    public class AssistantActionRegistry
    {
        public const string MeterReadingCreate = "meter_reading.create";
        public const string MeterReadingsFind = "meter_readings.find";
        public const string MeterReadingsFindMissing = "meter_readings.find_missing";
        public const string MeterReadingsFindAll = "meter_readings.find_all";
        public const string MeterReadingsFindById = "meter_readings.find_by_id";
        public const string MeterReadingsDeleteByEndedContract = "meter_readings.delete_by_ended_contract";
        public const string RoomsFindAll = "rooms.find_all";
        public const string RoomsFindVacant = "rooms.find_vacant";
        public const string RoomsFindOccupied = "rooms.find_occupied";
        public const string RoomsFindByCode = "rooms.find_by_code";
        public const string RoomsFindById = "rooms.find_by_id";
        public const string RoomsCreate = "rooms.create";
        public const string RoomsUpdate = "rooms.update";
        public const string RoomsUpdateStatus = "rooms.update_status";
        public const string TenantsFindAll = "tenants.find_all";
        public const string TenantsFind = "tenants.find";
        public const string TenantsCreate = "tenants.create";
        public const string TenantsUpdate = "tenants.update";
        public const string ContractsFindAll = "contracts.find_all";
        public const string ContractsFindActive = "contracts.find_active";
        public const string ContractsFindByRoom = "contracts.find_by_room";
        public const string ContractsFindById = "contracts.find_by_id";
        public const string ContractsCreate = "contracts.create";
        public const string ContractsEnd = "contracts.end";
        public const string ContractsUpdate = "contracts.update";
        public const string ContractsCancel = "contracts.cancel";
        public const string ContractsDeleteEnded = "contracts.delete_ended";
        public const string InvoicesFindAll = "invoices.find_all";
        public const string InvoicesFindUnpaid = "invoices.find_unpaid";
        public const string InvoicesFindByRoomMonth = "invoices.find_by_room_month";
        public const string InvoicesFindByPaymentCode = "invoices.find_by_payment_code";
        public const string InvoicesFindById = "invoices.find_by_id";
        public const string InvoicesCreate = "invoices.create";
        public const string InvoicesCreateMonthlyBulk = "invoices.create_monthly_bulk";
        public const string InvoicesCreateMonthlyBulkAfterMeterCheck = "agent.invoices.create_monthly_bulk_after_meter_check";
        public const string InvoicesMarkPaid = "invoices.mark_paid";
        public const string InvoicesMarkUnpaid = "invoices.mark_unpaid";
        public const string InvoicesUpdateElectricity = "invoices.update_electricity";
        public const string InvoicesReplace = "invoices.replace";
        public const string InvoicesUpdate = "invoices.update";
        public const string InvoicesDelete = "invoices.delete";
        public const string InvoicesDownloadPdf = "invoices.download_pdf";
        public const string TransactionsFind = "transactions.find";
        public const string TransactionsFindById = "transactions.find_by_id";
        public const string TransactionsCreate = "transactions.create";
        public const string TransactionsUpdate = "transactions.update";
        public const string TransactionsDelete = "transactions.delete";
        public const string MeterReadingsUpdate = "meter_readings.update";
        public const string MeterReadingsDelete = "meter_readings.delete";
        public const string PaymentsFind = "payments.find";
        public const string PaymentsFindById = "payments.find_by_id";
        public const string PaymentsReconcile = "payments.reconcile";
        public const string PaymentsDelete = "payments.delete";
        public const string ReportsMonthlyRevenue = "reports.monthly_revenue";
        public const string ReportsMonthlyExpense = "reports.monthly_expense";
        public const string ReportsMonthlyProfitLoss = "reports.monthly_profit_loss";
        public const string ReportsPaymentStatus = "reports.payment_status";
        public const string ReportsSalesLedger = "reports.sales_ledger";
        public const string ReportsSalesLedgerPdf = "reports.sales_ledger_pdf";
        public const string AssistantUnknown = "assistant.unknown";

        public static readonly string[] ParamKeys =
        {
            "roomCode",
            "roomId",
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
            "depositPaidAmount",
            "actualRoomPrice",
            "occupantCount",
            "discountAmount",
            "debtAmount",
            "amount",
            "paymentMethod",
            "paymentReference",
            "paymentCode",
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
            "tenantId",
            "meterReadingId",
            "transactionId",
            "paymentTransactionId",
            "processStatus",
            "businessOwnerName",
            "address",
            "taxCode",
            "businessLocation",
            "roomFee",
            "electricityFee",
            "waterFee",
            "trashFee"
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
                var optionalFields = action.OptionalFields.Length == 0 ? "none" : string.Join(", ", action.OptionalFields);
                var examples = action.Examples.Length == 0 ? string.Empty : $" Examples: {string.Join(" | ", action.Examples)}";
                var mode = action.RequiresConfirmation ? "write/confirmation required" : "read/query";
                return $"- {action.Intent}: {action.Description}. Mode: {mode}. Required fields: {fields}. Optional fields: {optionalFields}.{examples}";
            }));
        }

        private static IEnumerable<AssistantActionDefinition> BuildActions()
        {
            yield return new() { Intent = MeterReadingCreate, Description = "enter or update electricity meter reading for a room and month", RequiredFields = new[] { "roomCode", "billingMonth", "currentReading" }, RequiresConfirmation = true, Examples = new[] { "nhập điện tháng 10 phòng A1 là 1000", "chốt công tơ A1 kỳ này 1000" } };
            yield return new() { Intent = MeterReadingsFind, Description = "get the electricity meter reading of a room for a billing month", RequiredFields = new[] { "roomCode", "billingMonth" }, Examples = new[] { "chỉ số điện phòng A1 tháng 10 là bao nhiêu", "xem số điện tháng trước phòng A1" } };
            yield return new() { Intent = MeterReadingsFindMissing, Description = "find rooms missing meter readings for a month", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "tháng 10 phòng nào chưa nhập điện" } };
            yield return new() { Intent = MeterReadingsFindAll, Description = "list meter readings optionally filtered by room and billing month", OptionalFields = new[] { "roomCode", "billingMonth" }, Examples = new[] { "danh sách chỉ số điện tháng 10", "lịch sử số điện phòng A1" } };
            yield return new() { Intent = MeterReadingsFindById, Description = "find one meter reading by ID", RequiredFields = new[] { "meterReadingId" }, Examples = new[] { "xem chỉ số điện ID 8" } };
            yield return new() { Intent = MeterReadingsDeleteByEndedContract, Description = "delete all meter readings belonging to an ended contract", OptionalFields = new[] { "contractId", "roomCode" }, RequiresConfirmation = true, Examples = new[] { "xóa toàn bộ chỉ số của hợp đồng đã kết thúc phòng A1" } };
            yield return new() { Intent = RoomsFindAll, Description = "list all rooms", Examples = new[] { "danh sách phòng" } };
            yield return new() { Intent = RoomsFindVacant, Description = "list vacant rooms", Examples = new[] { "phòng nào còn trống" } };
            yield return new() { Intent = RoomsFindOccupied, Description = "list occupied rooms", Examples = new[] { "phòng nào đang thuê" } };
            yield return new() { Intent = RoomsFindByCode, Description = "find a room by room code", RequiredFields = new[] { "roomCode" }, Examples = new[] { "xem phòng A1" } };
            yield return new() { Intent = RoomsFindById, Description = "find a room by numeric ID", RequiredFields = new[] { "roomId" }, Examples = new[] { "xem phòng ID 3" } };
            yield return new() { Intent = RoomsCreate, Description = "create a new room", RequiredFields = new[] { "roomCode", "listedPrice" }, RequiresConfirmation = true, Examples = new[] { "tạo phòng A2 giá 2500000" } };
            yield return new() { Intent = TenantsFindAll, Description = "list all tenants", Examples = new[] { "danh sách khách thuê" } };
            yield return new() { Intent = TenantsFind, Description = "find one tenant by ID, phone, identity number or name", OptionalFields = new[] { "tenantId", "tenantName", "phone", "cccd" }, Examples = new[] { "xem thông tin khách Hùng", "khách thuê ID 5" } };
            yield return new() { Intent = TenantsCreate, Description = "create a tenant", RequiredFields = new[] { "tenantName" }, RequiresConfirmation = true, Examples = new[] { "thêm khách Nguyễn Văn A số 090..." } };
            yield return new() { Intent = ContractsFindAll, Description = "list contracts", Examples = new[] { "danh sách hợp đồng" } };
            yield return new() { Intent = ContractsFindActive, Description = "list active contracts", Examples = new[] { "hợp đồng đang hiệu lực" } };
            yield return new() { Intent = ContractsFindByRoom, Description = "find active contract by room code", RequiredFields = new[] { "roomCode" }, Examples = new[] { "hợp đồng phòng A1" } };
            yield return new() { Intent = ContractsFindById, Description = "find a contract by ID", RequiredFields = new[] { "contractId" }, Examples = new[] { "xem hợp đồng ID 5" } };
            yield return new() { Intent = ContractsCreate, Description = "create a contract for a room; select a matching tenant or create the tenant when no match exists", RequiredFields = new[] { "roomCode", "tenantName", "startDate", "actualRoomPrice", "occupantCount" }, OptionalFields = new[] { "trashFee" }, RequiresConfirmation = true, Examples = new[] { "tạo hợp đồng phòng A1 cho Nguyễn Văn A từ 1/7 giá 3000000" } };
            yield return new() { Intent = ContractsEnd, Description = "end an active contract for a room", RequiredFields = new[] { "roomCode", "actualEndDate" }, RequiresConfirmation = true, Examples = new[] { "kết thúc hợp đồng phòng A1 ngày 30/6" } };
            yield return new() { Intent = InvoicesFindAll, Description = "list invoices optionally filtered by month or status", Examples = new[] { "danh sách hóa đơn tháng 10" } };
            yield return new() { Intent = InvoicesFindUnpaid, Description = "list unpaid invoices optionally filtered by month", Examples = new[] { "hóa đơn nào chưa thanh toán tháng 10" } };
            yield return new() { Intent = InvoicesFindByRoomMonth, Description = "find invoice by room code and month", RequiredFields = new[] { "roomCode", "billingMonth" }, Examples = new[] { "hóa đơn phòng A1 tháng 10" } };
            yield return new() { Intent = InvoicesFindByPaymentCode, Description = "find invoice by payment code", RequiredFields = new[] { "paymentCode" }, Examples = new[] { "tra hóa đơn mã thanh toán HD-A1-202610" } };
            yield return new() { Intent = InvoicesFindById, Description = "find an invoice by ID", RequiredFields = new[] { "invoiceId" }, Examples = new[] { "xem hóa đơn ID 12" } };
            yield return new() { Intent = InvoicesCreate, Description = "create one monthly invoice for a room and billing month", RequiredFields = new[] { "roomCode", "billingMonth" }, OptionalFields = new[] { "discountAmount", "debtAmount" }, RequiresConfirmation = true, Examples = new[] { "tạo hóa đơn tháng 10 cho phòng A1" } };
            yield return new() { Intent = InvoicesCreateMonthlyBulk, Description = "create monthly invoices for all active contracts", RequiredFields = new[] { "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "tạo hóa đơn tháng 10 cho tất cả phòng" } };
            yield return new() { Intent = InvoicesMarkPaid, Description = "mark an invoice as paid; identify it by invoice ID or room and billing month; omit amount to pay the full invoice total", OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth", "amount" }, RequiresConfirmation = true, Examples = new[] { "đánh dấu hóa đơn 12 đã thanh toán 3000000", "ghi nhận phòng A1 tháng 10 đã trả đủ" } };
            yield return new() { Intent = TransactionsFind, Description = "list income or expense transactions optionally by month", Examples = new[] { "xem chi phí tháng 10", "thu nhập tháng này" } };
            yield return new() { Intent = TransactionsFindById, Description = "find an income or expense transaction by ID", RequiredFields = new[] { "transactionId" }, Examples = new[] { "xem giao dịch thu chi ID 15" } };
            yield return new() { Intent = TransactionsCreate, Description = "create income or expense transaction", RequiredFields = new[] { "transactionDirection", "amount", "transactionDate" }, RequiresConfirmation = true, Examples = new[] { "ghi chi phí sửa điện 500000 ngày hôm nay" } };
            yield return new() { Intent = ReportsMonthlyRevenue, Description = "show monthly revenue report", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "doanh thu tháng 10" } };
            yield return new() { Intent = ReportsMonthlyExpense, Description = "show monthly expense report", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "chi phí tháng 10" } };
            yield return new() { Intent = ReportsMonthlyProfitLoss, Description = "show monthly profit and loss report", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "lãi lỗ tháng 10" } };
            yield return new() { Intent = ReportsPaymentStatus, Description = "show payment status report for a month", RequiredFields = new[] { "billingMonth" }, Examples = new[] { "tình trạng thanh toán tháng 10" } };
            yield return new() { Intent = ReportsSalesLedger, Description = "show sales ledger for a month range", RequiredFields = new[] { "fromMonth", "toMonth" }, Examples = new[] { "xem sổ doanh thu từ tháng 1 đến tháng 6" } };
            yield return new() { Intent = ReportsSalesLedgerPdf, Description = "generate sales ledger PDF for a month range", RequiredFields = new[] { "fromMonth", "toMonth" }, OptionalFields = new[] { "businessOwnerName", "address", "taxCode", "businessLocation" }, Examples = new[] { "xuất PDF sổ doanh thu từ tháng 1 đến tháng 6" } };
            yield return new() { Intent = InvoicesCreateMonthlyBulkAfterMeterCheck, Description = "multi-step agent: first check rooms missing meter readings for the month, stop and report if any room is missing readings, otherwise preview monthly invoice creation", RequiredFields = new[] { "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "kiem tra phong thieu dien roi tao hoa don thang 10", "tao hoa don thang 10 nhung neu phong nao chua nhap dien thi bao truoc" } };
            yield return new() { Intent = RoomsUpdate, Description = "update room listed price while preserving unspecified room data", RequiredFields = new[] { "roomCode", "listedPrice" }, RequiresConfirmation = true, Examples = new[] { "doi gia phong A1 thanh 2.8 trieu" } };
            yield return new() { Intent = RoomsUpdateStatus, Description = "update room status", RequiredFields = new[] { "roomCode", "roomStatus" }, RequiresConfirmation = true, Examples = new[] { "doi phong A2 sang trong", "sua trang thai phong A1 thanh dang sua chua" } };
            yield return new() { Intent = TenantsUpdate, Description = "update tenant phone or identity number; identify the tenant by tenantId or tenantName", OptionalFields = new[] { "tenantId", "tenantName", "phone", "cccd" }, RequiresConfirmation = true, Examples = new[] { "doi so dien thoai khach Nguyen Van A thanh 0987654321", "cap nhat CCCD cua chi Vy" } };
            yield return new() { Intent = ContractsUpdate, Description = "update active contract details; identify it by contractId or roomCode", OptionalFields = new[] { "roomCode", "contractId", "startDate", "expectedEndDate", "depositAmount", "depositPaidAmount", "occupantCount", "actualRoomPrice", "trashFee" }, RequiresConfirmation = true, Examples = new[] { "sua tien coc hop dong phong A1 thanh 5 trieu", "doi so nguoi o hop dong phong B2 la 3" } };
            yield return new() { Intent = ContractsCancel, Description = "cancel an active contract identified by contractId or roomCode", OptionalFields = new[] { "roomCode", "contractId", "note" }, RequiresConfirmation = true, Examples = new[] { "huy hop dong phong A1 ly do khach chuyen di" } };
            yield return new() { Intent = ContractsDeleteEnded, Description = "permanently delete an ended contract", OptionalFields = new[] { "contractId", "roomCode" }, RequiresConfirmation = true, Examples = new[] { "xoa hop dong cu da ket thuc cua phong A1", "xoa hop dong ID 5" } };
            yield return new() { Intent = MeterReadingsUpdate, Description = "update an existing meter reading identified by meterReadingId or room and month", RequiredFields = new[] { "currentReading" }, OptionalFields = new[] { "meterReadingId", "roomCode", "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "sua chi so dien phong A1 thang 10 la 1050" } };
            yield return new() { Intent = MeterReadingsDelete, Description = "permanently delete a meter reading", OptionalFields = new[] { "meterReadingId", "roomCode", "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "xoa so dien thang 10 cua phong A1" } };
            yield return new() { Intent = InvoicesMarkUnpaid, Description = "revert an invoice to unpaid status", OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "chuyen hoa don phong A1 thang 10 ve chua thanh toan" } };
            yield return new() { Intent = InvoicesUpdateElectricity, Description = "update electricity fee on an invoice for room and month", RequiredFields = new[] { "roomCode", "billingMonth", "electricityFee" }, OptionalFields = new[] { "note" }, RequiresConfirmation = true, Examples = new[] { "sua tien dien tren hoa don phong A1 thang 10 thanh 106000" } };
            yield return new() { Intent = InvoicesReplace, Description = "replace an invoice while preserving unspecified fee values", OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth", "roomFee", "electricityFee", "waterFee", "trashFee", "discountAmount", "debtAmount", "note" }, RequiresConfirmation = true, Examples = new[] { "tao lai hoa don thang 10 cho phong A1" } };
            yield return new() { Intent = InvoicesUpdate, Description = "update invoice fees, discount, debt or note", OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth", "roomFee", "electricityFee", "waterFee", "trashFee", "discountAmount", "debtAmount", "note" }, RequiresConfirmation = true, Examples = new[] { "giam gia 100k cho hoa don phong A1 thang 10", "cap nhat no cu hoa don phong B2 la 500k" } };
            yield return new() { Intent = InvoicesDelete, Description = "permanently delete an invoice", OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "xoa hoa don phong A1 thang 10" } };
            yield return new() { Intent = InvoicesDownloadPdf, Description = "return an authenticated download URL for an invoice PDF", OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth" }, Examples = new[] { "tai PDF hoa don phong A1 thang 10" } };
            yield return new() { Intent = TransactionsUpdate, Description = "update an income or expense transaction", RequiredFields = new[] { "transactionId" }, OptionalFields = new[] { "transactionDirection", "category", "itemName", "amount", "transactionDate", "description", "roomCode" }, RequiresConfirmation = true, Examples = new[] { "cap nhat giao dich ID 15 thanh 400k" } };
            yield return new() { Intent = TransactionsDelete, Description = "permanently delete an income or expense transaction", RequiredFields = new[] { "transactionId" }, RequiresConfirmation = true, Examples = new[] { "xoa giao dich thu ID 15" } };
            yield return new() { Intent = PaymentsFind, Description = "list bank transfer payment transactions", OptionalFields = new[] { "processStatus" }, Examples = new[] { "xem lich su chuyen khoan hom nay", "danh sach giao dich ngan hang chua doi soat" } };
            yield return new() { Intent = PaymentsFindById, Description = "find one bank payment transaction by ID", RequiredFields = new[] { "paymentTransactionId" }, Examples = new[] { "xem chuyển khoản ngân hàng ID 5" } };
            yield return new() { Intent = PaymentsReconcile, Description = "manually reconcile a bank transaction with an invoice identified by invoiceId or room and month", RequiredFields = new[] { "paymentTransactionId" }, OptionalFields = new[] { "invoiceId", "roomCode", "billingMonth" }, RequiresConfirmation = true, Examples = new[] { "doi soat giao dich ngan hang ID 5 cho hoa don phong A1" } };
            yield return new() { Intent = PaymentsDelete, Description = "permanently delete a bank payment transaction", RequiredFields = new[] { "paymentTransactionId" }, RequiresConfirmation = true, Examples = new[] { "xoa giao dich ngan hang ID 8" } };
            yield return new() { Intent = AssistantUnknown, Description = "unsupported request", CanExecute = false };
        }
    }
}
