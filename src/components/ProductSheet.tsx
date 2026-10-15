import Link from 'next/link'
import { bindListing, saveProduct, unbindListing } from '@/app/actions'
import { getCategories, getListings, getMovements } from '@/lib/data'
import { PLATFORM } from '@/lib/format'
import type { Platform, ProductStock } from '@/lib/types'
import { ActionForm, Submit } from './ActionForm'
import { PlatformMark } from './bits'
import { DataMatrixMini } from './DataMatrix'
import { DmEditor } from './DmEditor'
import { IconLock } from './icons'
import { MoveRow } from './MoveRow'
import { ProductImageUpload } from './ProductImageUpload'
import { SheetFrame } from './SheetFrame'
import { StockAdjuster } from './StockAdjuster'

const TABS = [['stock', 'สต็อก'], ['dm', 'Data Matrix'], ['info', 'ข้อมูล'], ['history', 'ประวัติ']] as const

export async function ProductSheet({ p, tab, closeHref }: { p: ProductStock; tab: string; closeHref: string }) {
  const t = TABS.some(([k]) => k === tab) ? tab : 'stock'
  const href = (k: string) => `/stock?sku=${encodeURIComponent(p.sku)}&tab=${k}`
  const [listings, moves, categories] = await Promise.all([
    t === 'stock' ? getListings(p.id) : Promise.resolve([]),
    t === 'history' ? getMovements({ productId: p.id, limit: 200 }) : Promise.resolve([]),
    t === 'info' ? getCategories() : Promise.resolve([]),
  ])

  return (
    <SheetFrame
      closeHref={closeHref}
      head={
        <div style={{ display: 'grid', gap: 12, width: '100%' }}>
          <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
            <DataMatrixMini text={p.sku} fg={p.dm_fg} bg={p.dm_bg} size={44} />
            <div style={{ minWidth: 0 }}><div className="mono xs muted">{p.sku}</div><h2 style={{ fontSize: '1.15rem' }}>{p.option_name || p.name}</h2></div>
          </div>
          <div className="seg" role="tablist">
            {TABS.map(([k, l]) => <Link key={k} role="tab" aria-selected={t === k} href={href(k)} scroll={false} className="segl">{l}</Link>)}
          </div>
        </div>
      }
    >
      {t === 'stock' && (
        <>
          <div className="trio">
            <div><span className="xs muted">ในคลัง</span><b>{p.on_hand}</b></div>
            <div><span className="xs muted">จอง</span><b>{p.reserved}</b></div>
            <div><span className="xs muted">พร้อมขาย</span><b style={{ color: p.is_low ? 'var(--bad)' : undefined }}>{p.available}</b></div>
          </div>
          <StockAdjuster productId={p.id} onHand={p.on_hand} />
          <div className="sect">
            <span className="cap">รหัสบน Marketplace</span>
            <div className="group">
              {listings.map((l) => (
                <div className="rowi" key={l.id}>
                  <PlatformMark p={l.platform} />
                  <div className="main"><div className="t1">{PLATFORM[l.platform]}</div><div className="t2 mono">{l.external_sku}</div></div>
                  <ActionForm action={unbindListing}><input type="hidden" name="listing_id" value={l.id} /><Submit className="link quiet" pendingText="…">เลิกผูก</Submit></ActionForm>
                </div>
              ))}
              {!listings.length && <div className="rowi noicon muted small">ยังไม่ได้ผูกรหัสของ Marketplace</div>}
            </div>
            <ActionForm action={bindListing} className="formcard" resetOnSuccess>
              <input type="hidden" name="product_id" value={p.id} />
              <div className="formrow">
                <div className="field"><label htmlFor="bp">ช่องทาง</label>
                  <select id="bp" name="platform" className="input">{(Object.keys(PLATFORM) as Platform[]).map((k) => <option key={k} value={k}>{PLATFORM[k]}</option>)}</select></div>
                <div className="field"><label htmlFor="bs">รหัสสินค้า / ตัวเลือก</label><input id="bs" name="external_sku" className="input" required placeholder="SKU ที่ตั้งใน Seller Center" /></div>
              </div>
              <Submit className="btn">ผูกรหัส</Submit>
            </ActionForm>
          </div>
        </>
      )}

      {t === 'dm' && <DmEditor productId={p.id} sku={p.sku} fg={p.dm_fg} bg={p.dm_bg} />}

      {t === 'info' && (
        <>
          <ProductImageUpload productId={p.id} url={p.image_url} />
          <ActionForm action={saveProduct} className="formcard">
            <input type="hidden" name="product_id" value={p.id} />
            <div className="field"><label htmlFor="pn">ชื่อสินค้า</label><input id="pn" name="name" className="input" defaultValue={p.name} required /></div>
            <div className="field"><label htmlFor="po">กลิ่น / ตัวเลือก</label><input id="po" name="option_name" className="input" defaultValue={p.option_name} /></div>
            <div className="field"><label htmlFor="pc">หมวดหมู่</label>
              <select id="pc" name="category_id" className="input" defaultValue={p.category_id ?? ''}>
                <option value="">— ไม่มีหมวด —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="pt">แจ้งเตือนเมื่อพร้อมขายเหลือ</label><input id="pt" name="threshold" className="input" type="number" min={0} defaultValue={p.low_stock_threshold} /></div>
            <Submit>บันทึก</Submit>
          </ActionForm>
          <div className="group"><div className="rowi"><span className="ic"><IconLock /></span><div className="main"><div className="t1 mono">{p.sku}</div><div className="t2">SKU ล็อกแล้ว เพราะพิมพ์ลงบรรจุภัณฑ์</div></div></div></div>
        </>
      )}

      {t === 'history' && (
        <div className="group">
          {moves.length ? moves.map((m) => <MoveRow key={m.id} m={m} />) : <div className="empty-state">ยังไม่มีความเคลื่อนไหว</div>}
        </div>
      )}
    </SheetFrame>
  )
}
