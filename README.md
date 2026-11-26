# BinMart POS

BinMart POS là demo bán hàng tại quầy. Shell ghép danh mục React, giỏ hàng Angular AOT và thanh toán Vue trên `/pos`. BFF phục vụ frontend và chuyển tiếp yêu cầu sang mock API Node.js, nơi tính lại giá và giữ giao dịch trong bộ nhớ.

## Chạy demo

Cần Node.js 24.x.

```sh
npm ci
npm run build
npm run start
```

Mở [màn hình POS](http://localhost:8080/pos). Lệnh start chạy BFF trên cổng 8080 và mock API trên cổng 8081. Mock API cũng chạy độc lập bằng `npm run start -w @pos/mock-api`.

## Kịch bản demo

1. Tìm `CF-001` hoặc **Cà phê rang xay** và thêm hai lần. Giỏ hiển thị số lượng 2, tạm tính **100.000 ₫**.
2. Nhập `GIAM10` rồi bấm **Áp dụng**. Giảm **10.000 ₫**, tổng còn **90.000 ₫**. Có thể giảm số lượng xuống 1 để thấy mã tự gỡ, rồi tăng lại và áp dụng lại mã.
3. Chọn **Tiền mặt**, nhập `100000` và xác nhận. Biên nhận có mã giao dịch, số tiền **90.000 ₫** và tiền thừa **10.000 ₫**. Bấm **Đơn mới** để bắt đầu lại.
4. Có thể chọn **Thẻ mô phỏng** để thanh toán bằng thẻ. Để demo ca từ chối, dừng tiến trình hiện tại và chạy `MOCK_CARD_RESULT=declined npm run start`. Đơn bị từ chối vẫn giữ giỏ và mã giảm hợp lệ.

Dữ liệu mẫu còn có Trà sen (35.000 ₫) và Bánh gạo (25.000 ₫). Giỏ hàng bắt đầu lại khi tải lại trang. Giao dịch mock được đặt lại khi khởi động lại mock API. Nếu checkout báo chưa rõ kết quả trong trang hiện tại, dùng **Thử lại giao dịch** để gửi lại cùng đơn và cùng khóa.

### Demo lỗi và phiên bản remote

Tạm đổi `checkout.contractVersion` thành `2` trong `services/bff/mfe-manifest.json` rồi tải lại trang. Vùng thanh toán hiển thị lỗi, còn danh mục và giỏ vẫn dùng được. Đổi lại thành `1` để khôi phục.

## Làm việc với từng remote

| Remote | Build | Xem trước với context giả |
| --- | --- | --- |
| Catalog · React | `npm run build -w @pos/catalog` | `npm run preview -w @pos/catalog` · cổng 4171 |
| Giỏ hàng · Angular | `npm run build -w @pos/cart` | `npm run preview -w @pos/cart` · cổng 4172 |
| Thanh toán · Vue | `npm run build -w @pos/checkout` | `npm run preview -w @pos/checkout` · cổng 4173 |

Preview giỏ và thanh toán được nạp sẵn hai đơn vị cà phê mẫu để có thể thử thao tác độc lập.

Các lệnh build đặt artifact vào thư mục phiên bản `1.0.0` bên dưới `services/bff/dist/mfe`. Để thử một bản catalog khác, build catalog, chạy `node scripts/stage-remote.mjs catalog 1.0.1`, rồi đổi `catalog.entry` trong `services/bff/mfe-manifest.json` thành `/mfe/catalog/1.0.1/main.js` và mở lại trang.

## Kiểm thử

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Bộ kiểm thử gồm unit test tính tiền và store, kiểm thử HTTP trực tiếp với mock API và qua BFF, cùng Playwright trên bản build tích hợp. Các ca trình duyệt có bán hàng bằng bàn phím, đổi phiên bản remote, lỗi từng vùng, thẻ bị từ chối và thử lại sau khi giao dịch đã được ghi nhưng phản hồi bị mất. Playwright dùng thêm cổng 8082–8083 cho kịch bản thẻ bị từ chối và 4171–4173 cho preview.

Nếu Playwright báo Ubuntu 26.04 chưa được hỗ trợ, dùng bản Chromium Headless cho Ubuntu 24.04.

```sh
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium --only-shell
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npm test
```
