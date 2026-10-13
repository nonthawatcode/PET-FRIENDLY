'use client'

import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    try { setTheme((localStorage.getItem('theme') as Theme) || 'system') } catch {}
  }, [])
  const pick = (t: Theme) => {
    setTheme(t)
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
    try { if (t === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', t) } catch {}
  }
  return (
    <div className="seg seg-theme" role="tablist">
      {([['system', 'ตามระบบ'], ['light', 'สว่าง'], ['dark', 'มืด']] as const).map(([k, l]) => (
        <button key={k} role="tab" aria-selected={theme === k} onClick={() => pick(k)} type="button">{l}</button>
      ))}
    </div>
  )
}
