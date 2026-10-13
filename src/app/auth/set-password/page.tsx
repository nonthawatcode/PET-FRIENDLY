import { redirect } from 'next/navigation'
import { ActionForm, Submit } from '@/components/ActionForm'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

async function setPassword(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  'use server'
  const pw = String(fd.get('password') ?? '')
  if (pw.length < 8) return { ok: false, error: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' }
  if (pw !== String(fd.get('confirm') ?? '')) return { ok: false, error: 'รหัสผ่านสองช่องไม่ตรงกัน' }
  const sb = await createClient()
  const { error } = await sb.auth.updateUser({ password: pw })
  if (error) return { ok: false, error: error.message }
  redirect('/')
}

export default async function SetPasswordPage() {
  const sb = await createClient()
  const { data } = await sb.auth.getUser()
  if (!data.user) redirect('/login')
  return (
    <main className="auth">
      <ActionForm action={setPassword} className="authcard">
        <div className="logo" role="img" aria-label="PET-FRIENDLY" />
        <div style={{ textAlign: 'center' }}><h1 style={{ fontSize: '1.4rem' }}>ตั้งรหัสผ่าน</h1><p className="small muted" style={{ margin: '4px 0 0' }}>{data.user.email}</p></div>
        <div className="field"><label htmlFor="pw">รหัสผ่านใหม่</label><input id="pw" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
        <div className="field"><label htmlFor="pw2">ยืนยันรหัสผ่าน</label><input id="pw2" name="confirm" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
        <Submit className="btn pri xl">บันทึกและเข้าสู่ระบบ</Submit>
      </ActionForm>
    </main>
  )
}
