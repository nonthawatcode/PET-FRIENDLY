import Link from 'next/link'
import { OrderRow, itemSummary } from '@/components/bits'
import { HandoverSheet } from '@/components/HandoverSheet'
import { OrderSheet } from '@/components/OrderSheet'
import { SheetFrame } from '@/components/SheetFrame'
import { PackStation } from '@/components/PackStation'
import { getPackStats, getPacked, getProducts, getQueue } from '@/lib/data'
import { dayLabel, bkkDay, hm, longDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function PackPage({ searchParams }: { searchParams: Promise<{ order?: string; handover?: string; o?: string }> }) {
  const sp = await searchParams
  const [queue, products, stats, packed] = await Promise.all([getQueue(), getProducts(), getPackStats(), getPacked()])
  const today = bkkDay(new Date())
  const overdue = packed.filter((o) => o.packed_at && bkkDay(o.packed_at) < today)
  const waiting = queue.filter((o) => o.status === 'pending')
  const ready = (o: (typeof queue)[number]) => o.tracking_number && o.marketplace_state !== 'unpaid' && o.order_items.every((i) => i.product_id)
  const next = waiting.find(ready)
  const low = products.filter((p) => p.is_low).length
  const demoCodes = waiting.filter((o) => o.source === 'sample' && ready(o)).slice(0, 4).map((o) => o.tracking_number!)

  return (
    <>
      <div className="lt"><div><h1>แพ็กสินค้า</h1><p>{dayLabel(bkkDay(new Date()))} · {longDate()}</p></div></div>
      {packed.length > 0 && (
        <Link className={`handcard ${overdue.length ? 'late' : ''}`} href="/?handover=1" scroll={false}>
          <div className="main">
            <div className="hc-l">รอส่งขนส่ง</div>
            <div className="hc-v"><b>{packed.length}</b> กล่อง</div>
            <div className="hc-s">{overdue.length ? `ค้างตั้งแต่ก่อนวันนี้ ${overdue.length} กล่อง` : `แพ็กล่าสุด ${hm(packed[packed.length - 1].packed_at!)}`}</div>
          </div>
          <span className="hc-btn">ส่งขนส่ง</span>
        </Link>
      )}
      <div className="packgrid">
        <PackStation
          products={products.map((p) => ({ id: p.id, sku: p.sku, option_name: p.option_name || p.name }))}
          nextOrderId={next?.external_order_id ?? null}
          demoCodes={demoCodes}
        />
        <div className="sect">
          <div className="stats">
            <Link className="stat" href="/orders?tab=pending&range=all"><span className="l">รอแพ็ก</span><span className="v">{queue.length}</span></Link>
            <Link className="stat" href="/orders?tab=packed&range=today"><span className="l">แพ็กแล้ววันนี้</span><span className="v">{stats.packedToday}</span></Link>
            <Link className="stat" href="/stock"><span className="l">ใกล้หมด</span><span className="v" style={{ color: low ? 'var(--bad)' : undefined }}>{low}</span></Link>
          </div>
          <div className="sect-h"><h2>คิวรอแพ็ก</h2><span className="xs muted">เก่าสุดก่อน</span></div>
          <div className="group">
            {waiting.length ? waiting.map((o) => (
              <OrderRow key={o.id} o={o} href={`/?order=${o.id}`}
                sub={o.order_items.some((i) => !i.product_id) ? <span className="flag">จับคู่ SKU ไม่ได้</span> : `${o.order_items.reduce((a, i) => a + i.quantity, 0)} ชิ้น · ${itemSummary(o)}`} />
            )) : <div className="empty-state">ไม่มีออเดอร์รอแพ็ก<Link className="link" href="/account#test">สร้างออเดอร์ตัวอย่าง</Link></div>}
          </div>
        </div>
      </div>
      {sp.order && <OrderSheet id={sp.order} closeHref="/" />}
      {sp.handover && (
        <SheetFrame closeHref="/" head={<div><h2>ส่งขนส่ง</h2><div className="xs muted">รอส่ง {packed.length} กล่อง</div></div>}>
          <HandoverSheet orders={packed} preselect={sp.o} onDoneHref="/" />
        </SheetFrame>
      )}
    </>
  )
}
