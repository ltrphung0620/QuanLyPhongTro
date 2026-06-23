# LPH Tenant Mobile App

Ứng dụng mobile dành riêng cho khách thuê, dùng React Native + Expo Router.

## Cấu hình

Tạo file `.env` từ `.env.example`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:5103
EXPO_PUBLIC_VIETQR_BANK_CODE=mbbank
EXPO_PUBLIC_VIETQR_ACCOUNT_NO=556062006
EXPO_PUBLIC_VIETQR_ACCOUNT_NAME=LaiTrinhPhuocHung
```

Gợi ý URL:

- Expo Go trên điện thoại thật: dùng IP LAN của máy chạy backend, ví dụ `http://192.168.1.10:5103`.
- Android Emulator: thường dùng `http://10.0.2.2:5103`.
- iOS Simulator: thường dùng `http://127.0.0.1:5103` hoặc IP LAN nếu cần.

## Chạy app

```bash
npm install
npx expo start
```

Sau đó:

- Expo Go: quét QR trong terminal.
- Android Emulator: nhấn `a`.
- iOS Simulator: nhấn `i` trên macOS.

## Luồng chính

- Login bằng tài khoản Tenant.
- Nếu role không phải `Tenant`, app sẽ từ chối đăng nhập.
- Nếu tài khoản cần đổi mật khẩu, app chuyển sang màn đổi mật khẩu.
- JWT được lưu bằng `expo-secure-store`.
- App kết nối SignalR `/hubs/realtime` và lắng nghe `tenant.invoice.created`.
- App đăng ký Expo push token qua `POST /api/tenant/devices`.
