import { createSampleOrder, inviteUser, resetLogo, setUserDisabled, signOut, updateDisplayName, uploadLogo } from '@/app/actions'
import { ActionForm, Submit } from '@/components/ActionForm'
import { PlatformMark } from '@/components/bits'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { VersionCheck } from '@/components/VersionCheck'
import { getShell, getStaff } from '@/lib/data'
import { PLATFORM } from '@/lib/format'
import type { ActionResult, Platform } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function sampleAction(): Promise<ActionResult> {
  'use server'
  return createSampleOrder()
}
async function resetLogoAction(): Promise<ActionResult> {
  'use server'
  return resetLogo()
}

export default async function AccountPage() {
  const [shell, staff] = await Promise.all([getShell(), getStaff()])
  const me = shell.profile
  return (
    <>
      <div className="lt"><div><h1>บัญชี</h1><p>ตั้งค่าร้านและผู้ใช้งาน</p></div></div>

      <div className="group">
        <div className="rowi" style={{ minHeight: 76 }}>
          <span className="ic" style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--sun)', color: 'var(--sun-ink)', fontWeight: 700 }}>
            {(me?.display_name || me?.email || '?').slice(0, 2).toUpperCase()}
          </span>
          <div className="main"><div className="t1" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{me?.display_name || '—'}</div><div className="t2">{me?.email}</div></div>
          <form action={signOut}><button className="link quiet" type="submit">ออกจากระบบ</button></form>
        </div>
      </div>
      <ActionForm action={updateDisplayName} className="formcard">
        <div className="field"><label htmlFor="dn">ชื่อที่แสดงในประวัติ</label><input id="dn" name="display_name" className="input" defaultValue={me?.display_name ?? ''} required /></div>
        <Submit className="btn">บันทึกชื่อ</Submit>
      </ActionForm>

      <div className="sect">
        <span className="cap">Marketplace</span>
        <div className="group">
          {(Object.keys(PLATFORM) as Platform[]).map((k) => (
            <div className="rowi" key={k}>
              <PlatformMark p={k} />
              <div className="main"><div className="t1">{PLATFORM[k]}</div><div className="t2">ยังไม่เชื่อมต่อ · รอสิทธิ์ API จากแพลตฟอร์ม</div></div>
              <span className="chip">ยังไม่เชื่อม</span>
            </div>
          ))}
        </div>
        <p className="xs muted" style={{ margin: '0 6px' }}>ระหว่างนี้ใช้ออเดอร์ตัวอย่าง ระบบจะไม่แสดงว่าซิงก์สำเร็จจนกว่าจะเชื่อมและทดสอบกับร้านจริง</p>
      </div>

      <div className="sect" id="test">
        <span className="cap">ข้อมูลทดสอบ</span>
        <ActionForm action={sampleAction} className="formcard">
          <p className="small muted" style={{ margin: 0 }}>สร้างออเดอร์ตัวอย่าง 1 รายการจากรหัส Marketplace ที่ผูกไว้ ระบบจะจองสต็อกจริงและติดป้าย “ตัวอย่าง”</p>
          <Submit className="btn" pendingText="กำลังสร้าง…">สร้างออเดอร์ตัวอย่าง</Submit>
        </ActionForm>
      </div>

      <div className="sect">
        <span className="cap">ผู้ใช้งาน</span>
        <div className="group">
          {staff.map((u) => (
            <div className="rowi" key={u.id}>
              <span className="ic" style={{ borderRadius: 999, fontWeight: 700, fontSize: '.75rem' }}>{(u.display_name || u.email || '?').slice(0, 2).toUpperCase()}</span>
              <div className="main"><div className="t1">{u.display_name}{u.id === me?.id && <span className="xs muted">(คุณ)</span>}{u.disabled && <span className="chip bad">ปิดใช้งาน</span>}</div><div className="t2">{u.email}</div></div>
              {u.id !== me?.id && (
                <ActionForm action={setUserDisabled}>
                  <input type="hidden" name="user_id" value={u.id} /><input type="hidden" name="disabled" value={String(!u.disabled)} />
                  <Submit className="link quiet" pendingText="…">{u.disabled ? 'เปิดใช้งาน' : 'ปิดบัญชี'}</Submit>
                </ActionForm>
              )}
            </div>
          ))}
        </div>
        <ActionForm action={inviteUser} className="formcard" resetOnSuccess>
          <h3>เชิญผู้ใช้</h3>
          <div className="formrow">
            <div className="field"><label htmlFor="ie">อีเมล</label><input id="ie" name="email" type="email" className="input" required /></div>
            <div className="field"><label htmlFor="in">ชื่อ</label><input id="in" name="display_name" className="input" placeholder="เช่น ฝ่ายแพ็ก 2" /></div>
          </div>
          <Submit className="btn">ส่งคำเชิญ</Submit>
        </ActionForm>
      </div>

      <div className="sect">
        <span className="cap">แบรนด์</span>
        <ActionForm action={uploadLogo} className="formcard">
          <div className="row" style={{ gap: 14 }}>
            <div style={{ padding: '6px 10px', background: 'var(--fill)', borderRadius: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shell.logoUrl ? <img className="logo-img" src={shell.logoUrl} alt="โลโก้ปัจจุบัน" /> : <div className="logo" role="img" aria-label="โลโก้ปัจจุบัน" />}
            </div>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label htmlFor="lg">โลโก้ใหม่ (PNG/SVG พื้นโปร่งใส ไม่เกิน 1 MB)</label><input id="lg" name="logo" type="file" accept="image/png,image/svg+xml,image/webp" className="input" required /></div>
          </div>
          <Submit className="btn">อัปโหลดโลโก้</Submit>
        </ActionForm>
        {shell.logoUrl && <ActionForm action={resetLogoAction}><Submit className="link quiet">ใช้โลโก้เริ่มต้น</Submit></ActionForm>}
      </div>

      <div className="sect">
        <span className="cap">การแสดงผล</span>
        <ThemeSwitch />
      </div>

      <div className="sect">
        <span className="cap">แอป</span>
        <VersionCheck />
      </div>
    </>
  )
}
