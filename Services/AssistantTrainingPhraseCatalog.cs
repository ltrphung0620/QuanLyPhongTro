namespace NhaTro.Services
{
    public class AssistantTrainingPhraseCatalog
    {
        public const int PhrasesPerAction = 100;

        private static readonly string[] Prefixes =
        {
            "", "cho tôi", "giúp tôi", "mình muốn", "tôi cần", "hãy", "làm ơn", "cho mình", "nhờ bạn", "vui lòng"
        };

        private static readonly string[] Suffixes =
        {
            "", "giúp tôi", "giúp mình", "được không", "nhé", "với", "ngay bây giờ", "cho tôi nhé", "cho mình với", "dùm tôi"
        };

        private static readonly IReadOnlyDictionary<string, string[]> CorePhrases = new Dictionary<string, string[]>
        {
            [AssistantActionRegistry.MeterReadingCreate] = new[] { "nhập chỉ số điện tháng 10 phòng A1 là 1000", "ghi số điện mới phòng A1 tháng 10 là 1000" },
            [AssistantActionRegistry.MeterReadingsFind] = new[] { "chỉ số điện phòng A1 là bao nhiêu", "xem số điện phòng A1 tháng trước", "tháng vừa rồi phòng A1 là bao nhiêu" },
            [AssistantActionRegistry.MeterReadingsFindMissing] = new[] { "tháng 10 phòng nào chưa nhập điện", "tìm phòng còn thiếu chỉ số điện" },
            [AssistantActionRegistry.MeterReadingsUpdate] = new[] { "sửa chỉ số điện phòng A1 tháng 10 thành 1050", "cập nhật lại số điện đã nhập" },
            [AssistantActionRegistry.MeterReadingsDelete] = new[] { "xóa chỉ số điện phòng A1 tháng 10", "bỏ bản ghi số điện tháng trước" },
            [AssistantActionRegistry.RoomsFindAll] = new[] { "xem tất cả phòng", "danh sách phòng trọ" },
            [AssistantActionRegistry.RoomsFindVacant] = new[] { "phòng nào còn trống", "xem các phòng chưa có người thuê" },
            [AssistantActionRegistry.RoomsFindOccupied] = new[] { "phòng nào đang thuê", "phòng nào đã cho thuê", "phòng nào đã được cho thuê", "xem các phòng đã có khách" },
            [AssistantActionRegistry.RoomsFindByCode] = new[] { "xem thông tin phòng A1", "chi tiết phòng A1" },
            [AssistantActionRegistry.RoomsCreate] = new[] { "tạo phòng A2 giá 2500000", "thêm phòng trọ mới A2" },
            [AssistantActionRegistry.RoomsUpdate] = new[] { "đổi giá phòng A1 thành 2800000", "cập nhật giá niêm yết phòng A1" },
            [AssistantActionRegistry.RoomsUpdateStatus] = new[] { "đổi trạng thái phòng A1 thành trống", "chuyển phòng A1 sang sửa chữa" },
            [AssistantActionRegistry.TenantsFindAll] = new[] { "xem danh sách khách thuê", "có những người thuê nào" },
            [AssistantActionRegistry.TenantsCreate] = new[] { "thêm khách thuê Nguyễn Văn A", "tạo người thuê mới" },
            [AssistantActionRegistry.TenantsUpdate] = new[] { "đổi số điện thoại khách Nguyễn Văn A", "cập nhật CCCD người thuê" },
            [AssistantActionRegistry.ContractsFindAll] = new[] { "xem tất cả hợp đồng", "danh sách hợp đồng thuê" },
            [AssistantActionRegistry.ContractsFindActive] = new[] { "xem hợp đồng còn hiệu lực", "hợp đồng nào đang hoạt động" },
            [AssistantActionRegistry.ContractsFindByRoom] = new[] { "xem hợp đồng phòng A1", "phòng A1 đang có hợp đồng nào" },
            [AssistantActionRegistry.ContractsCreate] = new[] { "tạo hợp đồng phòng A1 cho Nguyễn Văn A", "lập hợp đồng thuê mới", "tạo hợp đồng giá 2 triệu 5 cọc phải thu 2 triệu 5 đã đưa 2 triệu" },
            [AssistantActionRegistry.ContractsEnd] = new[] { "kết thúc hợp đồng phòng A1", "trả phòng và chốt hợp đồng A1" },
            [AssistantActionRegistry.ContractsUpdate] = new[] { "sửa tiền cọc hợp đồng phòng A1", "cập nhật số người ở hợp đồng" },
            [AssistantActionRegistry.ContractsCancel] = new[] { "hủy hợp đồng phòng A1", "chấm dứt hợp đồng do khách không thuê" },
            [AssistantActionRegistry.ContractsDeleteEnded] = new[] { "xóa hợp đồng cũ đã kết thúc", "xóa vĩnh viễn hợp đồng ID 5" },
            [AssistantActionRegistry.InvoicesFindAll] = new[] { "xem danh sách hóa đơn", "các hóa đơn tháng 10" },
            [AssistantActionRegistry.InvoicesFindUnpaid] = new[] { "hóa đơn nào chưa thanh toán", "xem các hóa đơn còn nợ" },
            [AssistantActionRegistry.InvoicesFindByRoomMonth] = new[] { "xem hóa đơn phòng A1 tháng 10", "tiền phòng A1 tháng 10 bao nhiêu" },
            [AssistantActionRegistry.InvoicesCreateMonthlyBulk] = new[] { "tạo hóa đơn tháng 10 cho tất cả phòng", "lập hóa đơn hàng tháng" },
            [AssistantActionRegistry.InvoicesCreateMonthlyBulkAfterMeterCheck] = new[] { "kiểm tra điện rồi tạo hóa đơn tháng 10", "chỉ tạo hóa đơn khi đủ số điện" },
            [AssistantActionRegistry.InvoicesMarkPaid] = new[] { "đánh dấu hóa đơn 12 đã thanh toán", "ghi nhận hóa đơn đã trả tiền" },
            [AssistantActionRegistry.InvoicesMarkUnpaid] = new[] { "chuyển hóa đơn về chưa thanh toán", "hủy trạng thái đã trả tiền" },
            [AssistantActionRegistry.InvoicesUpdateElectricity] = new[] { "sửa tiền điện trên hóa đơn phòng A1", "cập nhật phí điện hóa đơn" },
            [AssistantActionRegistry.InvoicesReplace] = new[] { "tạo lại hóa đơn phòng A1 tháng 10", "thay thế hóa đơn sai" },
            [AssistantActionRegistry.InvoicesUpdate] = new[] { "giảm giá hóa đơn phòng A1", "cập nhật nợ cũ và ghi chú hóa đơn" },
            [AssistantActionRegistry.InvoicesDelete] = new[] { "xóa hóa đơn phòng A1 tháng 10", "hủy bỏ hóa đơn sai" },
            [AssistantActionRegistry.InvoicesDownloadPdf] = new[] { "tải PDF hóa đơn phòng A1", "xuất hóa đơn thành file PDF" },
            [AssistantActionRegistry.TransactionsFind] = new[] { "xem các khoản thu chi", "danh sách chi phí tháng 10" },
            [AssistantActionRegistry.TransactionsCreate] = new[] { "ghi khoản chi sửa điện 500000", "thêm giao dịch thu tiền" },
            [AssistantActionRegistry.TransactionsUpdate] = new[] { "sửa giao dịch ID 15 thành 400000", "cập nhật khoản thu chi" },
            [AssistantActionRegistry.TransactionsDelete] = new[] { "xóa giao dịch thu chi ID 15", "bỏ khoản chi đã nhập sai" },
            [AssistantActionRegistry.PaymentsFind] = new[] { "xem lịch sử chuyển khoản", "giao dịch ngân hàng chưa đối soát" },
            [AssistantActionRegistry.PaymentsReconcile] = new[] { "đối soát giao dịch ngân hàng với hóa đơn", "khớp chuyển khoản ID 5" },
            [AssistantActionRegistry.PaymentsDelete] = new[] { "xóa giao dịch ngân hàng ID 8", "bỏ chuyển khoản đã ghi sai" },
            [AssistantActionRegistry.ReportsMonthlyRevenue] = new[] { "doanh thu tháng 10 bao nhiêu", "xem báo cáo tổng thu" },
            [AssistantActionRegistry.ReportsMonthlyExpense] = new[] { "chi phí tháng 10 bao nhiêu", "xem báo cáo tổng chi" },
            [AssistantActionRegistry.ReportsMonthlyProfitLoss] = new[] { "tháng 10 lời lỗ bao nhiêu", "xem lợi nhuận tháng này" },
            [AssistantActionRegistry.ReportsPaymentStatus] = new[] { "tình trạng thanh toán tháng 10", "bao nhiêu hóa đơn đã trả" }
        };

        public IReadOnlyList<string> GetPhrases(string intent, IEnumerable<string>? registeredExamples = null)
        {
            var cores = CorePhrases.TryGetValue(intent, out var configured)
                ? configured.ToList()
                : new List<string>();
            cores.AddRange((registeredExamples ?? Array.Empty<string>()).Where(x => !string.IsNullOrWhiteSpace(x)));
            cores = cores.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (cores.Count == 0)
            {
                cores.Add(intent.Replace('.', ' '));
            }

            var phrases = new HashSet<string>(cores, StringComparer.OrdinalIgnoreCase);
            for (var prefixIndex = 0; prefixIndex < Prefixes.Length; prefixIndex++)
            {
                for (var suffixIndex = 0; suffixIndex < Suffixes.Length; suffixIndex++)
                {
                    var core = cores[(prefixIndex + suffixIndex) % cores.Count];
                    phrases.Add(string.Join(" ", new[] { Prefixes[prefixIndex], core, Suffixes[suffixIndex] }
                        .Where(x => !string.IsNullOrWhiteSpace(x))).Trim());
                }
            }

            return phrases.Take(PhrasesPerAction).ToList();
        }
    }
}
