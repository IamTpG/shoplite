import type { PosErrorCode } from './contract.ts'

export const posErrors: Record<PosErrorCode, string> = {
  EMPTY_CART: 'Thêm sản phẩm vào giỏ để thanh toán.',
  SALE_LOCKED: 'Đơn hàng đang khóa chỉnh sửa.',
  INVALID_PRODUCT: 'Sản phẩm không hợp lệ.',
  INVALID_QUANTITY: 'Số lượng phải từ 1 đến 99.',
  INVALID_PROMO: 'Mã giảm giá không hợp lệ.',
  PROMO_MINIMUM: 'Đơn hàng cần đạt 100.000 ₫ để áp dụng mã.',
  INVALID_PAYMENT: 'Chọn một phương thức thanh toán.',
  INSUFFICIENT_CASH: 'Nhập số tiền khách đưa đủ để thanh toán.',
  CARD_DECLINED: 'Thẻ mô phỏng bị từ chối. Bạn có thể chọn lại phương thức thanh toán.',
  CHECKOUT_REJECTED: 'Giao dịch bị từ chối. Kiểm tra lại đơn hàng.',
  CHECKOUT_UNKNOWN: 'Chưa nhận được kết quả giao dịch. Thử lại để lấy kết quả của cùng giao dịch.',
  NO_PENDING_CHECKOUT: 'Hiện chưa có giao dịch cần thử lại.',
}
