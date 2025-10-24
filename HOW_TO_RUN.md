# 🚀 Hướng Dẫn Chạy Tool Live

## ✅ Ứng Dụng Đã Build Thành Công

Ứng dụng **Tool Live** đã được build và sẵn sàng chạy trên Windows mà không cần `npm run dev`.

---

## 📁 Vị Trí File

Ứng dụng đã được build tại:

```plaintext
release/Tool Live-win32-x64/
```

---

## 🎯 Cách Chạy Ứng Dụng

### **Phương án 1: Chạy trực tiếp từ folder release** (KHUYẾN NGHỊ)

1. Mở folder: `release\Tool Live-win32-x64\`
2. Double-click vào file: **`Tool Live.exe`**
3. App sẽ mở lên giống như khi chạy `npm run dev`

### **Phương án 2: Sử dụng file batch script**

Từ thư mục gốc của project, double-click vào file: **`Start-Tool-Live.bat`**

App sẽ tự động mở từ folder release.

### **Phương án 3: Tạo shortcut trên Desktop**

1. Vào folder `release\Tool Live-win32-x64\`
2. Click phải vào `Tool Live.exe`
3. Chọn "Gửi đến > Desktop (create shortcut)"
4. Từ giờ chỉ cần click vào shortcut trên desktop để mở app

---

## 📦 Phân Phối Ứng Dụng

Nếu muốn gửi app cho người khác sử dụng:

1. Nén toàn bộ folder `release\Tool Live-win32-x64\` thành file ZIP
2. Gửi file ZIP cho người khác
3. Họ chỉ cần giải nén và chạy `Tool Live.exe`

**Lưu ý:** Folder này đã bao gồm tất cả dependencies cần thiết, không cần cài đặt Node.js hay npm.

---

## 🔧 Build Lại Ứng Dụng

Nếu thay đổi code và muốn build lại:

```powershell
# Build lại app
npm run package:win-portable
```

App mới sẽ được tạo tại: `release\Tool Live-win32-x64\`

**Quan trọng:** Sau khi sửa code trong `electron/` hoặc `src/`, luôn chạy lệnh trên để build lại.

---

## 📋 Các Lệnh Có Sẵn

```powershell
# Chạy ở chế độ development (có hot reload)
npm run dev

# Build app (không package)
npm run build

# Build và tạo portable executable cho Windows
npm run package:win-portable

# Chạy app đã build (không cần package lại)
.\Start-Tool-Live.bat
```

---

## 🎉 Kết Luận

Giờ bạn có thể:

- ✅ Chạy app bằng cách double-click `Tool Live.exe`
- ✅ Không cần `npm run dev` nữa
- ✅ Chia sẻ app cho người khác mà không cần cài Node.js
- ✅ Tạo shortcut trên desktop để mở nhanh
- ✅ App chạy hoàn toàn offline, không cần internet (trừ khi truy cập YouTube)

**Chúc mừng! Ứng dụng của bạn đã sẵn sàng!** 🚀

---

## 🐛 Khắc Phục Sự Cố

### Nếu app không mở được

1. **Kiểm tra Windows Defender**: Có thể chặn file .exe lạ
2. **Chạy với quyền Administrator**: Click phải vào `Tool Live.exe` → "Run as administrator"
3. **Kiểm tra RAM**: Đảm bảo máy có đủ RAM trống (tối thiểu 2GB)

### Nếu có lỗi "Cannot find module"

Build lại app:

```powershell
npm run package:win-portable
```

### Xem logs chi tiết

Logs được lưu trong:

```plaintext
release\Tool Live-win32-x64\resources\app\logs\
```
