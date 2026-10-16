'use client'

import { useState, useTransition } from 'react'
import { returnFromShop, shopAdjust, shopSold } from '@/app/actions'
import type { ShopStockLine } from '@/lib/types'

type Mode = 'sold' | 'return' | 'count'
const MODES: [Mode, string][] = [['sold', 'ร้านขายได้'], ['return', 'รับของคืน'], ['count', 'แก้จำนวนที่ร้าน']]

/** Record what happened to stock at a consignment shop. */
export function ShopActions({ shopId, stock }: { shopId: string; stock: ShopStockLine[] }) {
  const [mode, setMode] = useState<Mode>('sold')
  const held = stock.filter((l) => l.qty > 0)
  const lines = mode === 'count' ? stock : held
  const [pid, setPid] = useState(held[0]?.product_id ?? stock[0]?.product_id ?? '')
  const line = stock.find((l) => l.product_id === pid)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string; doc?: string } | null>(null)
  const [pending, start] = useTransition()
  const n = Math.max(0, Math.floor(qty) || 0)
  const at = line?.qty ?? 0

  if (!stock.length) return <div className="formcard"><p className="small muted" style={{ margin: 0 }}>ยังไม่มีของที่ร้านนี้ ส่งของให้ร้านก่อน</p></div>

  function save() {
    if (!line) return
    if (mode === 'count' && !note.trim()) { setMsg({ ok: false, text: 'ใส่เหตุผล เช่น นับสต็อกที่ร้าน' }); return }
    if (mode !== 'count' && n < 1) return
    setMsg(null)
    start(async () => {
      const name = line.products?.option_name || line.products?.name || ''
      if (mode === 'sold') {
        const r = await shopSold(shopId, pid, n, note)
        setMsg(r.ok ? { ok: true, text: `บันทึกขายได้ ${name} ${n} ชิ้น` } : { ok: false, text: r.error })
      } else if (mode === 'return') {
        const r = await returnFromShop(shopId, { [pid]: n }, note)
        setMsg(r.ok ? { ok: true, text: `รับคืน ${name} ${n} ชิ้น เข้าสต็อกกลางแล้ว`, doc: r.docId } : { ok: false, text: r.error })
      } else {
        if (n === at) { setMsg({ ok: false, text: 'จำนวนเท่าเดิม ไม่มีอะไรเปลี่ยน' }); return }
        const r = await shopAdjust(shopId, pid, n - at, note)
        setMsg(r.ok ? { ok: true, text: `แก้จำนวน ${name} เป็น ${n} ชิ้นแล้ว` } : { ok: false, text: r.error })
      }
      setNote(''); setQty(mode === 'count' ? n : 1)
    })
  }

  return (
    <div className="formcard adj">
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {MODES.map(([k, l]) => (
          <button key={k} type="button" className="fchip" aria-pressed={mode === k}
            onClick={() => { setMode(k); setMsg(null); setQty(k === 'count' ? at : 1); if (k !== 'count' && !held.some((h) => h.product_id === pid)) setPid(held[0]?.product_id ?? '') }}>{l}</button>
        ))}
      </div>
      {lines.length ? (
        <>
          <select className="input" value={pid} aria-label="สินค้า" onChange={(e) => { setPid(e.target.value); setQty(mode === 'count' ? stock.find((l) => l.product_id === e.target.value)?.qty ?? 0 : 1) }}>
            {lines.map((l) => <option key={l.product_id} value={l.product_id}>{l.products?.sku} · {l.products?.option_name || l.products?.name} (ที่ร้าน {l.qty})</option>)}
          </select>
          <div className="small" style={{ fontWeight: 600 }}>{mode === 'sold' ? 'ขายได้กี่ชิ้น?' : mode === 'return' ? 'รับคืนกี่ชิ้น?' : 'นับที่ร้านได้จริงกี่ชิ้น?'}</div>
          <div className="adj-qty">
            <button type="button" aria-label="ลดจำนวน" onClick={() => setQty(Math.max(0, n - 1))}>−</button>
            <input type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="จำนวน" />
            <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setQty(n + 1)}>+</button>
          </div>
          <div className="small muted" style={{ textAlign: 'center' }}>
            ที่ร้าน {at} → <b>{mode === 'count' ? n : at - n}</b> ชิ้น{mode === 'return' && ' · สต็อกกลาง +' + n}
          </div>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} aria-label="หมายเหตุ"
            placeholder={mode === 'count' ? 'เหตุผล เช่น นับสต็อกที่ร้าน' : 'หมายเหตุ (ไม่ใส่ก็ได้)'} />
          <button type="button" className={`btn xl ${mode === 'return' ? 'pri' : 'ink'}`} disabled={pending || !line} onClick={save}>
            {pending ? 'กำลังบันทึก…' : mode === 'sold' ? `บันทึกขายได้ ${n} ชิ้น` : mode === 'return' ? `รับคืน ${n} ชิ้น` : `แก้เป็น ${n} ชิ้น`}
          </button>
        </>
      ) : <p className="small muted" style={{ margin: 0 }}>ไม่มีของค้างที่ร้านนี้แล้ว</p>}
      {msg && (
        <p className={msg.ok ? 'fok' : 'ferr'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}{msg.doc && <> · <a className="link" href={`/print/shop-doc/${msg.doc}`} target="_blank" rel="noreferrer">พิมพ์ใบรับคืน</a></>}
        </p>
      )}
    </div>
  )
}
