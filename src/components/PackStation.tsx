'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { bindLabelCode, confirmPack, parkPack, startPack } from '@/app/actions'
import { PLATFORM, baht } from '@/lib/format'
import type { Order } from '@/lib/types'
import { PlatformMark } from './bits'
import { CameraScanner } from './CameraScanner'
import { IconCamera, IconCheck, IconScan, IconX } from './icons'

type Product = { id: string; sku: string; option_name: string }
type Msg = { type: 'ok' | 'bad' | 'warn'; text: string; sub?: string; bindCode?: string; id?: number }
type Line = { productId: string; sku: string; name: string; need: number }

const STEPS = [
  ['สแกนใบปะหน้า', 'เปิดออเดอร์'],
  ['ตรวจสินค้า', 'สแกนทุกชิ้น'],
  ['ยืนยันแพ็ก', 'ตัดสต็อก'],
  ['พร้อมส่ง', 'ส่งให้ขนส่ง'],
] as const

let audio: AudioContext | null = null
function beep(ok: boolean) {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = ok ? 880 : 200
    o.type = ok ? 'sine' : 'square'
    g.gain.value = 0.05
    o.connect(g); g.connect(audio.destination)
    o.start(); o.stop(audio.currentTime + (ok ? 0.08 : 0.3))
  } catch {}
}

