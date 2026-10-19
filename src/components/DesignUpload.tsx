'use client'

import { useRef, useState } from 'react'
import { addDesignFile } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'

const MAX = 50 * 1024 * 1024 // Supabase free plan: 50 MB per file

/** Upload one or more design files to the private "design" bucket. */
export function DesignUpload() {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setMsg(null)
    const sb = createClient()
    let done = 0
    const failed: string[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX) { failed.push(`${f.name} (ใหญ่เกิน 50 MB)`); continue }
      setBusy(`กำลังอัปโหลด ${done + 1}/${files.length} · ${f.name}`)
      const ext = (f.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? 'bin').toLowerCase()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('design').upload(path, f, { contentType: f.type || 'application/octet-stream' })
      if (error) { failed.push(f.name); continue }
      const r = await addDesignFile({ name: f.name, path, size: f.size, mime: f.type || 'application/octet-stream' })
      if (!r.ok) { failed.push(f.name); continue }
      done++
    }
    setBusy('')
    setMsg(failed.length ? { ok: false, text: `อัปโหลดไม่สำเร็จ: ${failed.join(', ')}` } : { ok: true, text: `อัปโหลดแล้ว ${done} ไฟล์` })
  }

  return (
    <div className="formcard">
      <button type="button" className="btn pri xl" disabled={!!busy} onClick={() => ref.current?.click()}>{busy || '+ อัปโหลดไฟล์ดีไซน์'}</button>
      <input ref={ref} type="file" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
      <p className="xs muted" style={{ margin: 0 }}>ไฟล์อะไรก็ได้ (AI, PSD, PDF, PNG, SVG…) ไฟล์ละไม่เกิน 50 MB · เลือกหลายไฟล์พร้อมกันได้</p>
      {msg && <p className={msg.ok ? 'fok' : 'ferr'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  )
}
