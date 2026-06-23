# Danh sách chức năng mở rộng của AI Agent

> Trạng thái: Đã triển khai đầy đủ ngày 20/06/2026. Danh sách bên dưới được giữ lại làm ma trận kiểm thử và tài liệu đối chiếu API/intent.

Dưới đây là chi tiết các chức năng đã được cấu hình tool, phân tích ngôn ngữ, preview/xác nhận và thực thi bởi AI Agent:

---

### 1. Quản lý phòng trọ (Rooms)
* **Cập nhật thông tin phòng trọ:**
  * **API Endpoint:** `PUT /api/Rooms/{id}`
  * **Intent dự kiến:** `rooms.update`
  * **Ví dụ yêu cầu:** *"Đổi giá phòng A1 thành 2.8 triệu"* hoặc *"Cập nhật giá phòng A2 là 3.000.000đ"*.
* **Cập nhật trạng thái phòng trọ:**
  * **API Endpoint:** `PATCH /api/Rooms/{id}/status`
  * **Intent dự kiến:** `rooms.update_status`
  * **Ví dụ yêu cầu:** *"Sửa trạng thái phòng A1 thành đang sửa chữa"* hoặc *"Đổi phòng A2 sang trống"*.

---

### 2. Quản lý người thuê (Tenants)
* **Cập nhật thông tin người thuê:**
  * **API Endpoint:** `PUT /api/Tenants/{id}`
  * **Intent dự kiến:** `tenants.update`
  * **Ví dụ yêu cầu:** *"Đổi số điện thoại khách Nguyễn Văn A thành 0987654321"* hoặc *"Cập nhật số CCCD của chị Vy"*.

---

### 3. Quản lý hợp đồng (Contracts)
* **Cập nhật thông tin hợp đồng:**
  * **API Endpoint:** `PUT /api/Contracts/{id}`
  * **Intent dự kiến:** `contracts.update`
  * **Ví dụ yêu cầu:** *"Sửa tiền cọc hợp đồng phòng A1 thành 5 triệu"* hoặc *"Đổi số người ở hợp đồng phòng B2 là 3 người"*.
* **Hủy hợp đồng thuê:**
  * **API Endpoint:** `POST /api/Contracts/{id}/cancel`
  * **Intent dự kiến:** `contracts.cancel` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Hủy hợp đồng phòng A1 từ ngày 15/10 lý do khách chuyển đi"* hoặc *"Hủy hợp đồng phòng B1 do khách bùng cọc"*.
* **Xóa hợp đồng đã kết thúc:**
  * **API Endpoint:** `DELETE /api/Contracts/{id}`
  * **Intent dự kiến:** `contracts.delete_ended` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Xóa hợp đồng cũ đã kết thúc của phòng A1"* hoặc *"Xóa hợp đồng ID 5"*.

---

### 4. Chỉ số điện nước (Meter Readings)
* **Cập nhật chỉ số điện nước đã nhập:**
  * **API Endpoint:** `PATCH /api/MeterReadings/current-reading`
  * **Intent dự kiến:** `meter_readings.update`
  * **Ví dụ yêu cầu:** *"Sửa lại chỉ số điện phòng A1 tháng 10 là 1050"* hoặc *"Cập nhật số điện phòng B2 tháng 9 là 890"*.
* **Xóa bản ghi chỉ số điện nước:**
  * **API Endpoint:** `DELETE /api/MeterReadings/{id}`
  * **Intent dự kiến:** `meter_readings.delete` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Xóa số điện tháng 10 của phòng A1"* hoặc *"Xóa chỉ số điện tháng này phòng B2"*.

---

### 5. Hóa đơn hàng tháng (Invoices)
* **Đổi trạng thái hóa đơn về chưa thanh toán:**
  * **API Endpoint:** `PATCH /api/Invoices/{id}/mark-unpaid`
  * **Intent dự kiến:** `invoices.mark_unpaid` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Chuyển hóa đơn phòng A1 tháng 10 về chưa thanh toán"* hoặc *"Hủy thanh toán hóa đơn tháng 10 phòng B1"*.
