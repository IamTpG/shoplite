<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, shallowRef, useHost, watch } from 'vue'
import {
  formatVnd, reportFatal, reportReady, requireContext, type PaymentMethod, type PosContext, type PosErrorCode,
} from '@pos/domain'
import { posErrors } from '@pos/domain/messages'
import { isVnd, PROMO_CODE, PROMO_MINIMUM_VND } from '@pos/domain/pricing'
import { saleLocked } from '@pos/domain/store'

const props = defineProps<{ posContext: PosContext }>()
const host = useHost()!
const context = requireContext(props.posContext)
const snapshot = shallowRef(context.getSnapshot())
const unsubscribe = context.subscribe(() => {
  if (!host.isConnected) return
  try {
    snapshot.value = context.getSnapshot()
  } catch (error) {
    reportFatal(host, 'CHECKOUT_SNAPSHOT_FAILED', error)
  }
})

onScopeDispose(unsubscribe)
onMounted(() => reportReady(host))

type CheckoutUiError = PosErrorCode | 'INVALID_CASH_FORMAT'

const promoDraft = ref(snapshot.value.promoCode ?? '')
const promoError = ref('')
const promoNotice = ref('')
const paymentMethod = ref<PaymentMethod | ''>('')
const cashDraft = ref('')
const paymentError = ref<CheckoutUiError>()
const cashErrorMessage = computed(() => {
  if (paymentError.value === 'INVALID_CASH_FORMAT') return 'Nhập số tiền hợp lệ bằng chữ số (VD: 100000).'
  if (paymentError.value === 'INSUFFICIENT_CASH') return posErrors.INSUFFICIENT_CASH
  return ''
})
const locked = computed(() => saleLocked(snapshot.value))
const receipt = computed(() => snapshot.value.transaction.status === 'succeeded'
  ? snapshot.value.transaction.receipt : null)
const cash = computed(() => /^\d+$/.test(cashDraft.value.trim()) ? Number(cashDraft.value.trim()) : NaN)
const change = computed(() => {
  const total = snapshot.value.totalVnd
  return paymentMethod.value === 'cash' && isVnd(cash.value) && cash.value >= total ? cash.value - total : null
})
const transactionError = computed(() => snapshot.value.transaction.status === 'rejected'
  ? posErrors[snapshot.value.transaction.code] : '')

watch(snapshot, (current, previous) => {
  if (previous.promoCode && !current.promoCode && current.subtotalVnd < PROMO_MINIMUM_VND
    && current.transaction.status !== 'succeeded') {
    promoNotice.value = 'Đã gỡ mã GIAM10 vì đơn hàng dưới 100.000 ₫.'
    promoDraft.value = ''
  }
  if (!current.lines.length) paymentError.value = undefined
})

function applyPromo() {
  promoNotice.value = ''
  const result = context.applyPromo(promoDraft.value)
  promoError.value = result.ok ? '' : posErrors[result.code]
  if (result.ok) promoDraft.value = context.getSnapshot().promoCode ?? ''
}

function clearPromo() {
  const result = context.clearPromo()
  promoError.value = result.ok ? '' : posErrors[result.code]
  if (result.ok) {
    promoDraft.value = ''
    promoNotice.value = ''
  }
}

async function pay() {
  paymentError.value = undefined
  if (!paymentMethod.value) {
    paymentError.value = 'INVALID_PAYMENT'
    return
  }
  if (paymentMethod.value === 'cash') {
    if (!isVnd(cash.value)) {
      paymentError.value = 'INVALID_CASH_FORMAT'
      return
    }
    if (change.value === null) {
      paymentError.value = 'INSUFFICIENT_CASH'
      return
    }
  }
  const result = await context.submitCheckout(paymentMethod.value === 'cash'
    ? { paymentMethod: 'cash', cashReceivedVnd: cash.value }
    : { paymentMethod: 'mock-card' })
  if (!result.ok && context.getSnapshot().transaction.status === 'idle') paymentError.value = result.code
}

function newSale() {
  const result = context.startNewSale()
  if (!result.ok) return
  promoDraft.value = ''
  promoNotice.value = ''
  promoError.value = ''
  paymentMethod.value = ''
  cashDraft.value = ''
  paymentError.value = undefined
}
</script>

