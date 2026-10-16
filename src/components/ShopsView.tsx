import Link from 'next/link'
import { deleteShop, saveShop } from '@/app/actions'
import { getShop, getShops } from '@/lib/data'
import { docNo, when } from '@/lib/format'
import type { ProductStock, Shop } from '@/lib/types'
import { ActionForm, Submit } from './ActionForm'
import { IconOut } from './icons'
import { SheetFrame } from './SheetFrame'
import { ShopActions } from './ShopActions'
import { ShopSendSheet } from './ShopSendSheet'

const MOVE = { send: 'ส่งไปร้าน', sold: 'ร้านขายได้', return: 'รับคืน', adjust: 'แก้จำนวน' } as const

function ShopForm({ shop }: { shop?: Shop }) {
  return (
    <ActionForm action={saveShop} className="formcard" resetOnSuccess={!shop}>
      {shop && <input type="hidden" name="shop_id" value={shop.id} />}
      <div className="field"><label htmlFor="sn">ชื่อร้าน</label><input id="sn" name="name" className="input" defaultValue={shop?.name} required placeholder="เช่น PETCLUB สาขาสยาม" /></div>
      <div className="formrow">
        <div className="field"><label htmlFor="sc">ผู้ติดต่อ</label><input id="sc" name="contact" className="input" defaultValue={shop?.contact ?? ''} /></div>
        <div className="field"><label htmlFor="sp">โทร</label><input id="sp" name="phone" className="input" defaultValue={shop?.phone ?? ''} inputMode="tel" /></div>
      </div>
      <div className="field"><label htmlFor="sa">ที่อยู่ (ขึ้นในใบส่งของ)</label><textarea id="sa" name="address" className="input" rows={2} defaultValue={shop?.address ?? ''} /></div>
      <Submit>{shop ? 'บันทึกข้อมูลร้าน' : 'เพิ่มร้าน'}</Submit>
    </ActionForm>
  )
}

export async function ShopsView({ sp, products }: { sp: { send?: string; shop?: string; newshop?: string }; products: ProductStock[] }) {
  const shops = await getShops()
  const detail = sp.shop ? await getShop(sp.shop) : null
  const back = '/stock?view=shops'

  return (
    <>
      {shops.length > 0 && <Link className="btn ink xl" href={`${back}&send=1`} scroll={false}><IconOut /> ส่งของให้ร้าน</Link>}

      <div className="group">
        {shops.map((s) => {
          const total = s.stock.reduce((n, l) => n + l.qty, 0)
          return (
            <Link key={s.id} className="rowi" href={`${back}&shop=${s.id}`} scroll={false}>
              <span className="ic" style={{ fontWeight: 700 }}>{s.name.slice(0, 1).toUpperCase()}</span>
              <div className="main">
                <div className="t1">{s.name}</div>
                <div className="t2">{s.stock.length ? s.stock.map((l) => `${l.products?.option_name || l.products?.sku} ${l.qty}`).join(' · ') : 'ยังไม่มีของฝากขาย'}</div>
              </div>
              <div className="trail"><b className="num">{total}</b><span className="xs muted">ชิ้นที่ร้าน</span></div>
            </Link>
          )
        })}
        {!shops.length && <div className="empty-state">ยังไม่มีร้านค้า</div>}
      </div>
      <Link className="link" href={`${back}&newshop=1`} scroll={false} style={{ justifySelf: 'start' }}>+ เพิ่มร้านค้า</Link>
      <p className="xs muted" style={{ margin: 0 }}>ของที่ส่งไปฝากขายถูกตัดออกจากสต็อกกลางแล้ว ตัวเลขในหน้านี้คือของที่ยังอยู่ที่ร้าน</p>

      {sp.send && (
        <SheetFrame closeHref={back} head={<h2>ส่งของให้ร้าน</h2>}>
          <ShopSendSheet shops={shops} products={products} shopId={shops.some((s) => s.id === sp.send) ? sp.send : undefined} />
        </SheetFrame>
      )}

      {sp.newshop && (
        <SheetFrame closeHref={back} head={<h2>เพิ่มร้านค้า</h2>}>
          <ShopForm />
        </SheetFrame>
      )}

      {detail && (
        <SheetFrame closeHref={back} head={<div><div className="xs muted">ร้านฝากขาย</div><h2>{detail.shop.name}</h2></div>}>
          <div className="group">
            {detail.stock.filter((l) => l.qty > 0).map((l) => (
              <div className="rowi" key={l.product_id}>
                <div className="main"><div className="t1">{l.products?.option_name || l.products?.name}</div><div className="t2 mono">{l.products?.sku}</div></div>
                <b className="num">{l.qty}</b>
              </div>
            ))}
            {!detail.stock.some((l) => l.qty > 0) && <div className="empty-state">ไม่มีของค้างที่ร้าน</div>}
          </div>
          <Link className="btn ink" href={`${back}&send=${detail.shop.id}`} scroll={false}><IconOut /> ส่งของเพิ่มให้ร้านนี้</Link>

          <div className="sect">
            <span className="cap">อัปเดตของที่ร้าน</span>
            <ShopActions shopId={detail.shop.id} stock={detail.stock} />
          </div>

          <div className="sect">
            <span className="cap">ใบส่งของ / ใบรับคืน</span>
            <div className="group">
              {detail.docs.map((d) => (
                <a key={d.id} className="rowi" href={`/print/shop-doc/${d.id}`} target="_blank" rel="noreferrer">
                  <div className="main"><div className="t1 mono">{docNo(d)}</div><div className="t2">{d.kind === 'send' ? 'ส่งของ' : 'รับคืน'} · {when(d.created_at)}{d.profiles?.display_name && ` · ${d.profiles.display_name}`}</div></div>
                  <span className="link">พิมพ์</span>
                </a>
              ))}
              {!detail.docs.length && <div className="empty-state">ยังไม่มีเอกสาร</div>}
            </div>
          </div>

          <div className="sect">
            <span className="cap">ประวัติ</span>
            <div className="group">
              {detail.moves.map((m) => (
                <div className="rowi" key={m.id}>
                  <div className="main"><div className="t1">{MOVE[m.kind]} <span className="mono small muted">{m.products?.sku}</span></div><div className="t2">{when(m.created_at)}{m.profiles?.display_name && ` · ${m.profiles.display_name}`}{m.note && ` · ${m.note}`}</div></div>
                  <b className="num" style={{ color: m.qty < 0 ? 'var(--bad)' : 'var(--ok)' }}>{m.qty > 0 ? '+' : '−'}{Math.abs(m.qty)}</b>
                </div>
              ))}
              {!detail.moves.length && <div className="empty-state">ยังไม่มีประวัติ</div>}
            </div>
          </div>

          <details className="formcard">
            <summary className="link quiet">แก้ไขข้อมูลร้าน / ลบร้าน</summary>
            <div className="sect" style={{ marginTop: 12 }}>
              <ShopForm shop={detail.shop} />
              <ActionForm action={deleteShop}>
                <input type="hidden" name="shop_id" value={detail.shop.id} />
                <Submit className="link quiet" pendingText="กำลังลบ…">ลบร้านนี้</Submit>
              </ActionForm>
              <p className="xs muted" style={{ margin: 0 }}>ลบแล้วร้านจะหายจากรายการ แต่ใบส่งของและประวัติยังเก็บไว้</p>
            </div>
          </details>
        </SheetFrame>
      )}
    </>
  )
}
