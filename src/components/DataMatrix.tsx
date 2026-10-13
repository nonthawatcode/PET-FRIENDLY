'use client'

import { useEffect, useState } from 'react'

/** Renders an ECC200 Data Matrix that encodes `text`, generated locally (no external service). */
export function useDataMatrix(text: string) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let live = true
    import('bwip-js/browser').then((m) => {
      if (live) setSvg(m.toSVG({ bcid: 'datamatrix', text, scale: 1 }))
    })
    return () => { live = false }
  }, [text])
  return svg
}

export function colorize(svg: string, fg: string) {
  return svg.replace('<path ', `<path fill="${fg}" `)
}

export function modulesOf(svg: string) {
  const m = svg.match(/viewBox="0 0 (\d+)/)
  return m ? Math.round(Number(m[1]) / 2) : null
}

export function DataMatrixMini({ text, fg, bg, size = 52 }: { text: string; fg: string; bg: string; size?: number }) {
  const svg = useDataMatrix(text)
  return (
    <div className="mini-dm" style={{ background: bg, width: size, height: size, padding: Math.round(size / 7) }}
      aria-label={`Data Matrix ${text}`} dangerouslySetInnerHTML={{ __html: svg ? colorize(svg, fg) : '' }} />
  )
}
