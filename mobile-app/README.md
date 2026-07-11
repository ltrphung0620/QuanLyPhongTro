# QLPT Mobile

Expo React Native app cho hệ thống quản lý phòng trọ QLPT.

## Chạy local

```powershell
cd mobile-app
npm install
npm run start
```

Mặc định app gọi API production:

```text
https://qlpt.io.vn:18444/api
```

Muốn đổi API khi dev:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="https://your-domain/api"
npm run start
```

## Build test nội bộ

```powershell
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```

Với iOS cần Apple Developer account:

```powershell
eas build --profile preview --platform ios
```