* **Cập nhật chỉ số điện nước trên hóa đơn:**
  * **API Endpoint:** `PATCH /api/Invoices/electricity`
  * **Intent dự kiến:** `invoices.update_electricity`
  * **Ví dụ yêu cầu:** *"Sửa số điện trên hóa đơn phòng A1 tháng 10 thành 1060"*.
* **Tạo lại/thay thế hóa đơn mới:**
  * **API Endpoint:** `POST /api/Invoices/{id}/replace`
  * **Intent dự kiến:** `invoices.replace` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Tạo lại hóa đơn tháng 10 cho phòng A1"* hoặc *"Replace hóa đơn phòng B2"*.
* **Cập nhật giảm giá/nợ cũ/ghi chú trên hóa đơn:**
  * **API Endpoint:** `PUT /api/Invoices/{id}`
  * **Intent dự kiến:** `invoices.update`
  * **Ví dụ yêu cầu:** *"Giảm giá 100k cho hóa đơn phòng A1 tháng 10"* hoặc *"Cập nhật nợ cũ hóa đơn phòng B2 là 500k"*.
* **Xóa hóa đơn:**
  * **API Endpoint:** `DELETE /api/Invoices/{id}`
  * **Intent dự kiến:** `invoices.delete` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Xóa hóa đơn phòng A1 tháng 10"* hoặc *"Hủy hóa đơn tháng này của phòng B2"*.
* **Tải xuống hóa đơn PDF:**
  * **API Endpoint:** `GET /api/Invoices/{id}/pdf`
  * **Intent dự kiến:** `invoices.download_pdf`
  * **Ví dụ yêu cầu:** *"Tải PDF hóa đơn phòng A1 tháng 10"* hoặc *"Xuất PDF hóa đơn phòng B2"*.

---

### 6. Sổ quỹ thu chi (Transactions)
* **Cập nhật giao dịch thu chi:**
  * **API Endpoint:** `PUT /api/Transactions/{id}`
  * **Intent dự kiến:** `transactions.update`
  * **Ví dụ yêu cầu:** *"Sửa chi phí sửa nước hôm nay thành 400k"* hoặc *"Cập nhật giao dịch thu tiền phòng A1 thành 3 triệu"*.
* **Xóa giao dịch thu chi:**
  * **API Endpoint:** `DELETE /api/Transactions/{id}`
  * **Intent dự kiến:** `transactions.delete` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Xóa giao dịch chi 500k ngày hôm qua"* hoặc *"Xóa giao dịch thu ID 15"*.

---

### 7. Thanh toán ngân hàng tự động (Payments - SePay)
* **Tra cứu danh sách lịch sử chuyển khoản ngân hàng:**
  * **API Endpoint:** `GET /api/Payments/transactions`
  * **Intent dự kiến:** `payments.find`
  * **Ví dụ yêu cầu:** *"Xem lịch sử chuyển khoản hôm nay"* hoặc *"Danh sách giao dịch ngân hàng chưa đối soát"*.
* **Đối soát thủ công giao dịch ngân hàng với hóa đơn phòng:**
  * **API Endpoint:** `POST /api/Payments/transactions/{id}/reconcile`
  * **Intent dự kiến:** `payments.reconcile` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Đối soát giao dịch ngân hàng ID 5 cho hóa đơn phòng A1"* hoặc *"Khớp giao dịch 2 triệu với hóa đơn tháng 10 phòng B2"*.
* **Xóa giao dịch thanh toán ngân hàng:**
  * **API Endpoint:** `DELETE /api/Payments/transactions/{id}`
  * **Intent dự kiến:** `payments.delete` (High-risk - Cần Safety Layer)
  * **Ví dụ yêu cầu:** *"Xóa giao dịch ngân hàng số 20"* hoặc *"Xóa chuyển khoản ngân hàng ID 8"*.
