'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconOrders, IconPack, IconStock } from './icons'

const ITEMS = [
  { href: '/', label: 'แพ็ก', icon: <IconPack /> },
  { href: '/orders', label: 'ออเดอร์', icon: <IconOrders /> },
  { href: '/stock', label: 'สต็อก', icon: <IconStock /> },
  { href: '/account', label: 'บัญชี', icon: null },
] as const

export function Dock({ pending, low, initials }: { pending: number; low: number; initials: string }) {
  const path = usePathname()
  const active = ITEMS.findIndex((i) => (i.href === '/' ? path === '/' : path.startsWith(i.href)))
  const dock = useRef<HTMLElement>(null)
  const ind = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  const [pop, setPop] = useState(-1)
  const prev = useRef(active)

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
  useEffect(() => {
    if (prev.current !== active) { setPop(active); prev.current = active }
  }, [active])

  const badge = [0, pending, low, 0]
  return (
    <nav ref={dock} className={`dock ${ready ? '' : 'noanim'}`} aria-label="เมนูหลัก">
      <span ref={ind} className="ind" aria-hidden="true" />
      {ITEMS.map((it, i) => (
        <Link key={it.href} href={it.href} aria-current={i === active ? 'page' : undefined} aria-label={it.label}
          className={pop === i ? 'pop' : undefined} onAnimationEnd={() => setPop(-1)}>
          {it.icon ?? <span className="av">{initials}</span>}
          {badge[i] > 0 && <span key={badge[i]} className="bdg bump">{badge[i]}</span>}
          <span className="lbl">{it.label}</span>
        </Link>
      ))}
    </nav>
  )
}
