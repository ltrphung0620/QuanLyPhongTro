# Authentication & Multi-Tenancy Flow

Tài liệu này mô tả chi tiết quy trình xác thực (Authentication) và kiến trúc đa người dùng (Multi-tenant) vừa được triển khai.

## 1. Quy Trình Đăng Ký (Registration)

1. **Người dùng nhập Email và Mật khẩu** trên giao diện `/register`.
2. Frontend gọi API `POST /api/Auth/register`.
3. Backend kiểm tra xem Email đã tồn tại chưa. Nếu chưa, tạo tài khoản mới với trạng thái `IsActive = false`.
4. Mật khẩu được băm (hash) bảo mật bằng thuật toán **BCrypt**.
5. Backend tạo ngẫu nhiên một mã **OTP 6 chữ số** và gửi tới Gmail của người dùng qua giao thức SMTP.

## 2. Quy Trình Xác Thực OTP (OTP Verification)

1. Giao diện hiển thị Modal yêu cầu nhập 6 số OTP.
2. Người dùng nhập mã từ Email. Frontend gọi `POST /api/Auth/verify-otp`.
3. Backend kiểm tra mã OTP và thời gian hết hạn (5 phút).
4. Nếu hợp lệ, tài khoản được cập nhật `IsActive = true` và xóa OTP cũ.
5. Người dùng được chuyển hướng đến trang Đăng nhập (`/login`).

## 3. Quy Trình Đăng Nhập (Login)

1. Người dùng nhập Email và Mật khẩu. Frontend gọi `POST /api/Auth/login`.
2. Backend kiểm tra tài khoản:
   - Tài khoản có tồn tại không?
   - `IsActive` có bằng `true` không? (Nếu chưa xác thực OTP sẽ bị từ chối).
   - Kiểm tra mật khẩu bằng BCrypt.
3. Nếu hợp lệ, backend tạo ra một **JWT Token** chứa thông tin `UserId` và `Email`, hạn sử dụng 7 ngày.
4. Token được trả về và lưu trong `localStorage` tại Frontend.

## 4. Kiến Trúc Multi-tenant (Cách ly dữ liệu)

Để đảm bảo mỗi người dùng (Chủ trọ) chỉ xem được dữ liệu của mình (Phòng, Hợp đồng, Khách thuê, Hóa đơn...), hệ thống áp dụng kỹ thuật **Global Query Filters** của Entity Framework Core.

### Chi tiết kỹ thuật:
- Mọi bảng dữ liệu lõi (`Rooms`, `Tenants`, `Contracts`, `Invoices`...) đều có thêm cột `AppUserId`.
- Khi có bất kỳ request API nào gửi từ Frontend, **JWT Token** sẽ được tự động đính kèm vào Header (`Authorization: Bearer <token>`).
- Middleware của ASP.NET Core sẽ giải mã JWT và lấy ra `UserId`.
- Service `ICurrentUserService` cung cấp `UserId` này cho `NhaTroDbContext`.
- Trong `NhaTroDbContext`, một bộ lọc toàn cục (Global Query Filter) được áp dụng:
  ```csharp
  modelBuilder.Entity<Room>().HasQueryFilter(e => e.AppUserId == _currentUserService.UserId);
  ```
- **Kết quả:** Bất kỳ câu lệnh `_context.Rooms.ToList()` nào cũng tự động được EF Core dịch thành `SELECT * FROM Rooms WHERE AppUserId = @currentUserId`. Không cần phải thêm mệnh đề `Where` thủ công trong các Controller nữa, đảm bảo **an toàn tuyệt đối** và tránh rò rỉ dữ liệu.

## 5. Middleware Frontend
File `src/api.js` đã được cập nhật:
- Tự động đính kèm `Bearer Token` vào mọi request.
- Bắt lỗi `401 Unauthorized` (Token hết hạn hoặc không hợp lệ) để tự động xóa token và đẩy người dùng về trang `/login`.

---
*Đây là một kiến trúc SaaS tiêu chuẩn, bảo mật và dễ dàng mở rộng trong tương lai.*
