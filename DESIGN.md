---
name: ShopLite
description: Hệ thống thiết kế tối giản, hiện đại và chính xác dành cho ứng dụng bán hàng (POS) tại quầy thu ngân cửa hàng bán lẻ.
---

## Overview

**ShopLite** ưu tiên thao tác nhanh tại quầy: lưới thẻ có minh họa để nhận diện sản phẩm và so giá, giỏ hàng để chỉnh số lượng, thanh toán để đối chiếu tổng tiền trước khi xác nhận.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1. Màu tím chàm dành cho nhận diện, focus, lọc đang chọn và hành động chính. Túi mua sắm có mã vạch gợi thao tác tại quầy; các đường kẻ mảnh phân tách mã giảm giá, cách trả và tổng tiền. Chữ sans giữ dấu tiếng Việt dễ đọc; chữ số tabular ổn định khi số tiền thay đổi. Minh họa và nhóm sản phẩm demo chỉ thuộc giao diện; giá, số lượng và phương thức thanh toán vẫn theo hệ thống hiện có.

## Colors

Bảng màu sử dụng sắc **Chàm (Indigo)** làm màu chủ đạo cho các hành động chính như thêm vào giỏ và hoàn tất thanh toán, trên nền trắng xám trung tính giúp làm nổi bật hình ảnh sản phẩm và các con số tài chính. Màu trạng thái xanh lá (`success`) và hổ phách (`warning`) chỉ dùng cho chỉ báo tồn kho và khuyến mãi hợp lệ.

```yaml
colors:
  success: "#15803D"
  success-container: "#DCFCE7"
  on-success-container: "#14532D"
  warning: "#B45309"
  warning-container: "#FEF3C7"
  on-warning-container: "#78350F"
  light:
    primary: "#3900B6"
    on-primary: "#FFFFFF"
    primary-container: "#4338CA"
    on-primary-container: "#C1BEFF"
    secondary: "#5A5893"
    on-secondary: "#FFFFFF"
    secondary-container: "#E3DFFF"
    on-secondary-container: "#2C2961"
    tertiary: "#692400"
    on-tertiary: "#FFFFFF"
    tertiary-container: "#8F3400"
    on-tertiary-container: "#FFB393"
    error: "#BA1A1A"
    on-error: "#FFFFFF"
    error-container: "#FFDAD6"
    on-error-container: "#93000A"
    background: "#F6F7FB"
    on-background: "#1B1B23"
    surface: "#F6F7FB"
    surface-dim: "#E4E1ED"
    surface-bright: "#FFFFFF"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#F8F9FC"
    surface-container: "#F0ECF8"
    surface-container-high: "#EAE6F3"
    surface-container-highest: "#E4E1ED"
    on-surface: "#1B1B23"
    surface-variant: "#E4E0F3"
    on-surface-variant: "#464554"
    outline: "#777586"
    outline-variant: "#D5D7E2"
    inverse-surface: "#302F39"
    inverse-on-surface: "#F3EFFB"
    inverse-primary: "#C3C0FF"
  dark:
    primary: "#C3C0FF"
    on-primary: "#1F00A4"
    primary-container: "#4338CA"
    on-primary-container: "#C1BEFF"
    secondary: "#C3C0FF"
    on-secondary: "#2C2961"
    secondary-container: "#42407A"
    on-secondary-container: "#B1AFF0"
    tertiary: "#FFB597"
    on-tertiary: "#591D00"
    tertiary-container: "#8F3400"
    on-tertiary-container: "#FFB393"
    error: "#FFB4AB"
    on-error: "#690005"
    error-container: "#93000A"
    on-error-container: "#FFDAD6"
    background: "#13121B"
    on-background: "#E4E1ED"
    surface: "#13121B"
    surface-dim: "#13121B"
    surface-bright: "#393842"
    surface-container-lowest: "#0E0D15"
    surface-container-low: "#1B1B23"
    surface-container: "#1F1F27"
    surface-container-high: "#2A2932"
    surface-container-highest: "#35343D"
    on-surface: "#E4E1ED"
    surface-variant: "#464554"
    on-surface-variant: "#C7C4D7"
    outline: "#918FA0"
    outline-variant: "#464554"
    inverse-surface: "#E4E1ED"
    inverse-on-surface: "#302F39"
    inverse-primary: "#5148D7"
```

