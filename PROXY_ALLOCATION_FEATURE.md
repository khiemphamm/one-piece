# Tính năng Phân bổ View cho Proxy (Proxy Allocation Feature)

## Tổng quan

Tính năng **Proxy Allocation** cho phép phân bổ và quản lý số lượng viewers trên mỗi proxy một cách thông minh và tối ưu. Thay vì phân bổ ngẫu nhiên, hệ thống sẽ tự động phân phối viewers đều đặn trên các proxy có sẵn, đảm bảo không vượt quá giới hạn cho phép của mỗi proxy.

## Lợi ích

✅ **Phân phối đồng đều**: Viewers được phân bổ đều trên các proxy, tránh tình trạng một proxy bị quá tải
✅ **Kiểm soát tốt hơn**: Giới hạn số viewers tối đa trên mỗi proxy để tránh bị phát hiện
✅ **Tối ưu hiệu suất**: Tự động chọn proxy có ít viewers nhất
✅ **Giám sát real-time**: Theo dõi số viewers hiện tại và capacity của từng proxy
✅ **Tự động giải phóng**: Tự động release slots khi viewers dừng lại

## Cấu hình

### 1. Cấu hình mặc định (config/default.json)

```json
{
  "proxy": {
    "maxViewersPerProxy": 5,        // Số viewers tối đa mỗi proxy
    "useSmartAllocation": true       // Bật tính năng phân bổ thông minh
  }
}
```

### 2. Cấu hình khi khởi động session

```typescript
// Ví dụ 1: Sử dụng cấu hình mặc định
await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=...',
  viewerCount: 20
});

// Ví dụ 2: Tùy chỉnh max viewers per proxy
await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=...',
  viewerCount: 20,
  maxViewersPerProxy: 3  // Override: mỗi proxy chỉ có tối đa 3 viewers
});

// Ví dụ 3: Tắt tính năng phân bổ thông minh
await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=...',
  viewerCount: 20,
  useProxyAllocation: false  // Sử dụng phương thức cũ (round-robin)
});
```

## Cách hoạt động

### 1. Quá trình khởi tạo

```
Bước 1: SessionManager nhận yêu cầu start session với 20 viewers
        ↓
Bước 2: Kiểm tra cấu hình maxViewersPerProxy (mặc định: 5)
        ↓
Bước 3: Tính toán số proxy cần thiết: 20 viewers ÷ 5 = 4 proxies
        ↓
Bước 4: Kiểm tra proxy capacity hiện tại
        ↓
Bước 5: Phân bổ viewers lên các proxy có available slots
```

### 2. Thuật toán phân bổ

```typescript
// Cho mỗi viewer:
1. Tìm proxy có current_viewers < max_viewers_per_proxy
2. Ưu tiên proxy có current_viewers thấp nhất (load balancing)
3. Cấp phát viewer slot cho proxy (current_viewers++)
4. Khởi động viewer session với proxy đã được cấp phát
5. Nếu thành công: Mark proxy as successful
6. Nếu thất bại: Release viewer slot (current_viewers--)
```

### 3. Database Schema

