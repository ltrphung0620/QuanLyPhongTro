# QuanLyPhongTro

Hệ thống quản lý phòng trọ giúp theo dõi phòng, khách thuê, hợp đồng, chỉ số điện nước, hóa đơn, thanh toán và báo cáo.

## Overview

Dự án được xây dựng theo mô hình tách backend và frontend:

- **Backend:** ASP.NET Core Web API
- **Frontend:** React + Vite
- **Database:** SQL Server
- **ORM:** Entity Framework Core

Phù hợp cho bài tập lớn, đồ án cá nhân hoặc hệ thống quản lý phòng trọ quy mô nhỏ đến vừa.

---

## Main Features

- Quản lý phòng trọ
- Quản lý người thuê
- Quản lý hợp đồng
- Ghi nhận chỉ số điện nước
- Tạo và quản lý hóa đơn
- Hỗ trợ xuất hóa đơn PDF
- Quản lý thanh toán / giao dịch
- Xem báo cáo tổng hợp

---

## Project Structure

```bash
QuanLyPhongTro/
├── Controllers/
├── Data/
├── Dtos/
├── Interfaces/
├── Migrations/
├── Models/
├── Repositories/
├── Services/
├── react-ui/
├── Program.cs
├── appsettings.json
├── appsettings.Production.json
├── NhaTro.csproj
└── NhaTro.sln
```

---

## Backend Tech Stack

- ASP.NET Core Web API
- .NET 9
- Entity Framework Core
- SQL Server
- Swagger / OpenAPI
- QuestPDF

---

## Frontend Tech Stack

- React
- Vite
- JavaScript
- CSS

---

## Available API Modules

Các API hiện tại trong thư mục `Controllers` gồm:

- `RoomsController`
- `TenantsController`
- `ContractsController`
- `MeterReadingsController`
- `InvoicesController`
- `PaymentsController`
- `ReportsController`
- `TransactionsController`

---

## Backend Setup

### 1. Clone repository

```bash
git clone https://github.com/ltrphung0620/QuanLyPhongTro.git
cd QuanLyPhongTro
```

### 2. Configure database connection

Mở file `appsettings.json` và chỉnh lại chuỗi kết nối cho phù hợp với máy của bạn:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=.;Database=NhaTroDb;Trusted_Connection=True;TrustServerCertificate=True"
}
```

Nếu bạn dùng SQL Server Authentication, hãy đổi sang dạng:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=YOUR_SERVER;Database=NhaTroDb;User Id=YOUR_USER;Password=YOUR_PASSWORD;TrustServerCertificate=True"
}
```

### 3. Restore packages

```bash
dotnet restore
```

### 4. Update database

Nếu project đã có migrations:

```bash
dotnet ef database update
```

### 5. Run backend

```bash
dotnet run
```

Mặc định sau khi chạy, bạn có thể mở Swagger để test API.

---

## Frontend Setup

Frontend nằm trong thư mục `react-ui`.

### 1. Move to frontend folder

```bash
cd react-ui
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run frontend

```bash
npm run dev
```

### 4. Build frontend

```bash
npm run build
```

---

## Notes

- Backend sử dụng SQL Server nên cần cài SQL Server hoặc SQL Server Express trước khi chạy.
- Dự án có hỗ trợ tạo PDF hóa đơn.
- Trong backend có đăng ký service xử lý chỉ số điện nước từ ảnh, nên có thể đang hướng tới chức năng OCR cho nhập liệu nhanh.
- Thư mục `publish/` có thể dùng cho bản build/deploy.
- Thư mục `react-ui/README.md` hiện vẫn là README mặc định của Vite, nên có thể cập nhật thêm nếu muốn đồng bộ tài liệu.

---

## Development

### Backend

```bash
dotnet watch run
```

### Frontend

```bash
npm run dev
```

---

## Future Improvements

- Thêm authentication / authorization
- Phân quyền chủ trọ / người thuê / quản trị viên
- Dashboard trực quan hơn
- Upload ảnh hóa đơn / công tơ
- Tích hợp thanh toán online
- Dockerize toàn bộ hệ thống

---

## Author

**ltrphung0620**

GitHub repository: `ltrphung0620/QuanLyPhongTro`

---

## License

This project is for learning, personal, and educational purposes.
