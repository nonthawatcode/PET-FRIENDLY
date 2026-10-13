import Link from 'next/link'
import { bindListing, createProduct, receiveStock } from '@/app/actions'
import { ActionForm, Submit } from '@/components/ActionForm'
import { PlatformMark } from '@/components/bits'
import { DataMatrixMini } from '@/components/DataMatrix'
import { IconIn } from '@/components/icons'
import { MoveRow } from '@/components/MoveRow'
import { OrderSheet } from '@/components/OrderSheet'
import { ProductSheet } from '@/components/ProductSheet'
import { SheetFrame } from '@/components/SheetFrame'
import { getMovements, getProducts, getUnmappedSkus } from '@/lib/data'
import { PLATFORM } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { sku?: string; tab?: string; new?: string; moves?: string; order?: string; receive?: string }

export default async function StockPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const [products, recent, unmapped] = await Promise.all([getProducts(), getMovements({ limit: 8, hideReservations: true }), getUnmappedSkus()])
  const all = sp.moves ? await getMovements({ limit: 300 }) : []
  const max = Math.max(140, ...products.map((p) => p.on_hand))
  const open = sp.sku ? products.find((p) => p.sku === sp.sku) : undefined

  return (
    <>
      <div className="lt">
        <div><h1>สต็อก</h1><p>พร้อมขาย = ในคลัง − จอง</p></div>
        {products.length > 0 && <Link className="btn pri" href="/stock?receive=1" scroll={false}><IconIn /> รับสินค้าเข้า</Link>}
      </div>

      {unmapped.length > 0 && (
        <div className="sect">
          <div className="sect-h"><h2>SKU ที่ยังไม่ผูก</h2><span className="xs muted">ออเดอร์เหล่านี้ยังไม่จองสต็อก</span></div>
          <div className="group">
            {unmapped.map((u) => (
              <div className="rowi" key={u.platform + u.sku} style={{ flexWrap: 'wrap' }}>
                <PlatformMark p={u.platform} />
                <div className="main"><div className="t1 mono">{u.sku}</div><div className="t2">{PLATFORM[u.platform]} · {u.count} ออเดอร์รออยู่</div></div>
                <ActionForm action={bindListing} className="row">
                  <input type="hidden" name="platform" value={u.platform} />
                  <input type="hidden" name="external_sku" value={u.sku} />
                  <select name="product_id" className="selchip" aria-label="ผูกกับสินค้า">{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.option_name}</option>)}</select>
                  <Submit className="btn">ผูก</Submit>
                </ActionForm>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pgrid">
        {products.map((p) => {
          return (
            <Link key={p.id} className="pcard" href={`/stock?sku=${encodeURIComponent(p.sku)}`} scroll={false}>
              <div className="ph">
                <div style={{ minWidth: 0 }}><div className="xs muted">{p.name}</div><h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{p.option_name || p.name}</h3><div className="mono xs muted">{p.sku}</div></div>
                <DataMatrixMini text={p.sku} fg={p.dm_fg} bg={p.dm_bg} />
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                <span className="bigv" style={{ color: p.is_low ? 'var(--bad)' : undefined }}>{p.available}</span>
                <span className="small muted">พร้อมขาย</span>{p.is_low && <span className="chip bad">ใกล้หมด</span>}
              </div>
              <div className={`meter ${p.is_low ? 'low' : ''}`}>
                <span className="av" style={{ width: `${(Math.max(p.available, 0) / max) * 100}%` }} />
                <span className="rs" style={{ width: `${(p.reserved / max) * 100}%` }} />
              </div>
              <div className="pfoot"><span>ในคลัง <b>{p.on_hand}</b></span><span>จอง <b>{p.reserved}</b></span>{p.available < 0 && <span className="flag">จองเกินของในคลัง</span>}</div>
            </Link>
          )
        })}
        <Link className="addcard" href="/stock?new=1" scroll={false} style={{ display: 'grid', placeItems: 'center' }}>+ เพิ่มสินค้า</Link>
      </div>

      <div className="sect">
        <div className="sect-h"><h2>ความเคลื่อนไหวล่าสุด</h2><Link className="link" href="/stock?moves=all" scroll={false}>ดูทั้งหมด</Link></div>
        <div className="group">
          {recent.length ? recent.map((m) => <MoveRow key={m.id} m={m} orderHref={(id) => `/stock?order=${id}`} />) : <div className="empty-state">ยังไม่มีความเคลื่อนไหว</div>}
        </div>
      </div>

      {open && <ProductSheet p={open} tab={sp.tab ?? 'stock'} closeHref="/stock" />}
      {sp.order && <OrderSheet id={sp.order} closeHref="/stock" />}
      {sp.moves && (
        <SheetFrame closeHref="/stock" head={<h2>ความเคลื่อนไหวทั้งหมด</h2>}>
          <p className="xs muted" style={{ margin: 0 }}>300 รายการล่าสุด รวมการจอง/ปลดจอง</p>
          <div className="group">{all.map((m) => <MoveRow key={m.id} m={m} orderHref={(id) => `/stock?order=${id}`} />)}</div>
        </SheetFrame>
      )}
      {sp.receive && (
        <SheetFrame closeHref="/stock" head={<h2>รับสินค้าเข้า</h2>}>
          <ActionForm action={receiveStock} className="formcard" resetOnSuccess>
            <div className="field"><label htmlFor="rp">สินค้า</label>
              <select id="rp" name="product_id" className="input">{products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.option_name} (ในคลัง {p.on_hand})</option>)}</select></div>
            <div className="field"><label htmlFor="rq2">จำนวน</label><input id="rq2" name="qty" className="input" type="number" min={1} required /></div>
            <div className="field"><label htmlFor="rn2">หมายเหตุ</label><input id="rn2" name="note" className="input" placeholder="เช่น ล็อตจากโรงงาน" /></div>
            <Submit>บันทึกรับเข้า</Submit>
          </ActionForm>
        </SheetFrame>
      )}
      {sp.new && (
        <SheetFrame closeHref="/stock" head={<h2>เพิ่มสินค้า</h2>}>
          <ActionForm action={createProduct} className="formcard">
            <div className="field"><label htmlFor="ns">SKU (ใช้ทำ Data Matrix เปลี่ยนภายหลังไม่ได้)</label><input id="ns" name="sku" className="input mono" required placeholder="PF-FDP-04" style={{ textTransform: 'uppercase' }} /></div>
            <div className="field"><label htmlFor="nn">ชื่อสินค้า</label><input id="nn" name="name" className="input" defaultValue="FUR DE PARFUM" required /></div>
            <div className="field"><label htmlFor="no">กลิ่น / ตัวเลือก</label><input id="no" name="option_name" className="input" /></div>
            <div className="field"><label htmlFor="nt">แจ้งเตือนเมื่อพร้อมขายเหลือ</label><input id="nt" name="threshold" className="input" type="number" min={0} defaultValue={20} /></div>
            <Submit>สร้างสินค้า</Submit>
          </ActionForm>
        </SheetFrame>
      )}
    </>
  )
}
