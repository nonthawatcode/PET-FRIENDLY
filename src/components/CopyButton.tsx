'use client'

import { useState } from 'react'
import { IconCheck, IconCopy } from './icons'

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const t = document.createElement('textarea')
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select()
    const ok = document.execCommand('copy'); t.remove(); return ok
  }
}

/** Small button that copies `text` (e.g. an order number). Works inside links too. */
export function CopyButton({ text, label = 'คัดลอกเลขออเดอร์' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className={`copybtn ${done ? 'done' : ''}`} aria-label={done ? 'คัดลอกแล้ว' : label} title={done ? 'คัดลอกแล้ว' : label}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation()
        if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1500) }
      }}>
      {done ? <IconCheck size={14} /> : <IconCopy size={14} />}
    </button>
  )
}
