'use client'

import { useRef, useState } from 'react'
import { setPackagingImage, setProductImage } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { IconCamera } from './icons'

/** Shrinks a photo to max 800px JPEG so it uploads quickly and loads fast on the stock page. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 800 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85))
}

/** Photo for a product, or for a packaging item when `packaging` is set. */
export function ProductImageUpload({ productId, url, packaging = false }: { productId: string; url: string | null; packaging?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true); setMsg(null)
    try {
      const blob = await shrink(file)
      const sb = createClient()
      const path = `${packaging ? 'packaging' : 'products'}/${productId}-${Date.now()}.jpg`
      const { error } = await sb.storage.from('brand').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
      const r = await (packaging ? setPackagingImage : setProductImage)(productId, sb.storage.from('brand').getPublicUrl(path).data.publicUrl)
      if (!r.ok) throw new Error(r.error)
      setMsg({ ok: true, text: r.message ?? 'บันทึกรูปแล้ว' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error && /[฀-๿]/.test(e.message) ? e.message : 'บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง' })
    } finally { setBusy(false) }
  }

  return (
    <div className="formcard">
      <h3>{packaging ? 'รูป' : 'รูปสินค้า'}</h3>
      <div className="row" style={{ gap: 14 }}>
        <div className="pimg lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="รูปสินค้า" /> : <IconCamera size={22} />}
        </div>
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'กำลังอัปโหลด…' : url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
      {msg && <p className={msg.ok ? 'small muted' : 'ferr'} role={msg.ok ? 'status' : 'alert'} style={{ margin: 0 }}>{msg.text}</p>}
    </div>
  )
}
