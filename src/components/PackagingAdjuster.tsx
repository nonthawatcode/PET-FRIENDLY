'use client'

import { useState, useTransition } from 'react'
import { adjustPackaging } from '@/app/actions'

/** Big add / reduce control for one packaging item (same look as product stock). */
export function PackagingAdjuster({ id, qty: now }: { id: string; qty: number }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const add = mode === 'add'
  const n = Math.max(1, Math.floor(qty) || 1)

  const save = () => start(async () => {
    const r = await adjustPackaging(id, add ? n : -n)
    if (r.ok) { setMsg({ ok: true, text: add ? `เพิ่ม ${n} ชิ้นแล้ว` : `ลด ${n} ชิ้นแล้ว` }); setQty(1) }
    else setMsg({ ok: false, text: r.error })
  })

  return (
    <div className="formcard adj">
      <div className="adj-mode">
        <button type="button" className={add ? 'on add' : ''} onClick={() => { setMode('add'); setMsg(null) }}>+ เพิ่ม</button>
        <button type="button" className={!add ? 'on remove' : ''} onClick={() => { setMode('remove'); setMsg(null) }}>− ลด</button>
      </div>
      <div className="adj-qty">
        <button type="button" aria-label="ลดจำนวน" onClick={() => setQty(Math.max(1, n - 1))}>−</button>
        <input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="จำนวน" />
        <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setQty(n + 1)}>+</button>
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>ในคลัง {now} → <b>{add ? now + n : now - n}</b> ชิ้น</div>
      <button type="button" className={`btn xl ${add ? 'pri' : 'danger'}`} disabled={pending} onClick={save}>
        {pending ? 'กำลังบันทึก…' : add ? `เพิ่ม ${n} ชิ้น` : `ลด ${n} ชิ้น`}
      </button>
      {msg && <p className={msg.ok ? 'fok' : 'ferr'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  )
}
