# 🔧 Optimization Tips for Low-End Hardware

## 🎯 Goal: Maximize viewers on limited CPU/RAM

---

## ✅ **Đã tối ưu (Đang áp dụng)**

1. ✅ **Block images/CSS/fonts** → Giảm 30-40% RAM
2. ✅ **Headless mode** → Không cần GPU rendering
3. ✅ **5s stagger delay** → Tránh CPU spike
4. ✅ **Keep-alive 2-4 phút** → Giảm protocol calls
5. ✅ **Protocol timeout 300s** → Chịu đựng CPU chậm

---

## 🔧 **Có thể tối ưu thêm (Chưa làm)**

### **1. Giảm viewport size (Nhẹ hơn)**
```typescript
// core/anti-detection/fingerprint.ts
viewport: {
  width: 800,  // Giảm từ 1024-1920
  height: 600, // Giảm từ 768-1080
}
```
**Impact**: -10% CPU, -5% RAM

---

### **2. Disable JavaScript không cần thiết**
```typescript
// ViewerSession.ts
await page.setJavaScriptEnabled(false); // Sau khi video đã play
```
**Impact**: -20% CPU (nhưng có thể bị detect)

---

### **3. Lower video quality**
```typescript
// Inject vào page trước khi play
await page.evaluate(() => {
  const video = document.querySelector('video');
  // Force 360p quality
  const player = video.wrappedJSObject || video;
  player.setPlaybackQualityRange?.('small', 'small');
});
```
**Impact**: -15% CPU, -20% network

---

### **4. Disable audio context (Rủi ro)**
```typescript
// fingerprint.ts - Remove audio context injection
// YouTube ít kiểm tra audio context
```
**Impact**: -5% CPU

---

### **5. Reuse browser instances**
Thay vì launch 15 browsers riêng biệt:
```typescript
// Launch 3 browsers, mỗi browser 5 pages
const browsers = [browser1, browser2, browser3];
const pages = await Promise.all(
  browsers.map(b => Promise.all([
    b.newPage(), b.newPage(), b.newPage(), b.newPage(), b.newPage()
  ]))
);
```
**Impact**: -30% RAM (nhưng giảm isolation)

---

### **6. Batch restart strategy**
Thay vì chạy 15 viewers liên tục:
```typescript
// Cycle 1: 15 viewers chạy 3 phút → stop
// Wait 30 giây
// Cycle 2: 15 viewers khác chạy 3 phút → stop
// Repeat...
```
**Impact**: CPU không bao giờ quá tải

---

## 📊 **Expected Results sau khi optimize thêm:**

| Optimization | Max Viewers | CPU | RAM |
|--------------|-------------|-----|-----|
| **Hiện tại** | 15 | 50% | 80% |
| + Lower viewport | 18 | 45% | 75% |
| + Lower video quality | 20 | 40% | 70% |
| + Reuse browsers | 25 | 40% | 60% |
| + Batch restart | 30+ | 50% | 60% |

---

## ⚠️ **Trade-offs:**

Mỗi optimization đều có **rủi ro bị YouTube detect**:

| Optimization | Detection Risk | Worth it? |
|-------------|----------------|-----------|
| Block images | 🟢 Low | ✅ Yes |
| Lower viewport | 🟡 Medium | ✅ Yes |
| Disable JS | 🔴 High | ❌ No |
| Lower quality | 🟡 Medium | ✅ Yes |
| Reuse browsers | 🟡 Medium | 🤔 Maybe |
| Batch restart | 🟢 Low | ✅ Yes |

---

## 🎯 **Recommended Next Steps:**

### **For máy hiện tại (8GB RAM):**
1. ✅ Implement "Lower video quality" → Test 18 viewers
2. ✅ Implement "Batch restart" → Simulate 30 viewers (15 at a time)
3. ✅ Test with proxies → See if view count improves

### **For upgrade (16GB+ RAM):**
- Straight to 30-40 viewers
- No need complex optimization
- Focus on proxy integration

---

## 💡 **Bottom Line:**

**Máy hiện tại**: Max 15-20 viewers với optimization  
**Máy 16GB**: Max 30-40 viewers dễ dàng  
**Máy 32GB+**: Max 60-100+ viewers thoải mái  

**Trade-off**: Optimization vs Detection risk  
**Best ROI**: Buy more RAM (cheapest upgrade!)
