'use client'

import { useState, useTransition } from 'react'
import { adjustStock, receiveStock } from '@/app/actions'

/** Big, plain add / reduce stock control for one product. */
export function StockAdjuster({ productId, onHand }: { productId: string; onHand: number }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const add = mode === 'add'
  const n = Math.max(1, Math.floor(qty) || 1)

  function save() {
    if (!add && !note.trim()) { setMsg({ ok: false, text: 'ใส่เหตุผลที่ลด เช่น ชำรุด หรือ นับใหม่' }); return }
    const fd = new FormData()
    fd.set('product_id', productId)
    if (add) { fd.set('qty', String(n)); fd.set('note', note) } else { fd.set('delta', String(-n)); fd.set('reason', note) }
    setMsg(null)
    start(async () => {
      const r = add ? await receiveStock(null, fd) : await adjustStock(null, fd)
      if (r.ok) { setMsg({ ok: true, text: add ? `เพิ่ม ${n} ชิ้นแล้ว` : `ลด ${n} ชิ้นแล้ว` }); setQty(1); setNote('') }
      else setMsg({ ok: false, text: r.error })
    })
  }

  return (
    <div className="formcard adj">
      <div className="adj-mode">
        <button type="button" className={add ? 'on add' : ''} onClick={() => { setMode('add'); setMsg(null) }}>+ เพิ่มสต็อก</button>
        <button type="button" className={!add ? 'on remove' : ''} onClick={() => { setMode('remove'); setMsg(null) }}>− ลดสต็อก</button>
      </div>
      <div className="adj-qty">
        <button type="button" aria-label="ลดจำนวน" onClick={() => setQty(Math.max(1, n - 1))}>−</button>
        <input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="จำนวน" />
        <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setQty(n + 1)}>+</button>
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>
        ในคลัง {onHand} → <b>{add ? onHand + n : onHand - n}</b> ชิ้น
      </div>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={add ? 'หมายเหตุ (ไม่ใส่ก็ได้) เช่น ล็อตจากโรงงาน' : 'เหตุผลที่ลด เช่น ชำรุด, นับใหม่'} aria-label={add ? 'หมายเหตุ' : 'เหตุผลที่ลด'} />
      <button type="button" className={`btn xl ${add ? 'pri' : 'danger'}`} disabled={pending} onClick={save}>
        {pending ? 'กำลังบันทึก…' : add ? `เพิ่ม ${n} ชิ้น` : `ลด ${n} ชิ้น`}
      </button>
      {msg && <p className={msg.ok ? 'fok' : 'ferr'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  )
}
