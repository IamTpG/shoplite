import {
  afterNextRender, Component, ElementRef, inject, input, signal, ViewEncapsulation,
  type OnDestroy, type OnInit,
} from '@angular/core'
import {
  formatVnd, reportFatal, reportReady, requireContext, type CartLine, type PosSnapshot, type PosContext,
} from '@pos/domain'

import { posErrors } from '@pos/domain/messages'
import { MAX_QUANTITY } from '@pos/domain/pricing'
import { saleLocked } from '@pos/domain/store'
import { productVisual } from '../../product-visuals'

@Component({
  selector: 'pos-cart-view',
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <div class="body">
      @if (snapshot(); as cart) {
        @if (cart.lines.length) {
          <div class="cart-tools"><span class="count" aria-hidden="true">{{ count(cart) }}</span><button type="button" [disabled]="locked(cart)" (click)="clear(cart)">Xóa giỏ</button></div>
          <ul>
            @for (line of cart.lines; track line.productId) {
              <li>
                <img class="thumb" [src]="visual(line.productId).src" alt="" width="48" height="48" />
                <div class="line-title"><strong>{{ line.name }}</strong><span>{{ money(line.unitPriceVnd) }} / đơn vị</span></div>
                <strong class="amount">{{ money(line.unitPriceVnd * line.quantity) }}</strong>
                <div class="actions">
                  <button type="button" [disabled]="locked(cart) || line.quantity <= 1"
                    [attr.aria-label]="'Giảm số lượng ' + line.name" (click)="change(line, -1)">−</button>
                  <output [attr.aria-label]="'Số lượng ' + line.name">{{ line.quantity }}</output>
                  <button type="button" [disabled]="locked(cart) || line.quantity >= maxQuantity"
                    [attr.aria-label]="'Tăng số lượng ' + line.name" (click)="change(line, 1)">+</button>
                  <button type="button" class="remove" [disabled]="locked(cart)"
                    [attr.aria-label]="'Xóa ' + line.name" (click)="remove(line)">Xóa</button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="empty">Chưa có sản phẩm trong giỏ. Bấm <strong>+</strong> trên thẻ sản phẩm để thêm.</p>
        }
        <div class="summary"><span>{{ count(cart) }} sản phẩm</span><strong>{{ money(cart.subtotalVnd) }}</strong></div>
        <span class="sr-only" role="status">Tổng số sản phẩm trong giỏ: {{ count(cart) }}</span>
        @if (message()) { <p role="alert">{{ message() }}</p> }
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex: 1; flex-direction: column; }
    .body { display: flex; flex: 1; flex-direction: column; padding: 0 var(--pos-pad, 20px) var(--pos-pad, 20px); }
    p { color: var(--pos-muted, #464554); margin: 0 0 20px; }
    .empty { border: 1px dashed var(--pos-outline, #777586); border-radius: 8px; padding: 14px 12px; margin-bottom: 14px; }
    ul { list-style: none; padding: 0; margin: 0 0 16px; }
    li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; padding: 12px 0; }
    li + li { border-top: 1px solid var(--pos-border, #d5d7e2); }
    .line-title { display: grid; gap: 4px; overflow-wrap: anywhere; }
    .thumb { border: 1px solid var(--pos-border, #d5d7e2); border-radius: 8px; background: var(--pos-media, #e1e5ee); object-fit: contain; }
    .cart-tools { display: flex; justify-content: space-between; align-items: center; }
    .count { display: grid; place-items: center; min-width: 23px; height: 23px; border-radius: 99px; padding-inline: 2px; background: var(--pos-primary, #3900b6); color: var(--pos-on-primary, #fff); font-size: .75rem; font-weight: 750; }
    .line-title span { color: var(--pos-muted, #464554); font-size: 12px; }
    .actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    output { min-width: 2ch; text-align: center; font-variant-numeric: tabular-nums; }
    button { border: 1px solid var(--pos-outline, #777586); border-radius: 8px; background: var(--pos-surface, #fff); color: inherit; font: inherit; min-height: 44px; min-width: 44px; padding: 4px 9px; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--pos-primary, #2a14b4); outline-offset: 2px; }
    button:hover:not(:disabled), button:disabled { background: var(--pos-soft, #eeedf7); }
    button:active:not(:disabled) { border-style: dashed; }
    button:disabled { color: var(--pos-muted, #464554); border-color: var(--pos-border, #d5d7e2); cursor: not-allowed; }
    .remove { margin-inline-start: auto; }
    .summary { display: flex; gap: 12px; justify-content: space-between; }
    .summary { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--pos-border, #d5d7e2); }
    .summary span { color: var(--pos-muted, #464554); }
    .amount { align-self: start; white-space: normal; overflow-wrap: anywhere; }
    .amount, .summary strong { font-variant-numeric: tabular-nums; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    [role="alert"] { margin: 8px 0 0; color: var(--pos-error, #ba1a1a); }
  `,
})
export class CartView implements OnInit, OnDestroy {
  readonly posContext = input.required<PosContext>()
  readonly snapshot = signal<PosSnapshot | null>(null)
  readonly money = formatVnd
  readonly visual = productVisual
  readonly locked = saleLocked
  readonly maxQuantity = MAX_QUANTITY
  readonly message = signal('')

  count(cart: PosSnapshot) {
    return cart.lines.reduce((quantity, line) => quantity + line.quantity, 0)
  }

  change(line: CartLine, adjustment: number) {
    const result = this.posContext().setQuantity(line.productId, line.quantity + adjustment)
    this.message.set(result.ok ? '' : posErrors[result.code])
  }

  remove(line: CartLine) {
    const result = this.posContext().removeItem(line.productId)
    this.message.set(result.ok ? '' : posErrors[result.code])
  }

  clear(cart: PosSnapshot) {
    for (const line of cart.lines) {
      const result = this.posContext().removeItem(line.productId)
      if (!result.ok) {
        this.message.set(posErrors[result.code])
        return
      }
    }
    this.message.set('')
  }
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement
  private unsubscribe?: () => void

  constructor() {
    afterNextRender(() => reportReady(this.host))
  }

  ngOnInit() {
    const context = requireContext(this.posContext())
    this.snapshot.set(context.getSnapshot())
    this.unsubscribe = context.subscribe(() => {
      if (!this.host.isConnected) return
      try {
        this.snapshot.set(context.getSnapshot())
      } catch (error) {
        reportFatal(this.host, 'CART_SNAPSHOT_FAILED', error)
      }
    })
  }

  ngOnDestroy() {
    this.unsubscribe?.()
  }
}

