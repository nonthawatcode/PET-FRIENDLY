'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { IconX } from './icons'

const CLOSE_AT = 110 // px dragged down before the sheet closes on release

// Keep the page behind an open sheet from scrolling (iPhone ignores overflow:hidden alone,
// so pin the body in place and put the scroll position back when the sheet closes).
let locks = 0
let savedY = 0
function lockPage() {
  if (locks++ > 0) return
  savedY = window.scrollY
  const b = document.body.style
  b.position = 'fixed'; b.top = `-${savedY}px`; b.left = '0'; b.right = '0'; b.width = '100%'
}
function unlockPage() {
  if (--locks > 0) return
  const b = document.body.style
  b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = ''
  window.scrollTo(0, savedY)
}

export function SheetFrame({
  closeHref, head, children, foot,
}: { closeHref: string; head: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  const router = useRouter()
  const sheet = useRef<HTMLElement>(null)
  const scrim = useRef<HTMLAnchorElement>(null)

  useEffect(() => { lockPage(); return unlockPage }, [])

  useEffect(() => {
    // Esc also means "stop loading" to the browser, which can cancel the navigation we start,
    // so block that and navigate right after the key event.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setTimeout(() => router.push(closeHref, { scroll: false }), 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeHref, router])

  // Swipe down to close (phones): only from the top edge of the sheet (handle and header).
  useEffect(() => {
    const el = sheet.current
    if (!el) return
    let startY = 0, startT = 0, dy = 0, active = false

    const set = (y: number, anim: boolean) => {
      el.style.transition = anim ? 'transform .25s cubic-bezier(.2,.8,.2,1)' : 'none'
      el.style.transform = y ? `translateY(${y}px)` : ''
      if (scrim.current) {
        scrim.current.style.transition = anim ? 'opacity .25s' : 'none'
        scrim.current.style.opacity = String(Math.max(0, 1 - y / (el.offsetHeight || 1)))
      }
    }
    const isDesktop = () => window.matchMedia('(min-width: 900px)').matches

    const onStart = (e: TouchEvent) => {
      if (isDesktop() || e.touches.length !== 1) return
      const t = e.target as HTMLElement
      if (!t.closest('.grab-zone,.sheet-h') || t.closest('input,select,textarea,a,button')) return
      startY = e.touches[0].clientY; startT = Date.now(); dy = 0; active = true
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      dy = e.touches[0].clientY - startY
      if (dy <= 0) return
      e.preventDefault()
      set(dy, false)
    }
    const onEnd = () => {
      if (!active) return
      active = false
      const fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.6
      if (dy > CLOSE_AT || fast) {
        set(el.offsetHeight, true)
        setTimeout(() => router.push(closeHref, { scroll: false }), 180)
      } else {
        set(0, true)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [closeHref, router])

  return (
    <>
      <Link ref={scrim} className="scrim" href={closeHref} scroll={false} aria-label="ปิด" />
      <aside ref={sheet} className="sheet" role="dialog" aria-modal="true">
        <div className="grab-zone"><div className="grab" /></div>
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
