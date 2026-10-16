'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sendToShop } from '@/app/actions'
import { englishKey, fixThaiKeyboard } from '@/lib/keyboard'
import type { ProductStock, Shop } from '@/lib/types'
import { CameraScanner } from './CameraScanner'
import { IconCamera, IconCheck, IconScan, IconX } from './icons'

type Line = { p: ProductStock; qty: number }

/**
 * Send stock to a consignment shop: pick the shop, scan each scent once, type how many,
 * confirm. Central stock is deducted on confirm and a delivery note is created.
 */
export function ShopSendSheet({ shops, products, shopId }: { shops: Shop[]; products: ProductStock[]; shopId?: string }) {
  const [shop, setShop] = useState(shopId ?? (shops.length === 1 ? shops[0].id : ''))
  const [lines, setLines] = useState<Line[]>([])
  const [asking, setAsking] = useState<{ p: ProductStock; qty: number } | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [docId, setDocId] = useState('')
  const [cam, setCam] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const bySku = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products])
  const total = lines.reduce((n, l) => n + l.qty, 0)
  const isTouch = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches

  function scan(raw: string) {
    const code = fixThaiKeyboard(raw.trim()).toUpperCase()
    if (!code) return
    if (asking) confirmQty()
    const p = bySku.get(code)
    if (!p) { setMsg({ ok: false, text: `ไม่รู้จักรหัส ${code}` }); return }
    setMsg(null)
    setAsking({ p, qty: lines.find((l) => l.p.id === p.id)?.qty ?? 1 })
    setCam(false)
  }
  const scanRef = useRef(scan)
  scanRef.current = scan

  function confirmQty() {
    if (!asking) return
    const qty = Math.max(0, Math.floor(asking.qty) || 0)
    if (qty > asking.p.available) { setMsg({ ok: false, text: `${asking.p.option_name || asking.p.name} พร้อมขายเหลือ ${asking.p.available} ชิ้น` }); return }
    setLines((ls) => {
      const rest = ls.filter((l) => l.p.id !== asking.p.id)
      return qty > 0 ? [...rest, { p: asking.p, qty }] : rest
    })
    setAsking(null)
    setMsg(null)
    if (!isTouch()) setTimeout(() => input.current?.focus(), 0)
  }

  useEffect(() => { if (asking && !isTouch()) qtyRef.current?.select() }, [asking])
  useEffect(() => { if (!isTouch()) input.current?.focus() }, [])

  // Scanner typing while no field is selected (phones).
  useEffect(() => {
    let buf = '', last = 0
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input,textarea,select,[contenteditable="true"]')) return
      const now = Date.now()
      if (now - last > 1000) buf = ''
      last = now
      if (e.key === 'Enter') { if (buf) { e.preventDefault(); const v = buf; buf = ''; scanRef.current(v) } return }
      const ch = englishKey(e)
      if (!ch || ch === ' ') return
      e.preventDefault()
      buf += ch
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function submit() {
    if (!shop || !lines.length || busy) return
    setBusy(true); setMsg(null)
    const r = await sendToShop(shop, Object.fromEntries(lines.map((l) => [l.p.id, l.qty])), note)
    setBusy(false)
    if (r.ok && r.docId) setDocId(r.docId)
    else if (!r.ok) setMsg({ ok: false, text: r.error })
  }

  if (docId) {
    return (
      <div className="donebox" style={{ padding: '24px 0', display: 'grid', gap: 14, justifyItems: 'center' }}>
        <span className="ok"><IconCheck /></span>
        <h3>ส่งของแล้ว {total} ชิ้น</h3>
        <p className="small muted" style={{ margin: 0 }}>ตัดสต็อกกลางแล้ว · ของอยู่ที่ร้าน {shops.find((s) => s.id === shop)?.name}</p>
        <a className="btn pri xl" href={`/print/shop-doc/${docId}`} target="_blank" rel="noreferrer">พิมพ์ใบส่งของ</a>
        <Link className="link" href={`/stock?view=shops&shop=${shop}`} scroll={false}>ดูร้านนี้</Link>
      </div>
    )
  }

  return (
    <>
      <div className="sect">
        <span className="cap">1. ร้านที่จะส่ง</span>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {shops.map((s) => <button key={s.id} type="button" className="fchip" aria-pressed={shop === s.id} onClick={() => setShop(s.id)}>{s.name}</button>)}
        </div>
      </div>

      <div className="sect">
        <span className="cap">2. สแกนสินค้า กลิ่นละ 1 ครั้ง แล้วใส่จำนวน</span>
        <div className="scanbox">
          <IconScan />
          <button type="button" className="cambtn" onClick={() => setCam(true)} aria-label="สแกนด้วยกล้องมือถือ"><IconCamera /><span>กล้อง</span></button>
          <input ref={input} className="scaninput" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="ช่องสแกน" placeholder="สแกน Data Matrix สินค้า…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); const v = e.currentTarget.value; e.currentTarget.value = ''; scan(v); return }
              const ch = englishKey(e)
              if (ch) { e.preventDefault(); e.currentTarget.value += ch }
            }} />
        </div>

        {asking && (
          <div className="formcard adj askqty">
            <div><div className="mono xs muted">{asking.p.sku}</div><b>{asking.p.option_name || asking.p.name}</b> <span className="small muted">· พร้อมขาย {asking.p.available}</span></div>
            <div className="small" style={{ fontWeight: 600 }}>ส่งกี่ชิ้น?</div>
            <div className="adj-qty">
              <button type="button" aria-label="ลดจำนวน" onClick={() => setAsking({ ...asking, qty: Math.max(0, asking.qty - 1) })}>−</button>
              <input ref={qtyRef} type="number" inputMode="numeric" min={0} value={asking.qty} aria-label="จำนวนที่ส่ง"
                onChange={(e) => setAsking({ ...asking, qty: Number(e.target.value) })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmQty() } }} />
              <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setAsking({ ...asking, qty: asking.qty + 1 })}>+</button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setAsking(null)}>ยกเลิก</button>
              <button type="button" className="btn pri" style={{ flex: 2 }} onClick={confirmQty}>ตกลง</button>
            </div>
          </div>
        )}

        {msg && <div className={`banner ${msg.ok ? 'ok' : 'bad'}`} role="alert"><div>{msg.text}</div><button type="button" className="xbtn" aria-label="ปิด" onClick={() => setMsg(null)}><IconX /></button></div>}

        <div className="group">
          {lines.map((l) => (
            <div className="rowi" key={l.p.id}>
              <div className="main"><div className="t1">{l.p.option_name || l.p.name}</div><div className="t2 mono">{l.p.sku}</div></div>
              <button type="button" className="link quiet" onClick={() => setAsking({ p: l.p, qty: l.qty })}>แก้</button>
              <b className="num">{l.qty}</b>
            </div>
          ))}
          {!lines.length && <div className="empty-state">ยังไม่มีสินค้า สแกนกลิ่นแรกได้เลย</div>}
        </div>
      </div>

      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุในใบส่งของ (ไม่ใส่ก็ได้)" aria-label="หมายเหตุ" />
      <button type="button" className="btn ink xl" disabled={!shop || !lines.length || busy || !!asking} onClick={submit}>
        {busy ? 'กำลังบันทึก…' : !shop ? 'เลือกร้านก่อน' : !lines.length ? 'สแกนสินค้าก่อน' : asking ? 'ใส่จำนวนแล้วกดตกลงก่อน' : <><IconCheck /> ยืนยันส่ง {total} ชิ้น</>}
      </button>
      <p className="xs muted" style={{ margin: 0, textAlign: 'center' }}>กดยืนยันแล้วจะตัดสต็อกกลาง และได้ใบส่งของไว้พิมพ์</p>

      {cam && <CameraScanner hint="สแกน Data Matrix สินค้า" lastResult={null} onCode={(c) => scan(c)} onClose={() => setCam(false)} />}
    </>
  )
}
