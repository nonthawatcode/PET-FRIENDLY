'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { markNotificationsSeen } from '@/app/actions'
import { when } from '@/lib/format'
import type { Notice } from '@/lib/types'
import { IconBell, IconOrders, IconPack, IconStock, IconLock, IconX } from './icons'

const ICON: Record<string, React.ReactNode> = { new_order: <IconOrders size={18} />, low_stock: <IconStock size={18} />, handover_overdue: <IconPack size={18} />, storage_full: <IconLock size={18} /> }

export function NotificationBell({ items, unread }: { items: Notice[]; unread: number }) {
  const [open, setOpen] = useState(false)
  const [seenNow, setSeenNow] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const count = seenNow ? 0 : unread

  useEffect(() => { setSeenNow(false) }, [unread])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) { setSeenNow(true); void markNotificationsSeen() }
  }

  return (
    <div className="bellwrap" ref={box}>
      <button type="button" className="cbtn" aria-label={`แจ้งเตือน${count ? ` ${count} รายการใหม่` : ''}`} aria-expanded={open} onClick={toggle}>
        <IconBell />{count > 0 && <span className="bellcount">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notepanel" role="dialog" aria-label="การแจ้งเตือน">
          <div className="np-h"><b>การแจ้งเตือน</b><button type="button" className="xbtn" onClick={() => setOpen(false)} aria-label="ปิด"><IconX /></button></div>
          <div className="np-b">
            {items.length ? items.map((n) => (
              <Link key={n.id} href={n.url} className={`np-item ${!seenNow && items.indexOf(n) < unread ? 'new' : ''}`} onClick={() => setOpen(false)} scroll={false}>
                <span className={`np-ic k-${n.kind}`} aria-hidden="true">{ICON[n.kind] ?? <IconBell size={18} />}</span>
                <span className="main"><span className="t1">{n.title}</span><span className="t2">{n.body}</span><span className="xs muted">{when(n.created_at)}</span></span>
              </Link>
            )) : <div className="empty-state">ยังไม่มีการแจ้งเตือน</div>}
          </div>
          <Link href="/account#notify" className="np-f" onClick={() => setOpen(false)}>ตั้งค่าแจ้งเตือนบนมือถือ</Link>
        </div>
      )}
    </div>
  )
}
