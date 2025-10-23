# Hướng dẫn Cài đặt tool-live trên Windows

## Phương pháp 1: Sử dụng Script Tự động (Khuyến nghị)

### Cách 1: Double-click file BAT
1. Mở thư mục project
2. Double-click vào file `quick-start.bat`
3. Script sẽ tự động:
   - Kiểm tra Node.js và npm
   - Cài đặt Node.js nếu chưa có (qua winget)
   - Cài đặt tất cả dependencies
   - Tạo các thư mục cần thiết
   - Chạy development server

### Cách 2: Chạy PowerShell Script
1. Mở PowerShell trong thư mục project
2. Chạy lệnh:
   ```powershell
   .\setup.ps1
   ```
3. Nếu gặp lỗi "script execution is disabled", chạy:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass
   .\setup.ps1
   ```

## Phương pháp 2: Cài đặt Thủ công

### Bước 1: Cài đặt Node.js

#### Tùy chọn A: Sử dụng winget (Windows 10/11)
```powershell
winget install OpenJS.NodeJS.LTS
```

#### Tùy chọn B: Download trực tiếp
1. Truy cập: https://nodejs.org/
2. Download phiên bản LTS (v20.x hoặc mới hơn)
3. Chạy installer và làm theo hướng dẫn
4. Khởi động lại terminal sau khi cài đặt

### Bước 2: Kiểm tra cài đặt
```powershell
node --version
npm --version
```

### Bước 3: Cài đặt dependencies của project
```powershell
cd "C:\Users\Public\Code working\tool-live"
npm install
```

### Bước 4: Tạo các thư mục cần thiết
```powershell
New-Item -ItemType Directory -Force -Path "data"
New-Item -ItemType Directory -Force -Path "logs"
```

### Bước 5: Cấu hình proxy (tùy chọn)
```powershell
# Copy file cấu hình mẫu
Copy-Item "config\proxies.example.json" "config\proxies.json"

# Hoặc mở file và chỉnh sửa
notepad config\proxies.json
```

### Bước 6: Chạy development server
```powershell
npm run dev
```

## Các lệnh hữu ích

### Development
```powershell
# Chạy development server với hot reload
npm run dev

# Kiểm tra lỗi TypeScript
npm run type-check

# Chạy linter
npm run lint
```

### Build và Package
```powershell
# Build project
npm run build

# Build renderer (Vite)
npm run build:renderer

# Build main process (Electron)
npm run build:main

# Package ứng dụng Electron
npm run package

# Package cho Windows
npm run package:win
```

### Testing
```powershell
# Chạy tests
npm run test

# Chạy tests với coverage
npm run test:coverage
```

### Maintenance
```powershell
# Cập nhật dependencies
npm update

# Kiểm tra outdated packages
npm outdated

# Làm sạch node_modules và reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

## Yêu cầu Hệ thống

### Phần cứng tối thiểu
- **CPU**: Intel Core i5 hoặc tương đương
- **RAM**: 8GB (khuyến nghị 16GB cho 30 sessions)
- **Ổ cứng**: 2GB trống

### Phần mềm
- **OS**: Windows 10/11 (64-bit)
- **Node.js**: v18.0.0 trở lên (khuyến nghị v20.x LTS)
- **npm**: v9.0.0 trở lên
- **PowerShell**: v5.1 trở lên (có sẵn trên Windows 10/11)

## Xử lý Sự cố

### Lỗi: "cannot be loaded because running scripts is disabled"
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass
```

### Lỗi: "node is not recognized"
1. Khởi động lại terminal/PowerShell
2. Nếu vẫn lỗi, thêm Node.js vào PATH:
   - Mở System Properties → Environment Variables
   - Thêm `C:\Program Files\nodejs` vào PATH
   - Khởi động lại terminal

### Lỗi: "npm ERR! EACCES: permission denied"
1. Chạy PowerShell/CMD với quyền Administrator
2. Hoặc thay đổi npm prefix:
   ```powershell
   npm config set prefix "%APPDATA%\npm"
   ```

### Lỗi: "Cannot find module"
```powershell
# Xóa và cài lại dependencies
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Lỗi: "Port already in use"
```powershell
# Tìm process đang dùng port (ví dụ: 5173)
netstat -ano | findstr :5173

# Kill process (thay <PID> bằng Process ID tìm được)
taskkill /PID <PID> /F
```

## Cấu trúc Thư mục Sau Khi Setup

```
tool-live/
├── node_modules/         # Dependencies (tự động tạo)
├── data/                 # Thư mục dữ liệu (tự động tạo)
├── logs/                 # Thư mục logs (tự động tạo)
├── config/
│   ├── proxies.json      # Cấu hình proxy (copy từ example)
│   └── default.json      # Cấu hình mặc định
├── setup.ps1             # Script setup tự động
├── quick-start.bat       # Quick start script
└── ...
```

## Tiếp Theo

Sau khi setup thành công:
1. Đọc [README.md](README.md) để hiểu về project
2. Đọc [PLAN.md](PLAN.md) để biết kế hoạch phát triển
3. Cấu hình proxy trong `config/proxies.json`
4. Chạy `npm run dev` để bắt đầu development

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra phần "Xử lý Sự cố" ở trên
2. Xem logs trong thư mục `logs/`
3. Tạo issue trên GitHub repository

---

**Cập nhật**: October 23, 2025