```sql
-- Bảng proxies đã được cập nhật
CREATE TABLE proxies (
  id INTEGER PRIMARY KEY,
  proxy_url TEXT UNIQUE NOT NULL,
  type TEXT CHECK(type IN ('http', 'https', 'socks5')),
  status TEXT CHECK(status IN ('active', 'failed', 'pending')),
  fail_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  
  -- ✨ TÍNH NĂNG MỚI ✨
  max_viewers_per_proxy INTEGER DEFAULT 5,  -- Giới hạn viewers
  current_viewers INTEGER DEFAULT 0,        -- Số viewers hiện tại
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Reference

### ProxyManager Methods

#### 1. `getAvailableProxyWithCapacity()`
Lấy proxy có available capacity (chưa đạt giới hạn max_viewers_per_proxy)

```typescript
const proxy = ProxyManager.getAvailableProxyWithCapacity();
if (proxy) {
  console.log(`Proxy ${proxy.id} có ${proxy.max_viewers_per_proxy - proxy.current_viewers} slots khả dụng`);
}
```

#### 2. `allocateViewerToProxy(proxyId: number)`
Cấp phát một viewer slot cho proxy

```typescript
const success = ProxyManager.allocateViewerToProxy(proxyId);
if (success) {
  console.log('Viewer slot allocated successfully');
} else {
  console.log('Proxy đã đầy hoặc không khả dụng');
}
```

#### 3. `releaseViewerFromProxy(proxyId: number)`
Giải phóng một viewer slot từ proxy

```typescript
ProxyManager.releaseViewerFromProxy(proxyId);
// current_viewers sẽ giảm 1
```

#### 4. `updateMaxViewersPerProxy(proxyId: number, maxViewers: number)`
Cập nhật giới hạn viewers cho một proxy cụ thể

```typescript
ProxyManager.updateMaxViewersPerProxy(1, 10);
// Proxy ID 1 giờ có max 10 viewers
```

#### 5. `updateAllProxiesMaxViewers(maxViewers: number)`
Cập nhật giới hạn viewers cho TẤT CẢ proxies

```typescript
ProxyManager.updateAllProxiesMaxViewers(3);
// Tất cả proxies giờ có max 3 viewers
```

#### 6. `getProxiesWithAllocation()`
Lấy danh sách proxies kèm thông tin allocation

```typescript
const proxies = ProxyManager.getProxiesWithAllocation();
proxies.forEach(proxy => {
  console.log(`Proxy ${proxy.id}: ${proxy.current_viewers}/${proxy.max_viewers_per_proxy} (${proxy.availableSlots} slots free)`);
});
```

#### 7. `getStats()`
Lấy thống kê tổng quan (đã được nâng cấp)

```typescript
const stats = ProxyManager.getStats();
console.log(stats);
// Output:
// {
//   total: 10,
//   active: 8,
//   failed: 2,
//   pending: 0,
//   currentViewers: 35,      // ✨ MỚI: Tổng viewers đang hoạt động
//   totalCapacity: 50,       // ✨ MỚI: Tổng capacity của tất cả proxies
//   availableCapacity: 15    // ✨ MỚI: Số slots còn trống
// }
```

### SessionManager Configuration

```typescript
interface SessionConfig {
  livestreamUrl: string;
  viewerCount: number;
  useProxyAllocation?: boolean;      // ✨ MỚI: Enable smart allocation (default: true)
  maxViewersPerProxy?: number;       // ✨ MỚI: Override max viewers per proxy
}
```

## Ví dụ thực tế

### Scenario 1: Khởi động 20 viewers với 5 proxies

```typescript
// Giả sử có 5 proxies, mỗi proxy max 5 viewers
// Total capacity: 5 × 5 = 25 viewers

await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=abc123',
  viewerCount: 20,
  useProxyAllocation: true
});

// Kết quả phân bổ:
// Proxy 1: 4 viewers
// Proxy 2: 4 viewers
// Proxy 3: 4 viewers
// Proxy 4: 4 viewers
// Proxy 5: 4 viewers
// Total: 20 viewers (phân bổ đều)
```

### Scenario 2: Cảnh báo capacity không đủ

```typescript
// Có 3 proxies, mỗi proxy max 5 viewers
// Total capacity: 3 × 5 = 15 viewers
// Nhưng muốn start 20 viewers

await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=abc123',
  viewerCount: 20
});

// Log output:
// ⚠️ Insufficient proxy capacity! Needed: 20, Available: 15
// ⚠️ Some viewers will share proxies or may not have proxies assigned
// ⚠️ No available proxy for viewer #16
// ⚠️ No available proxy for viewer #17
// ... (5 viewers không có proxy)
```

### Scenario 3: Tùy chỉnh max viewers per proxy

```typescript
// Giảm risk detection bằng cách hạn chế mỗi proxy chỉ 2 viewers
await SessionManager.startSession({
  livestreamUrl: 'https://youtube.com/watch?v=abc123',
  viewerCount: 10,
  maxViewersPerProxy: 2  // Override default 5 → 2
});

// Kết quả:
// Cần ít nhất 5 proxies để phân bổ 10 viewers (2 viewers/proxy)
```

### Scenario 4: Monitoring real-time allocation

```typescript
// Trong SessionManager, mỗi 10 giây sẽ log stats
setInterval(() => {
  const stats = ProxyManager.getStats();
  console.log(`
    📊 Proxy Statistics:
    - Total Proxies: ${stats.total}
    - Active Viewers: ${stats.currentViewers}/${stats.totalCapacity}
    - Available Slots: ${stats.availableCapacity}
    - Failed Proxies: ${stats.failed}
  `);
}, 10000);
```

## Xử lý lỗi và Edge Cases

### 1. Không đủ proxies

```typescript
// System sẽ log warning nhưng vẫn tiếp tục
// Viewers không có proxy sẽ start mà không qua proxy (direct connection)
logger.warn('No available proxy for viewer #25');
```

### 2. Proxy allocation failed

```typescript
// Nếu allocateViewerToProxy() fail, system sẽ retry với proxy khác
const allocated = ProxyManager.allocateViewerToProxy(proxyId);
if (!allocated) {
  // Try another proxy
  const nextProxy = ProxyManager.getAvailableProxyWithCapacity();
  if (nextProxy) {
    ProxyManager.allocateViewerToProxy(nextProxy.id);
  }
}
```

### 3. Viewer start failed

```typescript
// Nếu viewer start thất bại, slot sẽ được release ngay lập tức
try {
  await viewerSession.start();
} catch (error) {
  // Auto-release slot
  if (proxy && proxy.id) {
    ProxyManager.releaseViewerFromProxy(proxy.id);
  }
}
```

### 4. Session stop cleanup

```typescript
// Khi stop session, TẤT CẢ allocations sẽ được release
await SessionManager.stopSession();
// → All proxy current_viewers reset về 0
```

## Best Practices

### 1. Chọn max_viewers_per_proxy phù hợp

```typescript
// Residential Proxies (chất lượng cao)
maxViewersPerProxy: 10  // Có thể dùng nhiều viewers

