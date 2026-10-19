'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { IconSearch } from './icons'

export function OrderFilterBar({ q, platform, range, autoFocus }: { q: string; platform: string; range: string; autoFocus?: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [term, setTerm] = useState(q)
  const ref = useRef<HTMLInputElement>(null)

  const push = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    p.delete('order'); p.delete('focus')
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    router.replace(`${path}${p.toString() ? '?' + p : ''}`, { scroll: false })
  }

  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  useEffect(() => {
    if (term === q) return
    const t = setTimeout(() => push({ q: term }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  return (
    <div className="sect" style={{ gap: 10 }}>
      <div className="searchbar">
        <IconSearch />
        <input ref={ref} className="input" placeholder="ค้นหาเลขออเดอร์ เลขพัสดุ หรือชื่อ (สแกนใบปะหน้าได้)" value={term}
          onChange={(e) => setTerm(e.target.value)} aria-label="ค้นหาออเดอร์" />
      </div>
      <div className="row">
        <select className="selchip" aria-label="ช่องทาง" value={platform} onChange={(e) => push({ platform: e.target.value === 'all' ? '' : e.target.value })}>
          <option value="all">ทุกช่องทาง</option><option value="shopee">Shopee</option><option value="lazada">Lazada</option><option value="tiktok">TikTok Shop</option><option value="line">LINE SHOPPING</option>
        </select>
        <select className="selchip" aria-label="ช่วงวันที่" value={range} onChange={(e) => push({ range: e.target.value === '7' ? '' : e.target.value })}>
          <option value="today">วันนี้</option><option value="7">7 วัน</option><option value="30">30 วัน</option><option value="all">ทั้งหมด</option>
        </select>
      </div>
    </div>
  )
}
