'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { handOver } from '@/app/actions'
import { COURIERS, when } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { PlatformMark, itemSummary } from './bits'
import { IconCamera, IconCheck, IconX } from './icons'

type Photo = { file: Blob; url: string }

/** Shrinks a phone photo to max 1600px JPEG so uploads stay quick on mobile data. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.8))
}

export function HandoverSheet({ orders, preselect, onDoneHref }: { orders: Order[]; preselect?: string; onDoneHref: string }) {
  const router = useRouter()
  const [courier, setCourier] = useState('')
  const [other, setOther] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set(preselect ? [preselect] : []))
  const [photos, setPhotos] = useState<Photo[]>([])
  const [noPhoto, setNoPhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const name = courier === 'อื่น ๆ' ? other.trim() : courier
  const ready = !!name && picked.size > 0 && (photos.length > 0 || noPhoto) && !busy
  const allOn = orders.length > 0 && orders.every((o) => picked.has(o.id))

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const added: Photo[] = []
    for (const f of Array.from(files).slice(0, 6 - photos.length)) {
      try { const b = await shrink(f); added.push({ file: b, url: URL.createObjectURL(b) }) } catch { setErr('อ่านรูปไม่ได้ ลองถ่ายใหม่') }
    }
    setPhotos((p) => [...p, ...added])
  }

  async function submit() {
    if (!ready) return
    setBusy(true); setErr('')
    try {
      const sb = createClient()
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
      const paths: string[] = []
      for (const p of noPhoto ? [] : photos) {
        const path = `${day}/${crypto.randomUUID()}.jpg`
        const { error } = await sb.storage.from('handover').upload(path, p.file, { contentType: 'image/jpeg' })
        if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
        paths.push(path)
      }
      const r = await handOver([...picked], name, paths)
      if (!r.ok) throw new Error(r.error)
      setDone(r.message ?? 'ส่งแล้ว')
      setTimeout(() => router.push(onDoneHref, { scroll: false }), 1200)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="donebox" style={{ padding: '30px 0' }}>
        <span className="ok"><IconCheck /></span>
        <h3>{done}</h3>
      </div>
    )
  }

  return (
    <>
      <div className="sect">
        <span className="cap">1. ขนส่ง</span>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {[...COURIERS, 'อื่น ๆ'].map((c) => (
            <button key={c} type="button" className="fchip" aria-pressed={courier === c} onClick={() => setCourier(c)}>{c}</button>
          ))}
        </div>
        {courier === 'อื่น ๆ' && <input className="input" placeholder="ชื่อขนส่ง" value={other} onChange={(e) => setOther(e.target.value)} aria-label="ชื่อขนส่ง" />}
      </div>

      <div className="sect">
        <div className="sect-h" style={{ padding: '0 6px' }}>
          <span className="cap" style={{ padding: 0 }}>2. กล่องที่ส่งรอบนี้ ({picked.size}/{orders.length})</span>
          {orders.length > 0 && <button type="button" className="link" onClick={() => setPicked(allOn ? new Set() : new Set(orders.map((o) => o.id)))}>{allOn ? 'ไม่เลือกเลย' : 'เลือกทั้งหมด'}</button>}
        </div>
        <div className="group">
          {orders.map((o) => (
            <label key={o.id} className="rowi tap" style={{ cursor: 'pointer' }}>
              <input type="checkbox" className="hcheck" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
              <PlatformMark p={o.platform} />
              <div className="main">
                <div className="t1"><span className="mono">{o.external_order_id}</span></div>
                <div className="t2">{o.recipient_name ?? o.buyer_name ?? '—'} · {itemSummary(o)} · แพ็ก {o.packed_at ? when(o.packed_at) : ''}</div>
              </div>
            </label>
          ))}
          {!orders.length && <div className="empty-state">ไม่มีกล่องรอส่ง</div>}
        </div>
      </div>

      <div className="sect">
        <span className="cap">3. ถ่ายรูปพัสดุ</span>
        {!noPhoto && <div className="photos">
          {photos.map((p, i) => (
            <div className="photo" key={p.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`รูปพัสดุ ${i + 1}`} />
              <button type="button" aria-label="ลบรูป" onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}><IconX size={12} /></button>
            </div>
          ))}
          {photos.length < 6 && (
            <button type="button" className="photo add" onClick={() => fileRef.current?.click()}>
              <IconCamera size={22} /><span>ถ่ายรูป</span>
            </button>
          )}
        </div>}
        <button type="button" className="fchip" aria-pressed={noPhoto} onClick={() => setNoPhoto((v) => !v)} style={{ justifySelf: 'start' }}>
          {noPhoto ? <><IconCheck size={14} /> ไม่มีรูป</> : 'ไม่มีรูป'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />
      </div>

      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="button" className="btn ink xl" disabled={!ready} onClick={submit}>
        {busy ? 'กำลังบันทึก…' : !name ? 'เลือกขนส่งก่อน' : !picked.size ? 'เลือกกล่องที่จะส่ง' : !photos.length && !noPhoto ? 'ถ่ายรูปพัสดุ หรือกด “ไม่มีรูป”' : <><IconCheck /> ยืนยันส่งให้ {name} · {picked.size} กล่อง</>}
      </button>
      <p className="xs muted" style={{ margin: 0, textAlign: 'center' }}>ระบบบันทึกเวลาและชื่อผู้ส่งให้อัตโนมัติ</p>
    </>
  )
}