// Datacenter Proxies (dễ bị detect)
maxViewersPerProxy: 3   // Nên giới hạn thấp

// Free/Public Proxies (không ổn định)
maxViewersPerProxy: 1   // Chỉ 1 viewer per proxy
```

### 2. Monitor capacity trước khi start

```typescript
const stats = ProxyManager.getStats();
const neededCapacity = desiredViewerCount;

if (stats.availableCapacity < neededCapacity) {
  console.log(`⚠️ Warning: Need ${neededCapacity - stats.availableCapacity} more proxy slots`);
  console.log('Options:');
  console.log('1. Add more proxies');
  console.log('2. Reduce viewer count');
  console.log('3. Increase maxViewersPerProxy (risk detection)');
}
```

### 3. Periodic cleanup

```typescript
// Reset proxy stats định kỳ (nếu có proxies bị stuck)
setInterval(() => {
  ProxyManager.resetProxyStats();
  logger.info('Proxy stats reset complete');
}, 24 * 60 * 60 * 1000); // Mỗi 24 giờ
```

## Migration từ version cũ

Nếu bạn đang dùng version cũ không có tính năng này:

```typescript
// CŨ (vẫn hoạt động)
await SessionManager.startSession({
  livestreamUrl: url,
  viewerCount: 20
});

// MỚI (recommended)
await SessionManager.startSession({
  livestreamUrl: url,
  viewerCount: 20,
  useProxyAllocation: true,  // Bật tính năng mới
  maxViewersPerProxy: 5      // Tùy chỉnh limit
});
```

Database sẽ tự động thêm columns mới khi khởi động lần đầu.

## Troubleshooting

### Issue 1: "Proxy đã đầy nhưng vẫn nhận viewers"

```typescript
// Check current_viewers
const proxies = ProxyManager.getAllProxies();
proxies.forEach(p => {
  if (p.current_viewers > p.max_viewers_per_proxy) {
    console.log(`❌ Proxy ${p.id} overflow: ${p.current_viewers}/${p.max_viewers_per_proxy}`);
    // Fix: Reset manually
    ProxyManager.updateMaxViewersPerProxy(p.id, p.current_viewers + 5);
  }
});
```

### Issue 2: "Slots không được release sau stop"

```typescript
// Manual cleanup
const proxies = ProxyManager.getAllProxies();
proxies.forEach(p => {
  db.prepare('UPDATE proxies SET current_viewers = 0 WHERE id = ?').run(p.id);
});
logger.info('Force reset all proxy allocations');
```

### Issue 3: "Không tìm thấy proxy với capacity"

```typescript
// Kiểm tra database
const result = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN current_viewers < max_viewers_per_proxy THEN 1 ELSE 0 END) as available
  FROM proxies
  WHERE status IN ('active', 'pending')
`).get();

console.log(`Total proxies: ${result.total}, Available: ${result.available}`);
```

## Performance Impact

- ⚡ **Minimal overhead**: Chỉ thêm 1-2 queries khi allocate/release
- 💾 **Memory**: +2 integers per proxy (8 bytes) → negligible
- 🚀 **Speed**: Query có index, performance tốt ngay cả với 1000+ proxies

## Roadmap

- [ ] Web UI để quản lý proxy allocation
- [ ] Export/Import proxy allocation configs
- [ ] Advanced load balancing strategies (weighted, geographic)
- [ ] Proxy pool auto-scaling
- [ ] Integration với proxy rotation services

---

**Version**: 1.0.0  
**Last Updated**: October 24, 2025  
**Author**: tool-live development team
