'use client'

import { useState, useTransition } from 'react'
import { saveDmColors } from '@/app/actions'
import { colorize, modulesOf, useDataMatrix } from './DataMatrix'

const PRESETS = [
  { n: 'มาตรฐาน', fg: '#000000', bg: '#FFFFFF' },
  { n: 'กลับสี', fg: '#FFFFFF', bg: '#14283A' },
  { n: 'เหลืองบนกรมท่า', fg: '#F2E865', bg: '#14283A' },
  { n: 'เหลืองบนฟ้า', fg: '#F2E865', bg: '#5BC0E8' },
]
// Print size: 0.5 mm per module, plus a 1-module quiet zone in the background colour.
const MODULE_MM = 0.5

function lum(hex: string) {
  const c = hex.replace('#', '').match(/../g)!.map((h) => {
    const v = parseInt(h, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

function printableSvg(svg: string, fg: string, bg: string) {
  const w = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0)
  const n = w / 2
  const mm = (n + 2) * MODULE_MM
  const d = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? ''
  // A strict XML file (each attribute once) so design and print software can open it.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-2 -2 ${w + 4} ${w + 4}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges">\n<rect x="-2" y="-2" width="${w + 4}" height="${w + 4}" fill="${bg}"/>\n<path d="${d}" fill="${fg}" fill-rule="evenodd"/>\n</svg>\n`
}

function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function DmEditor({ productId, sku, fg: fg0, bg: bg0 }: { productId: string; sku: string; fg: string; bg: string }) {
  const svg = useDataMatrix(sku)
  const [fg, setFg] = useState(fg0)
  const [bg, setBg] = useState(bg0)
  const [saved, setSaved] = useState({ fg: fg0, bg: bg0 })
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const n = modulesOf(svg)
  const r = ratio(fg, bg)
  const lvl = r >= 7 ? ['var(--ok)', 'คอนทราสต์ดี'] : r >= 4 ? ['var(--warn)', 'พอใช้ ต้องทดสอบงานพิมพ์'] : ['var(--bad)', 'คอนทราสต์ต่ำ อาจสแกนไม่ติด']
  const inverse = lum(fg) > lum(bg)
  const dirty = fg !== saved.fg || bg !== saved.bg

  const save = () => start(async () => {
    const res = await saveDmColors(productId, fg, bg)
    if (res.ok) { setSaved({ fg, bg }); setErr('') } else setErr(res.error)
  })
  const dlSvg = () => download(`${sku}-datamatrix.svg`, new Blob([printableSvg(svg, fg, bg)], { type: 'image/svg+xml' }))
  const dlPng = () => {
    const src = printableSvg(svg, fg, bg)
    const img = new Image()
    const px = ((n ?? 14) + 2) * 24
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = px
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, px, px)
      c.toBlob((b) => b && download(`${sku}-datamatrix.png`, b), 'image/png')
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src.replace(/width="[^"]+mm" height="[^"]+mm"/, `width="${px}" height="${px}"`))
  }

  return (
    <>
      <div className="dmwrap">
        <div className="dmtop">
          <div className="dm-tile" style={{ background: bg }} dangerouslySetInnerHTML={{ __html: svg ? colorize(svg, fg) : '' }} />
          <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <div className="presets">
              {PRESETS.map((p) => (
                <button key={p.n} type="button" className="preset" aria-pressed={p.fg === fg && p.bg === bg} onClick={() => { setFg(p.fg); setBg(p.bg) }}>
                  <span className="sw" style={{ background: p.bg }}><i style={{ background: p.fg }} /></span>{p.n}
                </button>
              ))}
            </div>
            <div className="colors">
              <div className="field"><label htmlFor="dmfg">สีโค้ด</label><input id="dmfg" type="color" className="input" value={fg.toLowerCase()} onChange={(e) => setFg(e.target.value.toUpperCase())} /></div>
              <div className="field"><label htmlFor="dmbg">สีพื้น</label><input id="dmbg" type="color" className="input" value={bg.toLowerCase()} onChange={(e) => setBg(e.target.value.toUpperCase())} /></div>
            </div>
            <div className="contrast" style={{ color: lvl[0] }}><i />{lvl[1]} ({r.toFixed(1)} : 1)</div>
          </div>
        </div>
        {dirty && <button className="btn pri" type="button" onClick={save} disabled={pending}>{pending ? 'กำลังบันทึก…' : 'บันทึกสีนี้'}</button>}
        {err && <p className="ferr">{err}</p>}
      </div>
      <div className="group kvg">
        <div className="rowi noicon"><span className="k">ข้อมูลในโค้ด</span><span className="v mono">{sku}</span></div>
        <div className="rowi noicon"><span className="k">ขนาดไฟล์</span><span className="v small">{n ? `${n}×${n} โมดูล · ${((n + 2) * MODULE_MM).toFixed(1)} มม. รวมขอบ` : '—'}</span></div>
        {inverse && <div className="rowi noicon"><span className="k">กลับสี</span><span className="v small">เปิดโหมด Inverse/Auto ที่เครื่องสแกน</span></div>}
      </div>
      <div className="dlrow">
        <button className="btn" type="button" onClick={dlSvg} disabled={!svg}>ดาวน์โหลด SVG (โรงพิมพ์)</button>
        <button className="btn" type="button" onClick={dlPng} disabled={!svg}>PNG</button>
      </div>
      <p className="xs muted" style={{ margin: 0 }}>ECC200 สร้างในระบบเอง ไม่มีวันหมดอายุ ทดสอบสแกนกับปรู๊ฟจริงก่อนสั่งพิมพ์ทุกครั้ง</p>
    </>
  )
}
