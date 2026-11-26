# Handoff: Tạo bản MFE lỗi (`1.0.1`) cho CD Rollback

Tài liệu này mô tả cách tạo phiên bản micro frontend bị lỗi có chủ đích để kiểm thử luồng **Continuous Deployment (CD) tự động phát hiện lỗi và rollback `services/bff/mfe-manifest.json` về bản ổn định `1.0.0`**.

---

## 1. Tạo bản build lỗi (`1.0.1`)

Sau khi chạy `npm run build` (tạo sẵn các bản ổn định `1.0.0`), chạy script `scripts/stage-broken.mjs` để sinh một bản lỗi:

```bash
# Tạo bản 1.0.1 lỗi runtime cho catalog (có thể thay catalog bằng cart hoặc checkout)
node scripts/stage-broken.mjs catalog 1.0.1 runtime
```

* **Vị trí artifact sinh ra:** `services/bff/dist/mfe/<app>/<version>/main.js` (nằm cùng cấp với bản `1.0.0`).
* **Lưu ý Git:** Thư mục `dist/` nằm trong `.gitignore`, nên pipeline CD hoặc máy demo cần chạy trực tiếp lệnh trên để sinh bản `1.0.1`.
* **3 chế độ lỗi hỗ trợ:**
  * `runtime` *(mặc định)*: đăng ký custom element và phát `pos-fatal` với `phase: 'runtime'`.
  * `init`: phát `pos-fatal` ngay lúc khởi tạo với `phase: 'init'`.
  * `load`: ném lỗi ngay khi `import(entry)` (`REMOTE_LOAD_FAILED`).

---

## 2. Mô phỏng deploy bản lỗi

Cập nhật `entry` của micro frontend tương ứng trong `services/bff/mfe-manifest.json`:

```json
"catalog": { "tag": "pos-catalog", "entry": "/mfe/catalog/1.0.1/main.js", "contractVersion": 1 }
```

BFF phục vụ `/mfe-manifest.json` với header `Cache-Control: no-store`, nên thay đổi có hiệu lực ngay ở lần tải `/pos` tiếp theo mà không cần khởi động lại server.

---

## 3. Dấu hiệu lỗi để CD phát hiện & Rollback

* **Kiểm tra tự động (Smoke Test):** Chạy `npm test` (hoặc `npx playwright test`). Bộ test sẽ **fail** vì vùng trỏ tới bản `1.0.1` rơi vào `data-state="failed"` thay vì `data-state="ready"`.
* **Kiểm tra trên trình duyệt (`/pos`):** Chỉ vùng bị lỗi hiện thông báo fallback; 2 vùng còn lại vẫn hoạt động bình thường, không làm sập toàn trang.

---

## 4. Rollback về bản `1.0.0`

Khi test sau deploy phát hiện lỗi:

1. CD khôi phục `entry` trong `services/bff/mfe-manifest.json` về `/mfe/catalog/1.0.0/main.js`.
2. Chạy lại `npm test` (toàn bộ unit test và 20/20 test Playwright sẽ pass lại).
