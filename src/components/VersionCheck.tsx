'use client'

import { useState } from 'react'

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID ?? ''

/** Shows which version is open and lets staff check for / load a newer one. */
export function VersionCheck() {
  const [state, setState] = useState<'idle' | 'checking' | 'latest' | 'new' | 'error'>('idle')
  const check = async () => {
    setState('checking')
    try {
      const r = await fetch('/api/version', { cache: 'no-store' })
      const { build } = await r.json()
      setState(build && build !== CURRENT ? 'new' : 'latest')
    } catch { setState('error') }
  }
  return (
    <div className="group">
      <div className="rowi noicon">
        <div className="main">
          <div className="t1">เวอร์ชัน <span className="mono">{CURRENT.slice(0, 7) || '—'}</span></div>
          <div className="t2">
            {state === 'latest' ? 'เป็นเวอร์ชันล่าสุดแล้ว' : state === 'new' ? 'มีเวอร์ชันใหม่' : state === 'error' ? 'ตรวจไม่ได้ ลองใหม่อีกครั้ง' : state === 'checking' ? 'กำลังตรวจ…' : 'กดตรวจเพื่อดูว่ามีเวอร์ชันใหม่ไหม'}
          </div>
        </div>
        {state === 'new'
          ? <button type="button" className="btn pri" onClick={() => window.location.reload()}>อัปเดต</button>
          : <button type="button" className="btn" onClick={check} disabled={state === 'checking'}>ตรวจหาอัปเดต</button>}
      </div>
    </div>
  )
}
