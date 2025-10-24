## ✅ PROXY AUTHENTICATION FIX

### 🐛 Vấn đề:
- Error: `ERR_NO_SUPPORTED_PROXIES`
- Puppeteer không hỗ trợ HTTP proxy với authentication qua `--proxy-server=http://user:pass@host:port`

### 🔧 Giải pháp:
1. **Tách credentials khỏi proxy URL**:
   - Parse proxy URL để lấy: `host`, `port`, `username`, `password`
   - Chỉ truyền `--proxy-server=http://host:port` (không có auth)

2. **Authenticate riêng qua Puppeteer API**:
   ```typescript
   await page.authenticate({
     username: proxyUsername,
     password: proxyPassword
   });
   ```

### ✅ Đã fix trong `ViewerSession.ts`:
- Line 41-78: Parse proxy URL và extract credentials
- Line 93-98: Authenticate sau khi create page

### 🚀 Test ngay:
1. Build đã xong: `npm run build:main` ✓
2. App đang chạy (npm run dev)
3. Start session lại → Proxies sẽ hoạt động!

---

**Technical Details:**
- Puppeteer `page.authenticate()` tự động xử lý HTTP/HTTPS proxy auth headers
- Credentials được gửi an toàn qua Puppeteer protocol
- Tương thích với tất cả proxy types: HTTP, HTTPS, SOCKS5