## Typography

Hệ thống chữ kết hợp **Plus Jakarta Sans** cho tiêu đề và tổng tiền nổi bật, **Be Vietnam Pro** cho toàn bộ nhãn giao diện và tên sản phẩm tiếng Việt để hiển thị dấu thanh sắc nét ở kích thước nhỏ, cùng **Spline Sans Mono** cho mã khuyến mãi và mã hóa đơn. Mọi giá trị tiền tệ đều sử dụng `tabular-nums` để căn thẳng hàng khi thay đổi số lượng.

```yaml
typography:
  display-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 44px
    letterSpacing: -0.5px
  display-md-mobile:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.25px
  headline-lg:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 34px
    letterSpacing: -0.25px
  headline-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: -0.15px
  title-lg:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0px
  title-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0px
  body-md:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  body-sm:
    fontFamily: "Be Vietnam Pro"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0.1px
  label-lg:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0.1px
  label-md:
    fontFamily: "Be Vietnam Pro"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.2px
  label-sm:
    fontFamily: "Be Vietnam Pro"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 14px
    letterSpacing: 0.2px
  mono-md:
    fontFamily: "Spline Sans Mono"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0.3px
```

## Layout & Spacing

Từ `1100px`, ba vùng hiển thị cạnh nhau và danh mục rộng nhất. Từ `700px`, danh mục nằm trên giỏ hàng và thanh toán hai cột. Dưới `700px`, cả ba vùng xếp dọc; liên kết đầu trang giúp đến thẳng vùng cần thao tác mà không che nội dung.

```yaml
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 12px
  gutter-lg: 16px
  gutter-xl: 24px
  section: 32px
  page-margin: 16px
```

## Elevation & Depth

Phân cấp chiều sâu dựa trên lớp nền sáng (`surface`) kết hợp thẻ trắng (`surface-container-lowest`) có viền mảnh độ tương phản thấp (`outline-variant`) và đổ bóng nhẹ (`shadow-sm`). Không sử dụng hiệu ứng mờ kính (`backdrop-blur`) hay đổ bóng nặng nề để giữ giao diện sắc nét và nhanh nhạy khi thao tác liên tục.

## Shapes

Bo góc đồng bộ tạo cảm giác thân thiện và hiện đại: các nút bấm và ô nhập liệu dùng `DEFAULT` (`8px`), thẻ sản phẩm và khung giỏ hàng dùng `md` (`12px`), thẻ danh mục dạng viên thuốc dùng `full` (`9999px`).

```yaml
rounded:
  sm: 6px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  full: 9999px
```

## Motion & Micro-interaction

Chuyển động nhanh, dứt khoát để không làm chậm nhịp bấm của thu ngân. Phản hồi nút bấm hoàn tất trong `120ms`, hiệu ứng hộp thoại xác nhận thanh toán xuất hiện trong `200ms`. Chỉ chuyển động `transform`, `opacity` và màu sắc.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 200ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
```

## Voice & Content Strategy

- **Ngôn ngữ:** 100% tiếng Việt tự nhiên, ngắn gọn, chuẩn thuật ngữ bán lẻ (VD: *Tạm tính*, *Giảm giá*, *Thuế VAT (8%)*, *Tổng thanh toán*, *Hoàn tất thanh toán*).
- **Tiền tệ:** Định dạng chuẩn Việt Nam với dấu chấm phân cách hàng nghìn và hậu tố `₫` (VD: `45.000 ₫`, `1.250.000 ₫`).
- **Hành động:** Nút bấm dùng động từ rõ ràng (*Thêm vào giỏ*, *Áp dụng*, *Xóa giỏ hàng*, *Hoàn tất thanh toán*).

## Components

Component implementations live as individual HTML sticker sheet files in
`components/`. Each file contains the canonical, styled HTML components with
`<!-- COMPONENT: name -->` comment markers. Read each file before use.

- **Button** → `@components/button.html` — `button-primary`, `button-icon`, `button-with-icon`
- **Card** → `@components/card.html` — `card-elevated`, `card-action`, `card-interactive`, `card-interactive-2`
- **Input Field** → `@components/input-field.html` — `input-field-text`, `input-field-icon`
- **Tabs** → `@components/tabs.html` — `tabs-horizontal`, `tabs-with-icon`
