'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/lib/types'
import { IconCheck, IconEdit, IconPlus, IconTrash, IconX } from './icons'

type Action = (state: ActionResult | null, fd: FormData) => Promise<ActionResult>
const form = (o: Record<string, string>) => { const fd = new FormData(); Object.entries(o).forEach(([k, v]) => fd.set(k, v)); return fd }

/**
 * Trash button that asks first: tap → "ลบ X?" with ยกเลิก / ลบ.
 * `fields` are sent to the action. `block` makes it a full-width red outline button.
 */
export function DeleteButton({ action, fields, label, block = false, text, question }: { action: Action; fields: Record<string, string>; label: string; block?: boolean; text?: string; question?: string }) {
  const [ask, setAsk] = useState(false)
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const run = () => start(async () => {
    const r = await action(null, form(fields))
    if (r && !r.ok) { setErr(r.error); setAsk(false) }
  })
  if (ask) {
    return (
      <span className={`confirm ${block ? 'block' : ''}`} role="alertdialog" aria-label={`ยืนยันลบ ${label}`}>
        <span className="q">{question ?? (block ? `ลบ “${label}”?` : 'ลบ?')}</span>
        <button type="button" className="btn sm" onClick={() => setAsk(false)} disabled={pending}>ยกเลิก</button>
        <button type="button" className="btn sm danger" onClick={run} disabled={pending}>{pending ? 'กำลังลบ…' : 'ลบ'}</button>
      </span>
    )
  }
  return (
    <>
      {text
        ? <button type="button" className="link bad" onClick={() => { setErr(''); setAsk(true) }}>{text}</button>
        : block
        ? <button type="button" className="btn danger-line" onClick={() => { setErr(''); setAsk(true) }}><IconTrash size={16} /> ลบ{label ? ` ${label}` : ''}</button>
        : <button type="button" className="iconbtn danger" aria-label={`ลบ ${label}`} title="ลบ" onClick={() => { setErr(''); setAsk(true) }}><IconTrash /></button>}
      {err && <span className="ferr" role="alert" style={{ margin: 0 }}>{err}</span>}
    </>
  )
}

/**
 * A tidy list of names: each row has ✎ (rename inline) and 🗑 (delete, asks first),
 * and the last row adds a new one.
 */
export function EditableList({ items, add, rename, remove, field, addLabel, placeholder, empty }: {
  items: { key: string; name: string; sub?: string }[]
  add: Action; rename: Action; remove: Action
  field: { id: string; old?: string }   // form field names the actions expect
  addLabel: string; placeholder?: string; empty?: string
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()

  const save = (key: string | null) => start(async () => {
    const name = value.trim()
    if (!name) return
    const r = key === '__new'
      ? await add(null, form({ name }))
      : await rename(null, form({ name, [field.id]: key!, ...(field.old ? { [field.old]: key! } : {}) }))
    if (r.ok) { setEditing(null); setValue(''); setErr('') } else setErr(r.error)
  })

  const editor = (key: string) => (
    <form className="rowi editrow" onSubmit={(e) => { e.preventDefault(); save(key) }}>
      <input className="input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label="ชื่อ" />
      <button type="button" className="iconbtn" aria-label="ยกเลิก" onClick={() => { setEditing(null); setErr('') }}><IconX /></button>
      <button type="submit" className="iconbtn ok" aria-label="บันทึก" disabled={pending || !value.trim()}><IconCheck /></button>
    </form>
  )

  return (
    <div className="group">
      {items.map((it) => editing === it.key ? <div key={it.key}>{editor(it.key)}</div> : (
        <div className="rowi" key={it.key}>
          <div className="main"><div className="t1">{it.name}</div>{it.sub && <div className="t2">{it.sub}</div>}</div>
          <button type="button" className="iconbtn" aria-label={`แก้ชื่อ ${it.name}`} title="แก้ชื่อ" onClick={() => { setEditing(it.key); setValue(it.name); setErr('') }}><IconEdit /></button>
          <DeleteButton action={remove} fields={{ [field.id]: it.key, name: it.key }} label={it.name} />
        </div>
      ))}
      {!items.length && empty && <div className="empty-state">{empty}</div>}
      {editing === '__new' ? editor('__new') : (
        <button type="button" className="rowi addrow" onClick={() => { setEditing('__new'); setValue(''); setErr('') }}>
          <span className="ic"><IconPlus /></span><div className="main"><div className="t1">{addLabel}</div></div>
        </button>
      )}
      {err && <div className="rowi noicon"><p className="ferr" role="alert" style={{ margin: 0 }}>{err}</p></div>}
    </div>
  )
}
