'use client'

import { useEffect, useState } from 'react'
import { getVapidKey, removePushSubscription, savePushSubscription, sendTestPush } from '@/app/actions'

type State = 'loading' | 'unsupported' | 'ios-home' | 'blocked' | 'off' | 'on'

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '')

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/** Turn phone notifications on/off for this device, and send a test. */
export function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState(ios && !standalone ? 'ios-home' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') { setState('blocked'); return }
    registration()
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setState(s ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [])

  async function turnOn() {
    setBusy(true); setMsg(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return }
      const key = await getVapidKey()
      if (!key) throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์')
      const reg = await registration()
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
      const r = await savePushSubscription({ endpoint: sub.endpoint, p256dh: b64(sub.getKey('p256dh')), auth: b64(sub.getKey('auth')) }, navigator.userAgent)
      if (!r.ok) throw new Error(r.error)
      setState('on')
      setMsg({ ok: true, text: 'เปิดแจ้งเตือนแล้ว ลองกด “ส่งทดสอบ” ได้เลย' })
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      // Browser errors are in English; show our own Thai text for those.
      setMsg({ ok: false, text: /[\u0E00-\u0E7F]/.test(m) ? m : /permission/i.test(m) ? 'เครื่องนี้ไม่อนุญาตให้แจ้งเตือน ไปเปิดใน ตั้งค่า > การแจ้งเตือน' : 'เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง' })
    } finally { setBusy(false) }
  }

  async function turnOff() {
    setBusy(true); setMsg(null)
    try {
      const sub = await (await registration()).pushManager.getSubscription()
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe() }
      setState('off')
    } catch { setMsg({ ok: false, text: 'ปิดไม่สำเร็จ ลองใหม่อีกครั้ง' }) } finally { setBusy(false) }
  }

  async function test() {
    setBusy(true); setMsg(null)
    const r = await sendTestPush()
    setMsg(r.ok ? { ok: true, text: r.message ?? 'ส่งแล้ว' } : { ok: false, text: r.error })
    setBusy(false)
  }

  const hint =
    state === 'loading' ? 'กำลังตรวจ…'
    : state === 'on' ? 'เครื่องนี้จะได้รับแจ้งเตือน'
    : state === 'off' ? 'ออเดอร์ใหม่ · สินค้าใกล้หมด · กล่องค้างส่ง · พื้นที่รูปใกล้เต็ม'
    : state === 'blocked' ? 'ถูกปิดไว้ในตั้งค่าของเครื่อง ต้องไปเปิดใน ตั้งค่า > การแจ้งเตือน'
    : state === 'ios-home' ? 'iPhone: กดปุ่มแชร์ ⎋ > “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดแอปจากไอคอนนั้น'
    : 'เบราว์เซอร์นี้ไม่รองรับ'

  return (
    <div className="group">
      <div className="rowi noicon">
        <div className="main">
          <div className="t1">แจ้งเตือนบนมือถือ {state === 'on' && <span className="chip ok">เปิดอยู่</span>}</div>
          <div className="t2">{hint}</div>
        </div>
        {state === 'off' && <button type="button" className="btn pri" onClick={turnOn} disabled={busy}>{busy ? '…' : 'เปิด'}</button>}
        {state === 'on' && <button type="button" className="link quiet" onClick={turnOff} disabled={busy}>ปิด</button>}
      </div>
      {state === 'on' && (
        <div className="rowi noicon">
          <div className="main"><div className="t2">กดเพื่อส่งแจ้งเตือนทดสอบมาที่เครื่องนี้</div></div>
          <button type="button" className="btn" onClick={test} disabled={busy}>{busy ? 'กำลังส่ง…' : 'ส่งทดสอบ'}</button>
        </div>
      )}
      {msg && <div className="rowi noicon"><div className="main"><div className={msg.ok ? 't2' : 'ferr'} role={msg.ok ? 'status' : 'alert'} style={{ margin: 0 }}>{msg.text}</div></div></div>}
    </div>
  )
}
