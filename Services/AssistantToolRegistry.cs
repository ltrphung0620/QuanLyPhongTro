namespace NhaTro.Services
{
    public class AssistantToolRegistry
    {
        private readonly Dictionary<string, AssistantToolDefinition> _tools;

        public AssistantToolRegistry(AssistantActionRegistry actionRegistry)
        {
            _tools = actionRegistry.Actions
                .Where(x => x.Intent != AssistantActionRegistry.AssistantUnknown)
                .Select(BuildTool)
                .ToDictionary(x => x.Name, StringComparer.OrdinalIgnoreCase);
        }

        public IReadOnlyCollection<AssistantToolDefinition> Tools => _tools.Values;

        public bool TryGet(string name, out AssistantToolDefinition tool)
        {
            return _tools.TryGetValue(name, out tool!);
        }

        public string BuildPromptCatalog()
        {
            return string.Join("\n", Tools.Select(tool =>
            {
                var required = tool.Parameters.Where(x => x.Required).Select(x => x.Name).ToArray();
                var optional = tool.Parameters.Where(x => !x.Required).Select(x => x.Name).ToArray();
                var examples = tool.Examples.Length == 0 ? string.Empty : $" Examples: {string.Join(" | ", tool.Examples)}";
                return $"- tool {tool.Name}: {tool.Description}. Mode: {tool.Mode}. Risk: {tool.RiskLevel}. Requires confirmation: {tool.RequiresConfirmation}. Strong confirmation: {tool.RequiresStrongConfirmation}. Required params: {FormatList(required)}. Optional params: {FormatList(optional)}. Output: {tool.OutputDescription}.{examples}";
            }));
        }

        private static AssistantToolDefinition BuildTool(AssistantActionDefinition action)
        {
            var optionalFields = GetOptionalFields(action.Intent)
                .Concat(action.OptionalFields)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Except(action.RequiredFields, StringComparer.OrdinalIgnoreCase)
                .ToArray();

            return new AssistantToolDefinition
            {
                Name = action.Intent,
                Intent = action.Intent,
                Description = action.Description,
                Mode = GetMode(action.Intent, action.RequiresConfirmation),
                RiskLevel = GetRiskLevel(action.Intent, action.RequiresConfirmation),
                RequiresConfirmation = action.RequiresConfirmation,
                RequiresStrongConfirmation = RequiresStrongConfirmation(action.Intent),
                CanExecute = action.CanExecute,
                Parameters = action.RequiredFields
                    .Select(x => BuildParameter(x, required: true))
                    .Concat(optionalFields.Select(x => BuildParameter(x, required: false)))
                    .ToArray(),
                Examples = action.Examples,
                OutputDescription = GetOutputDescription(action.Intent)
            };
        }

        private static string GetMode(string intent, bool requiresConfirmation)
        {
            if (intent.StartsWith("agent.", StringComparison.OrdinalIgnoreCase))
            {
                return AssistantToolModes.Agent;
            }

            return requiresConfirmation ? AssistantToolModes.Write : AssistantToolModes.Read;
        }

        private static string GetRiskLevel(string intent, bool requiresConfirmation)
        {
            return intent switch
            {
                AssistantActionRegistry.ContractsEnd => AssistantToolRiskLevels.High,
                AssistantActionRegistry.InvoicesMarkPaid => AssistantToolRiskLevels.High,
                AssistantActionRegistry.InvoicesCreateMonthlyBulk => AssistantToolRiskLevels.High,
                AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck => AssistantToolRiskLevels.High,
                AssistantActionRegistry.ContractsCancel => AssistantToolRiskLevels.High,
                AssistantActionRegistry.ContractsDeleteEnded => AssistantToolRiskLevels.High,
                AssistantActionRegistry.MeterReadingsDelete => AssistantToolRiskLevels.High,
                AssistantActionRegistry.InvoicesMarkUnpaid => AssistantToolRiskLevels.High,
                AssistantActionRegistry.InvoicesReplace => AssistantToolRiskLevels.High,
                AssistantActionRegistry.InvoicesDelete => AssistantToolRiskLevels.High,
                AssistantActionRegistry.TransactionsDelete => AssistantToolRiskLevels.High,
                AssistantActionRegistry.PaymentsReconcile => AssistantToolRiskLevels.High,
                AssistantActionRegistry.PaymentsDelete => AssistantToolRiskLevels.High,
                AssistantActionRegistry.ContractsCreate => AssistantToolRiskLevels.Medium,
                AssistantActionRegistry.MeterReadingCreate => AssistantToolRiskLevels.Medium,
                AssistantActionRegistry.RoomsCreate => AssistantToolRiskLevels.Medium,
                AssistantActionRegistry.TenantsCreate => AssistantToolRiskLevels.Medium,
                AssistantActionRegistry.TransactionsCreate => AssistantToolRiskLevels.Medium,
                _ => requiresConfirmation ? AssistantToolRiskLevels.Medium : AssistantToolRiskLevels.Low
            };
        }

        private static bool RequiresStrongConfirmation(string intent)
        {
            return GetRiskLevel(intent, requiresConfirmation: true) == AssistantToolRiskLevels.High;
        }

        private static string[] GetOptionalFields(string intent)
        {
            return intent switch
            {
                AssistantActionRegistry.RoomsCreate => new[] { "roomStatus", "note" },
                AssistantActionRegistry.TenantsCreate => new[] { "phone", "cccd", "note" },
                AssistantActionRegistry.ContractsCreate => new[] { "expectedEndDate", "depositAmount", "depositPaidAmount", "discountAmount", "debtAmount", "note", "phone", "cccd" },
                AssistantActionRegistry.ContractsEnd => new[] { "currentReading", "note" },
                AssistantActionRegistry.InvoicesFindAll => new[] { "billingMonth", "status", "roomCode" },
                AssistantActionRegistry.InvoicesFindUnpaid => new[] { "billingMonth", "roomCode" },
                AssistantActionRegistry.InvoicesCreateMonthlyBulk => new[] { "discountAmount", "debtAmount" },
                AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck => new[] { "discountAmount", "debtAmount" },
                AssistantActionRegistry.InvoicesMarkPaid => new[] { "paymentMethod", "paymentReference", "note" },
                AssistantActionRegistry.TransactionsFind => new[] { "billingMonth", "transactionDirection", "category" },
                AssistantActionRegistry.TransactionsCreate => new[] { "category", "itemName", "description", "paymentMethod", "paymentReference", "roomCode", "note" },
                AssistantActionRegistry.ReportsMonthlyRevenue => new[] { "fromMonth", "toMonth" },
                AssistantActionRegistry.ReportsMonthlyExpense => new[] { "fromMonth", "toMonth" },
                AssistantActionRegistry.ReportsMonthlyProfitLoss => new[] { "fromMonth", "toMonth" },
                _ => Array.Empty<string>()
            };
        }

        private static AssistantToolParameterDefinition BuildParameter(string name, bool required)
        {
            return new AssistantToolParameterDefinition
            {
                Name = name,
                Type = GetParameterType(name),
                Description = GetParameterDescription(name),
                Required = required
            };
        }

        private static string GetParameterType(string name)
        {
            return name switch
            {
                "billingMonth" or "fromMonth" or "toMonth" => "month:yyyy-MM-dd",
                "startDate" or "expectedEndDate" or "actualEndDate" or "transactionDate" => "date:yyyy-MM-dd",
                "listedPrice" or "actualRoomPrice" or "depositAmount" or "depositPaidAmount" or "discountAmount" or "debtAmount" or "amount"
                    or "roomFee" or "electricityFee" or "waterFee" or "trashFee" => "decimal",
                "currentReading" or "occupantCount" or "invoiceId" or "contractId" or "tenantId"
                    or "meterReadingId" or "transactionId" or "paymentTransactionId" => "integer",
                _ => "string"
            };
        }

        private static string GetParameterDescription(string name)
        {
            return name switch
            {
                "roomCode" => "Room code, normalized uppercase, for example A1.",
                "billingMonth" => "Billing month using the first day of month.",
                "currentReading" => "New electricity meter reading.",
                "listedPrice" => "Listed room price.",
                "tenantName" => "Tenant full name.",
                "phone" => "Tenant phone number.",
                "cccd" => "Tenant identity number.",
                "startDate" => "Contract start date.",
                "expectedEndDate" => "Expected contract end date.",
                "actualEndDate" => "Actual contract end date.",
                "actualRoomPrice" => "Actual room price on contract.",
                "occupantCount" => "Number of occupants.",
                "amount" => "Money amount.",
                "electricityFee" => "Electricity fee amount on an invoice, not a meter index.",
                "transactionId" => "Income/expense transaction ID.",
                "paymentTransactionId" => "Bank payment transaction ID.",
                "meterReadingId" => "Meter reading record ID.",
                "processStatus" => "Bank transaction processing status filter.",
                "transactionDirection" => "income or expense.",
                "category" => "Transaction category, usually operating or other.",
                "status" => "Status filter.",
                _ => name
            };
        }

        private static string GetOutputDescription(string intent)
        {
            return intent switch
            {
                AssistantActionRegistry.MeterReadingCreate => "Preview or created meter reading.",
                AssistantActionRegistry.MeterReadingsFind => "Electricity meter reading detail for a room and month.",
                AssistantActionRegistry.MeterReadingsFindMissing => "List of rooms missing meter readings.",
                AssistantActionRegistry.RoomsFindAll or AssistantActionRegistry.RoomsFindVacant or AssistantActionRegistry.RoomsFindOccupied => "List of rooms.",
                AssistantActionRegistry.RoomsFindByCode => "Room detail.",
                AssistantActionRegistry.RoomsCreate => "Preview or created room.",
                AssistantActionRegistry.TenantsFindAll => "List of tenants.",
                AssistantActionRegistry.TenantsCreate => "Preview or created tenant.",
                AssistantActionRegistry.ContractsFindAll or AssistantActionRegistry.ContractsFindActive => "List of contracts.",
                AssistantActionRegistry.ContractsFindByRoom => "Contract detail for a room.",
                AssistantActionRegistry.ContractsCreate => "Preview or created contract.",
                AssistantActionRegistry.ContractsEnd => "Preview or result of ending contract.",
                AssistantActionRegistry.InvoicesFindAll or AssistantActionRegistry.InvoicesFindUnpaid => "List of invoices.",
                AssistantActionRegistry.InvoicesFindByRoomMonth => "Invoice detail.",
                AssistantActionRegistry.InvoicesCreateMonthlyBulk => "Preview or created monthly invoices.",
                AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck => "Multi-step result: missing readings report or invoice preview.",
                AssistantActionRegistry.InvoicesMarkPaid => "Preview or paid invoice result.",
                AssistantActionRegistry.TransactionsFind => "List of transactions.",
                AssistantActionRegistry.TransactionsCreate => "Preview or created transaction.",
                AssistantActionRegistry.RoomsUpdate or AssistantActionRegistry.RoomsUpdateStatus => "Preview or updated room.",
                AssistantActionRegistry.TenantsUpdate => "Preview or updated tenant.",
                AssistantActionRegistry.ContractsUpdate or AssistantActionRegistry.ContractsCancel or AssistantActionRegistry.ContractsDeleteEnded => "Preview or contract mutation result.",
                AssistantActionRegistry.MeterReadingsUpdate or AssistantActionRegistry.MeterReadingsDelete => "Preview or meter reading mutation result.",
                AssistantActionRegistry.InvoicesMarkUnpaid or AssistantActionRegistry.InvoicesUpdateElectricity
                    or AssistantActionRegistry.InvoicesReplace or AssistantActionRegistry.InvoicesUpdate
                    or AssistantActionRegistry.InvoicesDelete => "Preview or invoice mutation result.",
                AssistantActionRegistry.InvoicesDownloadPdf => "Authenticated invoice PDF download URL.",
                AssistantActionRegistry.TransactionsUpdate or AssistantActionRegistry.TransactionsDelete => "Preview or transaction mutation result.",
                AssistantActionRegistry.PaymentsFind => "List of bank payment transactions.",
                AssistantActionRegistry.PaymentsReconcile or AssistantActionRegistry.PaymentsDelete => "Preview or bank payment mutation result.",
                _ => "Tool result."
            };
        }

        private static string FormatList(IReadOnlyCollection<string> values)
        {
            return values.Count == 0 ? "none" : string.Join(", ", values);
        }
    }
}