function Ring({ n, q }: { n: number; q: number }) {
  const r = 13, c = 2 * Math.PI * r, f = q ? n / q : 0
  return (
    <svg className="ring" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--sep2)" strokeWidth="3" />
      <circle className="arc" cx="16" cy="16" r={r} fill="none" stroke={f >= 1 ? 'var(--ok)' : 'var(--fg)'} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 16 16)" />
      {f >= 1 && <path d="m11 16.5 3.2 3 6.3-6.5" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function PackStation({ products, nextOrderId, demoCodes }: { products: Product[]; nextOrderId: string | null; demoCodes: string[] }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [scanned, setScanned] = useState<Record<string, number>>({})
  const [done, setDone] = useState<Order | null>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [busy, setBusy] = useState(false)
  const [hit, setHit] = useState<string | null>(null)
  const [bindOrder, setBindOrder] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const prevPct = useRef(0)
  const lastPhase = useRef(1)

  const bySku = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products])
  const lines: Line[] = useMemo(() => {
    if (!order) return []
    const m = new Map<string, Line>()
    for (const it of order.order_items) {
      if (!it.product_id || !it.products) continue
      const l = m.get(it.product_id) ?? { productId: it.product_id, sku: it.products.sku, name: it.products.option_name || it.products.name, need: 0 }
      l.need += it.quantity
      m.set(it.product_id, l)
    }
    return [...m.values()]
  }, [order])
  const total = lines.reduce((a, l) => a + l.need, 0)
  const got = lines.reduce((a, l) => a + Math.min(scanned[l.productId] ?? 0, l.need), 0)
  const complete = total > 0 && lines.every((l) => (scanned[l.productId] ?? 0) === l.need)
  const phase = order ? (complete ? 3 : 2) : done ? 4 : 1
  const pct = total ? Math.round((got / total) * 100) : 0
  const from = prevPct.current
  const stepJustChanged = lastPhase.current !== phase
  const stepFrom = lastPhase.current
  useEffect(() => { prevPct.current = pct; lastPhase.current = phase })

  const [camOpen, setCamOpen] = useState(false)
  const [camCode, setCamCode] = useState<string | null>(null)
  // Keep the field ready for a USB/Bluetooth scanner on computers. On phones and tablets
  // don't focus it by itself, otherwise the on-screen keyboard pops up; tap the field to type.
  const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches
  const focus = () => { if (!camOpenRef.current && !isTouch()) input.current?.focus({ preventScroll: true }) }
  const camOpenRef = useRef(false)
  camOpenRef.current = camOpen
  useEffect(() => {
    focus()
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('input,select,textarea,a,button,summary,.sheet')) focus()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const confirmBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (phase === 3) {
      setCamOpen(false)
      if (!isTouch()) confirmBtn.current?.focus({ preventScroll: true })
      // Bring the confirm button above the floating menu on phones.
      setTimeout(() => confirmBtn.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const say = (m: Msg | null) => { setMsg(m && { ...m, id: Date.now() }); if (m) beep(m.type === 'ok') }

  async function openLabel(code: string) {
    setBusy(true)
    const r = await startPack(code)
    setBusy(false)
    if (r.ok) {
      setOrder(r.order); setScanned({}); setDone(null); setMsg(null); beep(true)
    } else {
      say({ type: r.code === 'unpaid' || r.code === 'being_packed' ? 'warn' : 'bad', text: r.error, sub: r.detail ?? (r.code === 'not_found' ? `รหัส ${code}` : undefined), bindCode: r.code === 'not_found' ? code : undefined })
    }
  }

  function scanItem(code: string) {
    const p = bySku.get(code.toUpperCase())
    const line = p && lines.find((l) => l.productId === p.id)
    if (!p) return say({ type: 'bad', text: `ไม่รู้จักรหัส ${code}`, sub: 'ถ้าจะเริ่มออเดอร์ใหม่ กด “ยกเลิก” ก่อนสแกนใบปะหน้า' })
    if (!line) return say({ type: 'bad', text: `${p.sku} ไม่อยู่ในออเดอร์นี้`, sub: 'ไม่นับชิ้นนี้ ตรวจสินค้าที่หยิบอีกครั้ง' })
    const n = scanned[p.id] ?? 0
    if (n >= line.need) return say({ type: 'warn', text: `${p.sku} ครบ ${line.need} ชิ้นแล้ว`, sub: 'ชิ้นนี้เกินจำนวน ไม่นับ' })
    setScanned({ ...scanned, [p.id]: n + 1 })
    setHit(p.id)
    setMsg(null)
    beep(true)
  }

  async function confirm() {
    if (!order || !complete || busy) return
    setBusy(true)
    const r = await confirmPack(order.id, scanned)
    setBusy(false)
    if (!r.ok) return say({ type: 'bad', text: r.error })
    setDone(order); setOrder(null); setScanned({}); setMsg(r.message ? { type: 'warn', text: r.message, id: Date.now() } : null); beep(true)
  }

  async function park() {
    if (!order) return
    await parkPack(order.id)
    setOrder(null); setScanned({})
    say({ type: 'warn', text: 'ยกเลิกการแพ็กแล้ว', sub: 'ออเดอร์กลับไปอยู่ในคิว ยอดจองยังอยู่' })
    focus()
  }

  async function bind() {
    if (!msg?.bindCode || !bindOrder.trim()) return
    setBusy(true)
    const r = await bindLabelCode(msg.bindCode, bindOrder)
    setBusy(false)
    if (!r.ok) return say({ type: 'bad', text: r.error, bindCode: msg.bindCode })
    const code = msg.bindCode
    setBindOrder('')
    await openLabel(code)
  }

  function handle(raw: string) {
    const code = raw.trim()
    if (busy) return
    if (!code) { if (phase === 3) void confirm(); return }
    if (order) scanItem(code)
    else void openLabel(code)
  }

  const sub = phase === 2 ? `${got}/${total} ชิ้น` : phase === 3 ? 'ตรวจแล้วกดยืนยัน' : ''
  return (
    <div className="sect">
      <section className="station" aria-label="สถานีแพ็ก">
        <div className="station-h"><h2>สถานีแพ็ก</h2><span className="live"><i />{order ? 'กำลังแพ็ก' : 'พร้อมสแกน'}</span></div>

        <ol className="stepper" aria-label="ขั้นตอนการแพ็ก">
          {STEPS.map(([l, s], i) => {
            const n = i + 1
            const st = n < phase || phase === 4 ? 's-done' : n === phase ? 's-now' : 's-todo'
            const just = stepJustChanged && ((st === 's-done' && n >= stepFrom && n < phase) || st === 's-now' || (phase === 4 && n >= stepFrom))
            return (
              <li key={l} className={`step ${st} ${just ? 'just' : ''}`} aria-current={n === phase && phase < 4 ? 'step' : undefined}>
                <span className="dotc">{st === 's-done' ? <IconCheck size={15} /> : n}</span>
                <span className="lb">{l}</span>
                <span className="sb">{n === phase && sub ? sub : s}</span>
                {n < 4 && <i className="ln"><b /></i>}
              </li>
            )
          })}
        </ol>

        {order && phase === 2 && (
          <div className="ordhead">
            <PlatformMark p={order.platform} />
            <div className="main">
              <div className="id">{order.external_order_id}</div>
              <div className="xs muted">{order.recipient_name ?? order.buyer_name ?? '—'} · พัสดุ <span className="mono">{order.tracking_number ?? '—'}</span></div>
            </div>
            <button className="link quiet" type="button" onClick={park}>ยกเลิก</button>
          </div>
        )}

        {phase !== 3 && <div className="scanbox">
          <IconScan />
          <button type="button" className="cambtn" onClick={() => { input.current?.blur(); setCamCode(null); setMsg(null); setCamOpen(true) }} aria-label="สแกนด้วยกล้องมือถือ" title="สแกนด้วยกล้องมือถือ">
            <IconCamera /><span>กล้อง</span>
          </button>
          <input ref={input} className="scaninput" autoComplete="off" spellCheck={false} aria-label="ช่องสแกน" disabled={busy}
            placeholder={phase === 1 ? 'สแกนบาร์โค้ดใบปะหน้า…' : phase === 2 ? 'สแกน Data Matrix สินค้าทีละชิ้น…' : 'สแกนใบปะหน้าถัดไป…'}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = e.currentTarget.value; e.currentTarget.value = ''; handle(v) } }}
            onBlur={() => { if (!busy) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) focus() }, 50) }} />
        </div>}

        {msg && (
          <div className={`banner ${msg.type}`} role="alert" key={msg.id}>
            <div>{msg.text}{msg.sub && <small>{msg.sub}</small>}</div>
            {msg.bindCode && (
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" style={{ background: 'var(--card)', maxWidth: 200 }} placeholder="เลขออเดอร์" value={bindOrder}
                  onChange={(e) => setBindOrder(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void bind() } }} aria-label="เลขออเดอร์ที่จะผูกกับรหัสนี้" />
                <button className="btn" type="button" onClick={bind} disabled={busy}>ผูก</button>
              </div>
            )}
            <button type="button" className="banner-x" aria-label="ปิดข้อความ" onClick={() => { setMsg(null); setBindOrder(''); focus() }}><IconX size={14} /></button>
          </div>
        )}

        {order && phase === 3 ? (
          <div className="summary">
            <div className="sum-ok"><IconCheck /> ตรวจสินค้าครบแล้ว ตรวจข้อมูลแล้วกดยืนยัน</div>
            <div className="group kvg">
              <div className="rowi noicon"><span className="k">ผู้รับ</span><span className="v"><b>{order.recipient_name ?? order.buyer_name ?? '—'}</b></span></div>
              <div className="rowi noicon"><span className="k">ช่องทาง</span><span className="v"><span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><PlatformMark p={order.platform} />{PLATFORM[order.platform]}</span></span></div>
              <div className="rowi noicon"><span className="k">เลขออเดอร์</span><span className="v mono">{order.external_order_id}</span></div>
              <div className="rowi noicon"><span className="k">เลขพัสดุ</span><span className="v mono">{order.tracking_number ?? '—'}</span></div>
              {order.total_amount != null && <div className="rowi noicon"><span className="k">ยอด</span><span className="v">{baht(order.total_amount)}</span></div>}
            </div>
            <div className="group">
              {lines.map((l) => (
                <div className="rowi" key={l.productId}>
                  <span className="ic" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}><IconCheck /></span>
                  <div className="main"><div className="t1">{l.name}</div><div className="t2 mono">{l.sku}</div></div>
                  <b className="num">×{l.need}</b>
                </div>
              ))}
              <div className="rowi noicon"><div className="main"><b>รวม</b></div><b className="num">{total} ชิ้น</b></div>
            </div>
            <button ref={confirmBtn} className="btn ink xl" type="button" onClick={confirm} disabled={busy}>
              {busy ? 'กำลังบันทึก…' : <><IconCheck /> ยืนยันแพ็ก · ตัดสต็อก</>}
            </button>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="link quiet" type="button" onClick={() => { setScanned({}); setMsg(null) }}>สแกนสินค้าใหม่</button>
              <button className="link quiet" type="button" onClick={park}>ยกเลิกออเดอร์นี้</button>
            </div>
          </div>
        ) : order ? (
          <>
            <div>
              <div className="barrow"><span>{complete ? 'ครบทุกชิ้นแล้ว' : `สแกนแล้ว ${got} จาก ${total} ชิ้น`}</span><span className="num">{pct}%</span></div>
              <div className="bar"><i key={pct} style={{ ['--from' as string]: `${from}%`, ['--to' as string]: `${pct}%` }} /></div>
            </div>
            <div className="picks">
              {lines.map((l) => {
                const n = scanned[l.productId] ?? 0
                return (
                  <div key={l.productId + (hit === l.productId ? n : '')} className={`pick ${n === l.need ? 'done' : ''} ${hit === l.productId ? 'hit' : ''}`}>
                    <Ring n={n} q={l.need} />
                    <div className="main"><div className="t1">{l.name}</div><div className="xs muted mono">{l.sku}</div></div>
                    <div className="cnt">{n}<span>/{l.need}</span></div>
                  </div>
                )
              })}
            </div>
            <button className="btn ink xl" type="button" onClick={confirm} disabled={!complete || busy}>
              {busy ? 'กำลังบันทึก…' : complete ? <><IconCheck /> ยืนยันแพ็ก</> : `เหลืออีก ${total - got} ชิ้น`}
            </button>
          </>
        ) : done ? (
          <div className="donebox">
            <span className="ok"><IconCheck /></span>
            <h3>แพ็กเสร็จ พร้อมส่ง</h3>
            <div className="mono small">{done.external_order_id}</div>
            <div className="xs muted">{total || done.order_items.reduce((a, i) => a + i.quantity, 0)} ชิ้น · ตัดสต็อกแล้ว · {PLATFORM[done.platform]} {done.tracking_number}</div>
            <Link className="link" href="/?handover=1" scroll={false}>ส่งขนส่ง →</Link>
          </div>
        ) : (
          <div className="hint"><span>ระบบตัดสต็อกตอนยืนยันแพ็กเท่านั้น</span>{nextOrderId && <span>ถัดไปในคิว <span className="mono">{nextOrderId}</span></span>}</div>
        )}
      </section>

      {camOpen && (phase === 1 || phase === 2 || phase === 4) && (
        <CameraScanner
          hint={phase === 2 ? `สแกนสินค้า · ${got}/${total} ชิ้น` : 'สแกนบาร์โค้ดใบปะหน้า'}
          lastResult={msg ? { text: msg.text, tone: msg.type } : camCode ? { text: `อ่านได้ ${camCode}`, tone: 'ok' } : null}
          onCode={(c) => { setCamCode(c); handle(c) }}
          onClose={() => setCamOpen(false)}
        />
      )}
      {demoCodes.length > 0 && (
        <details className="demo">
          <summary>ทดลองสแกน (ออเดอร์ตัวอย่าง)</summary>
          <div className="codes">
            {(order ? lines.map((l) => l.sku) : demoCodes).map((c) => (
              <button key={c} type="button" onClick={() => handle(c)}>{c}</button>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
