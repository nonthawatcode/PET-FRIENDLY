import Link from 'next/link'
import { OrderRow, itemSummary } from '@/components/bits'
import { OrderSheet } from '@/components/OrderSheet'
import { OrderFilterBar } from '@/components/OrderFilterBar'
import { getOrders, type OrderFilters } from '@/lib/data'
import { baht, bkkDay, dayLabel } from '@/lib/format'
import type { Order } from '@/lib/types'

export const dynamic = 'force-dynamic'

type SP = { tab?: string; q?: string; platform?: string; range?: string; order?: string; focus?: string }
const TABS = [['all', 'ทั้งหมด'], ['pending', 'รอแพ็ก'], ['packed', 'แพ็กแล้ว'], ['shipped', 'จัดส่งแล้ว'], ['cancelled', 'ยกเลิก']] as const

function match(o: Order, tab: string) {
  if (tab === 'all') return true
  if (tab === 'pending') return o.status === 'pending' || o.status === 'packing'
  return o.status === tab
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const f: OrderFilters = {
    tab: (TABS.some(([k]) => k === sp.tab) ? sp.tab : 'all') as OrderFilters['tab'],
    q: sp.q ?? '',
    platform: (['shopee', 'lazada', 'tiktok'].includes(sp.platform ?? '') ? sp.platform : 'all') as OrderFilters['platform'],
    range: (['today', '7', '30', 'all'].includes(sp.range ?? '') ? sp.range : '7') as OrderFilters['range'],
  }
  const base = await getOrders(f)
  const rows = base.filter((o) => match(o, f.tab))
  const sales = base.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + Number(o.total_amount ?? 0), 0)
  const days = [...new Set(rows.map((o) => bkkDay(o.ordered_at)))]
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams()
    const merged = { tab: f.tab, q: f.q, platform: f.platform, range: f.range, ...patch }
    Object.entries(merged).forEach(([k, v]) => { if (v && !(k === 'tab' && v === 'all') && !(k === 'platform' && v === 'all') && !(k === 'range' && v === '7')) p.set(k, String(v)) })
    const s = p.toString()
    return '/orders' + (s ? '?' + s : '')
  }
  const self = qs({})

  return (
    <>
      <div className="lt">
        <div><h1>ออเดอร์</h1><p>ยอดขาย <b className="num" style={{ color: 'var(--fg)' }}>{baht(sales)}</b> · {base.length} ออเดอร์</p></div>
      </div>
      <OrderFilterBar q={f.q} platform={f.platform} range={f.range} autoFocus={sp.focus === '1'} />
      <div className="chips" role="tablist">
        {TABS.map(([k, l]) => (
          <Link key={k} className="fchip" role="tab" aria-pressed={f.tab === k} href={qs({ tab: k })} scroll={false}>
            {l}<span className="c">{base.filter((o) => match(o, k)).length}</span>
          </Link>
        ))}
      </div>
      {days.length ? days.map((d) => {
        const r = rows.filter((o) => bkkDay(o.ordered_at) === d)
        return (
          <div className="sect" key={d}>
            <div className="sect-h"><h2 style={{ fontSize: '1rem' }}>{dayLabel(d)}</h2><span className="xs muted">{r.length} ออเดอร์</span></div>
            <div className="group">
              {r.map((o) => (
                <OrderRow key={o.id} o={o} href={`${self}${self.includes('?') ? '&' : '?'}order=${o.id}`}
                  sub={`${o.recipient_name ?? o.buyer_name ?? '—'} · ${o.order_items.some((i) => !i.product_id) ? 'SKU ไม่ตรง' : itemSummary(o)} · ${baht(o.total_amount)}`} />
              ))}
            </div>
          </div>
        )
      }) : <div className="group"><div className="empty-state">ไม่พบออเดอร์ตามตัวกรองนี้</div></div>}
      {sp.order && <OrderSheet id={sp.order} closeHref={self} />}
    </>
  )
}
