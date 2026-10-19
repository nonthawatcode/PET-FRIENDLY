'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconOrders, IconPack, IconStock, IconWarehouse } from './icons'

const ITEMS = [
  { href: '/', label: 'แพ็ก', icon: <IconPack /> },
  { href: '/orders', label: 'ออเดอร์', icon: <IconOrders /> },
  { href: '/stock', label: 'สต็อก', icon: <IconStock /> },
  { href: '/warehouse', label: 'โกดัง', icon: <IconWarehouse /> },
  { href: '/account', label: 'บัญชี', icon: null },
] as const

const indexOf = (path: string) => ITEMS.findIndex((i) => (i.href === '/' ? path === '/' : path.startsWith(i.href)))

export function Dock({ pending, low, initials }: { pending: number; low: number; initials: string }) {
  const path = usePathname()
  const routeIndex = indexOf(path)
  // Move the highlight the moment a tab is tapped, not when the next page finishes loading.
  const [tapped, setTapped] = useState<number | null>(null)
  const active = tapped ?? routeIndex
  const dock = useRef<HTMLElement>(null)
  const ind = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  const [pop, setPop] = useState(-1)

  useEffect(() => { setTapped(null) }, [path])

  const place = () => {
    const btn = dock.current?.querySelectorAll<HTMLAnchorElement>('a')[active]
    if (!btn || !ind.current) return
    ind.current.style.width = btn.offsetWidth + 'px'
    ind.current.style.transform = `translateX(${btn.offsetLeft}px)`
  }

  useLayoutEffect(place)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    const onResize = () => { dock.current?.classList.add('noanim'); place(); requestAnimationFrame(() => dock.current?.classList.remove('noanim')) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize) }
  })

  // iPhone: hide the dock while the keyboard is up (it covers the fields), and after the keyboard
  // closes make Safari re-place the dock, which it sometimes leaves floating mid-screen.
  useEffect(() => {
    // Computers have no on-screen keyboard (and the pack page keeps the scan box focused there).
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.matches('textarea,select,[contenteditable="true"]') ||
        (t instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'button', 'submit', 'range', 'color'].includes(t.type)))
    let timer = 0
    const resync = () => {
      const el = dock.current
      if (!el) return
      el.style.position = 'absolute'
      void el.offsetHeight
      el.style.position = ''
      window.scrollTo(window.scrollX, window.scrollY)
    }
    const onIn = (e: FocusEvent) => { if (isField(e.target)) { clearTimeout(timer); dock.current?.classList.add('typing') } }
    const onOut = (e: FocusEvent) => {
      if (!isField(e.target)) return
      clearTimeout(timer)
      timer = window.setTimeout(() => { if (!isField(document.activeElement)) { dock.current?.classList.remove('typing'); resync() } }, 250)
    }
    const vv = window.visualViewport
    const onVv = () => { if (!isField(document.activeElement)) resync() }
    // Also re-place it each time scrolling stops, in case Safari drifted it while scrolling.
    let scrollTimer = 0
    const onScroll = () => { clearTimeout(scrollTimer); scrollTimer = window.setTimeout(onVv, 200) }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    vv?.addEventListener('resize', onVv)
    return () => {
      clearTimeout(timer); clearTimeout(scrollTimer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      vv?.removeEventListener('resize', onVv)
    }
  }, [])

  const badge = [0, pending, low, 0, 0]
  return (
    <nav ref={dock} className={`dock ${ready ? '' : 'noanim'}`} aria-label="เมนูหลัก">
      <span ref={ind} className="ind" aria-hidden="true" />
      {ITEMS.map((it, i) => (
        <Link key={it.href} href={it.href} aria-current={i === active ? 'page' : undefined} aria-label={it.label}
          className={pop === i ? 'pop' : undefined} onAnimationEnd={() => setPop(-1)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
            if (i !== active) { setTapped(i); setPop(i) }
          }}>
          {it.icon ?? <span className="av">{initials}</span>}
          {badge[i] > 0 && <span key={badge[i]} className="bdg bump">{badge[i]}</span>}
          <span className="lbl">{it.label}</span>
        </Link>
      ))}
    </nav>
  )
}
