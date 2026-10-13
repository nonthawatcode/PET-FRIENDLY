import Link from 'next/link'
import { KIND, when } from '@/lib/format'
import type { Movement } from '@/lib/types'
import { IconIn, IconOut } from './icons'

export function MoveRow({ m, orderHref }: { m: Movement; orderHref?: (id: string) => string }) {
  const soft = m.kind === 'reserve' || m.kind === 'release'
  const neg = m.kind === 'deduct' || m.kind === 'damage' || m.delta_on_hand < 0
  const tone = soft ? { background: 'var(--fill)', color: 'var(--muted)' } : neg ? { background: 'var(--bad-soft)', color: 'var(--bad)' } : { background: 'var(--ok-soft)', color: 'var(--ok)' }
  const body = (
    <>
      <span className="ic" style={tone}>{neg ? <IconOut /> : <IconIn />}</span>
      <div className="main">
        <div className="t1">{KIND[m.kind]} <span className="mono small muted">{m.products?.sku}</span></div>
        <div className="t2">{when(m.created_at)} · {m.profiles?.display_name ?? 'ระบบ'}{m.orders && ` · ${m.orders.external_order_id}`}{m.note && ` · ${m.note}`}</div>
      </div>
      <b className="num" style={{ color: tone.color }}>{neg ? '−' : '+'}{m.quantity}</b>
    </>
  )
  return m.order_id && orderHref
    ? <Link className="rowi" href={orderHref(m.order_id)} scroll={false}>{body}</Link>
    : <div className="rowi">{body}</div>
}
