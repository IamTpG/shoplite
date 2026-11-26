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

@Component({
  selector: 'pos-cart-view',
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <div class="body">
      @if (snapshot(); as cart) {
        @if (cart.lines.length) {
          <ul>
            @for (line of cart.lines; track line.productId) {
              <li>
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
          <p>Chưa có sản phẩm trong giỏ.</p>
        }
        <div class="summary"><span>Tạm tính</span><strong>{{ money(cart.subtotalVnd) }}</strong></div>
        <span class="sr-only" role="status">Tổng số sản phẩm trong giỏ: {{ count(cart) }}</span>
        @if (message()) { <p role="alert">{{ message() }}</p> }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .body { padding: 16px 20px; }
    p { color: var(--pos-muted, #464554); margin: 0 0 20px; }
    ul { list-style: none; padding: 0; margin: 0 0 16px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 12px 0; }
    li + li { border-top: 1px solid var(--pos-border, #d5d7e2); }
    .line-title { display: grid; gap: 4px; overflow-wrap: anywhere; }
    .line-title span { color: var(--pos-muted, #464554); font-size: 12px; }
    .actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
    output { min-width: 2ch; text-align: center; font-variant-numeric: tabular-nums; }
    button { border: 1px solid var(--pos-outline, #777586); border-radius: 8px; background: white; color: inherit; font: inherit; min-height: 34px; min-width: 34px; padding: 4px 9px; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--pos-primary, #2a14b4); outline-offset: 2px; }
    button:disabled { color: var(--pos-muted, #464554); border-color: var(--pos-border, #d5d7e2); cursor: default; }
    .remove { margin-inline-start: auto; }
    .summary { display: flex; gap: 12px; justify-content: space-between; }
    .summary { padding-top: 14px; border-top: 1px solid var(--pos-border, #d5d7e2); }
    .amount, .summary strong { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    [role="alert"] { margin: 8px 0 0; color: var(--pos-error, #ba1a1a); }
  `,
})
export class CartView implements OnInit, OnDestroy {
  readonly posContext = input.required<PosContext>()
  readonly snapshot = signal<PosSnapshot | null>(null)
  readonly money = formatVnd
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

