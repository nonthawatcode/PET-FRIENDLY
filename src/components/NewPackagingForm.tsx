'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { savePackaging } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { IconCamera, IconX } from './icons'

const KINDS = ['ขวด', 'ฝา', 'กล่อง', 'อื่น ๆ']

async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 800 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85))
}

/** "เพิ่ม Packaging" form with an optional photo. */
export function NewPackagingForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function pick(f: File | undefined) {
    if (!f) return
    try { const blob = await shrink(f); setPhoto({ blob, url: URL.createObjectURL(blob) }); setErr('') } catch { setErr('อ่านรูปไม่ได้ ลองรูปอื่น') }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const fd = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try {
      if (photo) {
        const sb = createClient()
        const path = `packaging/${crypto.randomUUID()}.jpg`
        const { error } = await sb.storage.from('brand').upload(path, photo.blob, { contentType: 'image/jpeg' })
        if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
        fd.set('image_url', sb.storage.from('brand').getPublicUrl(path).data.publicUrl)
      }
      const r = await savePackaging(null, fd)
      if (!r.ok) throw new Error(r.error)
      router.push('/warehouse', { scroll: false })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'บันทึกไม่สำเร็จ')
      setBusy(false)
    }
  }

  return (
    <form className="formcard" onSubmit={submit}>
      <div className="field"><label>รูป (ไม่ใส่ก็ได้)</label>
        <div className="row" style={{ gap: 12 }}>
          <div className="pimg lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo.url} alt="รูปที่เลือก" /> : <IconCamera size={22} />}
          </div>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>{photo ? 'เปลี่ยนรูป' : 'เลือกรูป / ถ่ายรูป'}</button>
          {photo && <button type="button" className="xbtn" aria-label="ลบรูป" onClick={() => setPhoto(null)}><IconX /></button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div className="field"><label htmlFor="pn">ชื่อ</label><input id="pn" name="name" className="input" required placeholder="เช่น ขวดแก้ว 50 ml" /></div>
      <div className="formrow">
        <div className="field"><label htmlFor="pk">ประเภท</label>
          <select id="pk" name="kind" className="input" defaultValue="ขวด">{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
        <div className="field"><label htmlFor="pp">ราคาต่อชิ้น (บาท)</label><input id="pp" name="unit_price" className="input" type="number" min={0} step="0.01" inputMode="decimal" /></div>
      </div>
      <div className="field"><label htmlFor="pq">จำนวนในคลังตอนนี้</label><input id="pq" name="qty" className="input" type="number" min={0} inputMode="numeric" defaultValue={0} /></div>
      <div className="field"><label htmlFor="pnote">หมายเหตุ</label><input id="pnote" name="note" className="input" placeholder="เช่น ผู้ขาย, สี, ขนาด" /></div>
      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="submit" className="btn pri" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'เพิ่ม'}</button>
    </form>
  )
}
