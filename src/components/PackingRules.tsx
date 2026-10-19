'use client'

import { useState, useTransition } from 'react'
import { deletePackingRule, savePackingRule } from '@/app/actions'
import type { PackagingItem } from '@/lib/types'
import { DeleteButton } from './Editable'
import { IconCheck, IconEdit, IconPlus, IconX } from './icons'

type Rule = { item_id: string; per: 'order' | 'piece'; qty: number }

/** "ของที่ใช้ตอนแพ็ก": what each confirmed pack takes from โกดัง. */
export function PackingRules({ rules, items }: { rules: Rule[]; items: PackagingItem[] }) {
  const [editing, setEditing] = useState<string | null>(null) // item id, or '__new'
  const [draft, setDraft] = useState<Rule>({ item_id: '', per: 'order', qty: 1 })
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const name = (id: string) => items.find((i) => i.id === id)
  const free = items.filter((i) => !rules.some((r) => r.item_id === i.id) || i.id === editing)

  const save = () => start(async () => {
    const fd = new FormData()
    fd.set('item_id', draft.item_id); fd.set('per', draft.per); fd.set('qty', String(draft.qty))
    const r = await savePackingRule(null, fd)
    if (r.ok) { setEditing(null); setErr('') } else setErr(r.error)
  })

  const editor = (
    <div className="rowi ruleedit">
      <select className="input" value={draft.item_id} onChange={(e) => setDraft({ ...draft, item_id: e.target.value })} aria-label="รายการ" disabled={editing !== '__new'}>
        <option value="">— เลือกรายการ —</option>
        {free.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input className="input" type="number" min={1} inputMode="numeric" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} aria-label="จำนวน" style={{ width: 72 }} />
        <div className="seg" style={{ flex: 1 }}>
          <button type="button" aria-selected={draft.per === 'order'} onClick={() => setDraft({ ...draft, per: 'order' })}>ต่อออเดอร์</button>
          <button type="button" aria-selected={draft.per === 'piece'} onClick={() => setDraft({ ...draft, per: 'piece' })}>ต่อชิ้น</button>
        </div>
        <button type="button" className="iconbtn" aria-label="ยกเลิก" onClick={() => { setEditing(null); setErr('') }}><IconX /></button>
        <button type="button" className="iconbtn ok" aria-label="บันทึก" disabled={pending || !draft.item_id || !(draft.qty > 0)} onClick={save}><IconCheck /></button>
      </div>
    </div>
  )

  return (
    <div className="group">
      {rules.map((r) => editing === r.item_id ? <div key={r.item_id}>{editor}</div> : (
        <div className="rowi" key={r.item_id}>
          <div className="main">
            <div className="t1">{name(r.item_id)?.name ?? '—'}</div>
            <div className="t2">ใช้ {r.qty} {r.per === 'order' ? 'ต่อออเดอร์' : 'ต่อชิ้น'} · เหลือ {name(r.item_id)?.qty ?? 0}</div>
          </div>
          <button type="button" className="iconbtn" aria-label="แก้" onClick={() => { setDraft(r); setEditing(r.item_id); setErr('') }}><IconEdit /></button>
          <DeleteButton action={deletePackingRule} fields={{ item_id: r.item_id }} label={name(r.item_id)?.name ?? ''} />
        </div>
      ))}
      {!rules.length && editing !== '__new' && <div className="empty-state">ยังไม่ได้ตั้ง ตอนยืนยันแพ็กจะยังไม่ตัดของจากโกดัง</div>}
      {editing === '__new' ? editor : (
        <button type="button" className="rowi addrow" onClick={() => { setDraft({ item_id: '', per: 'order', qty: 1 }); setEditing('__new'); setErr('') }}>
          <span className="ic"><IconPlus /></span><div className="main"><div className="t1">เพิ่มของที่ใช้ตอนแพ็ก</div></div>
        </button>
      )}
      {err && <div className="rowi noicon"><p className="ferr" role="alert" style={{ margin: 0 }}>{err}</p></div>}
    </div>
  )
}