<template>
  <div class="body">
    <template v-if="receipt">
      <div class="receipt" role="status">
        <h3>Thanh toán thành công</h3>
        <dl>
          <div><dt>Mã giao dịch</dt><dd class="order-id">{{ receipt.orderId }}</dd></div>
          <div><dt>Đã thanh toán</dt><dd>{{ formatVnd(receipt.totalVnd) }}</dd></div>
          <div><dt>Phương thức</dt><dd>{{ receipt.paymentMethod === 'cash' ? 'Tiền mặt' : 'Thẻ mô phỏng' }}</dd></div>
          <div v-if="receipt.changeVnd !== null"><dt>Tiền thừa</dt><dd>{{ formatVnd(receipt.changeVnd) }}</dd></div>
        </dl>
      </div>
      <button type="button" class="primary wide" @click="newSale">Đơn mới</button>
    </template>
    <template v-else>
      <form @submit.prevent="applyPromo">
        <label class="label" for="promo-code">Mã giảm giá</label>
        <div class="promo">
          <input id="promo-code" v-model="promoDraft" type="text" placeholder="Nhập mã"
            :aria-invalid="Boolean(promoError)" :aria-describedby="promoError ? 'promo-error' : undefined"
            :disabled="locked" @input="promoError = ''">
          <button type="submit" :disabled="locked || !promoDraft.trim()">Áp dụng</button>
        </div>
        <p class="hint">Dùng mã <strong>{{ PROMO_CODE }}</strong> cho đơn từ {{ formatVnd(PROMO_MINIMUM_VND) }}.</p>
        <p v-if="promoError" id="promo-error" role="alert" class="error">{{ promoError }}</p>
        <p v-if="promoNotice" role="status" class="hint">{{ promoNotice }}</p>
        <div v-if="snapshot.promoCode" class="applied">
          <span>Đã áp dụng <strong>{{ snapshot.promoCode }}</strong></span>
          <button type="button" :disabled="locked" @click="clearPromo">Gỡ mã</button>
        </div>
      </form>

      <form class="section" @submit.prevent="pay">
        <fieldset :disabled="locked" :aria-describedby="paymentError === 'INVALID_PAYMENT' ? 'payment-error' : undefined">
          <legend>Phương thức thanh toán</legend>
          <label class="option">
            <input v-model="paymentMethod" type="radio" name="payment" value="cash" @change="paymentError = undefined">
            Tiền mặt
          </label>
          <label class="option">
            <input v-model="paymentMethod" type="radio" name="payment" value="mock-card" @change="paymentError = undefined">
            Thẻ mô phỏng
          </label>
          <p v-if="paymentError === 'INVALID_PAYMENT'" id="payment-error" role="alert" class="error">
            {{ posErrors[paymentError] }}
          </p>
          <template v-if="paymentMethod === 'cash'">
            <label for="cash-received" class="label cash-label">Tiền khách đưa (₫)</label>
            <input id="cash-received" v-model="cashDraft" type="text" inputmode="numeric"
              :aria-invalid="Boolean(cashErrorMessage)"
              :aria-describedby="cashErrorMessage ? 'cash-error' : undefined"
              @input="paymentError = undefined">
            <p v-if="cashErrorMessage" id="cash-error" role="alert" class="error">
              {{ cashErrorMessage }}
            </p>
            <p v-if="change !== null" class="hint">Tiền thừa <strong>{{ formatVnd(change) }}</strong></p>
          </template>
        </fieldset>
        <dl class="totals">
          <div><dt>Tạm tính</dt><dd>{{ formatVnd(snapshot.subtotalVnd) }}</dd></div>
          <div><dt>Giảm giá</dt><dd class="discount">{{ formatVnd(snapshot.discountVnd) }}</dd></div>
          <div class="total"><dt>Tổng phải trả</dt><dd>{{ formatVnd(snapshot.totalVnd) }}</dd></div>
        </dl>
        <p v-if="paymentError && paymentError !== 'INVALID_PAYMENT' && paymentError !== 'INVALID_CASH_FORMAT' && paymentError !== 'INSUFFICIENT_CASH'" role="alert" class="error">
          {{ posErrors[paymentError] }}
        </p>
        <p v-if="!snapshot.lines.length" id="empty-checkout" class="hint">{{ posErrors.EMPTY_CART }}</p>
        <p v-if="transactionError" role="alert" class="error">{{ transactionError }}</p>
        <p v-if="snapshot.transaction.status === 'submitting'" role="status" class="hint">Đang xử lý thanh toán…</p>
        <template v-if="snapshot.transaction.status === 'unknown'">
          <p role="alert" class="error">{{ posErrors.CHECKOUT_UNKNOWN }}</p>
          <button type="button" class="primary wide" @click="context.retryCheckout()">Thử lại giao dịch</button>
        </template>
        <button v-else type="submit" class="primary wide" :disabled="locked || !snapshot.lines.length"
          :aria-describedby="!snapshot.lines.length ? 'empty-checkout' : undefined">
          Xác nhận thanh toán
        </button>
      </form>
    </template>
  </div>
