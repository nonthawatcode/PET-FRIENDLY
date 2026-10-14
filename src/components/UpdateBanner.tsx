'use client'

import { useEffect, useState } from 'react'

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID

/** Checks for a newer deploy every minute and when the tab regains focus. */
export function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false)
  useEffect(() => {
    let stop = false
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        const { build } = await r.json()
        if (!stop && build && CURRENT && build !== CURRENT) setHasUpdate(true)
      } catch {}
    }
    const t = setInterval(check, 60_000)
    const onFocus = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onFocus)
    check()
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onFocus) }
  }, [])
  if (!hasUpdate) return null
  return (
    <div className="update" role="status">
      มีเวอร์ชันใหม่
      <button type="button" onClick={() => window.location.reload()}>อัปเดต</button>
    </div>
  )
}
