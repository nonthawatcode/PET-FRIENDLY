'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { IconX } from './icons'

export function SheetFrame({
  closeHref, head, children, foot,
}: { closeHref: string; head: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(closeHref, { scroll: false }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeHref, router])
  return (
    <>
      <Link className="scrim" href={closeHref} scroll={false} aria-label="ปิด" />
      <aside className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <div className="sheet-h">
          {head}
          <Link className="xbtn" href={closeHref} scroll={false} aria-label="ปิด"><IconX /></Link>
        </div>
        <div className="sheet-b">{children}</div>
        {foot && <div className="sheet-f">{foot}</div>}
      </aside>
    </>
  )
}