</template>

<style>
:host { display: block; }
.body { padding: 0 var(--pos-pad, 20px) var(--pos-pad, 20px); }
dl, dd, h3 { margin: 0; }
dl > div { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 10px; margin-bottom: 10px; }
dt { color: var(--pos-muted, #464554); }
dd { white-space: nowrap; font-variant-numeric: tabular-nums; }
.totals { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--pos-border, #d5d7e2); }
.discount { color: var(--pos-success, #14532d); }
.total { margin: 12px 0 0; padding-top: 14px; border-top: 1px solid var(--pos-border, #d5d7e2); font-weight: 700; }
.total dt { color: inherit; }
.total dd { font-size: clamp(1.2rem, 1.55vw, 1.55rem); line-height: 1.2; color: var(--pos-primary, #3900b6); white-space: normal; overflow-wrap: anywhere; }
.section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--pos-border, #d5d7e2); }
.label, legend { font-weight: 650; display: block; margin-bottom: 6px; padding: 0; }
.promo, .applied { display: flex; align-items: center; gap: 8px; }
.applied { justify-content: space-between; margin-top: 8px; }
.applied strong, .order-id { font-family: var(--pos-mono, monospace); overflow-wrap: anywhere; white-space: normal; }
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.option { display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px; margin-top: 8px; padding: 4px 10px; border: 1px solid var(--pos-outline, #777586); border-radius: 8px; }
.option:has(:checked) { background: var(--pos-soft, #eeedf7); border-color: var(--pos-primary, #3900b6); font-weight: 650; }
.option:hover:not(:has(:disabled)) { background: var(--pos-soft, #eeedf7); }
.option input { accent-color: var(--pos-primary, #2a14b4); }
.cash-label { margin-top: 8px; }
input[type="text"] { width: 100%; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--pos-outline, #777586); border-radius: 8px; font: inherit; font-size: 1rem; background: var(--pos-surface, #fff); color: inherit; }
input::placeholder { color: var(--pos-muted, #464554); }
input[aria-invalid="true"] { border-color: var(--pos-error, #ba1a1a); }
button { border: 1px solid var(--pos-outline, #777586); border-radius: 8px; min-height: 44px; padding: 8px 10px; font: inherit; color: inherit; background: var(--pos-surface, #fff); white-space: nowrap; }
button, .option, .option input { cursor: pointer; }
button:hover:not(:disabled) { background: var(--pos-soft, #eeedf7); }
button:active:not(:disabled), .option:active:not(:has(:disabled)) { outline: 1px solid currentColor; }
.primary { background: var(--pos-primary, #2a14b4); color: var(--pos-on-primary, #fff); border-color: transparent; font-weight: 700; white-space: normal; }
.primary:hover:not(:disabled) { background: var(--pos-primary-hover, #20108c); }
.wide { width: 100%; margin-top: 10px; }
button:disabled, input[type="text"]:disabled { background: var(--pos-soft, #eeedf7); color: var(--pos-muted, #464554); border-color: var(--pos-border, #d5d7e2); }
:disabled, .option:has(:disabled) { cursor: not-allowed; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--pos-primary, #2a14b4); outline-offset: 2px; }
.error, .hint { margin: 8px 0 0; }
.error { color: var(--pos-error, #ba1a1a); }
.hint { color: var(--pos-muted, #464554); }
.receipt { background: var(--pos-success-bg, #dcfce7); color: var(--pos-success, #14532d); padding: 12px; border-radius: 8px; }
.receipt dt { color: inherit; }
.receipt h3 { margin-bottom: 12px; font-size: 15px; }
.receipt dl > div:last-child { margin-bottom: 0; }
</style>
