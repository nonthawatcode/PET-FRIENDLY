import Link from 'next/link'
import { PLATFORM, STATUS, hm } from '@/lib/format'
import type { Order, OrderStatus, Platform } from '@/lib/types'
import { IconChevron } from './icons'

export function PlatformMark({ p }: { p: Platform }) {
  return (
    <span className={`pm ${p}`} title={PLATFORM[p]}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/platforms/${p}.png`} alt={PLATFORM[p]} width={32} height={32} />
    </span>
  )
}

export function Status({ s }: { s: OrderStatus }) {
  return <span className={`st st-${s}`}>{STATUS[s]}</span>
}

export function orderBadge(o: Order) {
  if (o.needs_attention === 'cancelled_after_pack') return <span className="chip bad">ยกเลิกหลังแพ็ก</span>
  if (o.order_items.some((i) => !i.product_id) && (o.status === 'pending' || o.status === 'packing')) return <span className="chip bad">ต้องผูก SKU</span>
  if (o.marketplace_state === 'unpaid' && (o.status === 'pending' || o.status === 'packing')) return <span className="chip warn">รอชำระเงิน</span>
  return <Status s={o.status} />
}

export function itemSummary(o: Order) {
  return o.order_items
    .map((i) => `${i.products?.sku.replace(/^PF-/, '') ?? i.platform_sku} ×${i.quantity}`)
    .join(', ')
}

export function OrderRow({ o, href, sub }: { o: Order; href: string; sub?: React.ReactNode }) {
  return (
    <Link className="rowi" href={href} scroll={false}>
      <PlatformMark p={o.platform} />
      <div className="main">
        <div className="t1"><span className="mono">{o.external_order_id}</span>{o.source === 'sample' && <span className="sample-tag">ตัวอย่าง</span>}</div>
        <div className="t2">{sub}</div>
      </div>
      <div className="trail">{orderBadge(o)}<span className="xs muted">{hm(o.ordered_at)}</span></div>
      <IconChevron />
    </Link>
  )
}
