import { signIn } from '@/app/actions'
import { ActionForm, Submit } from '@/components/ActionForm'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** The uploaded logo (set in บัญชี > แบรนด์). Read with the server key since nobody is signed in yet. */
async function logoUrl() {
  const admin = createServiceClient()
  if (!admin) return null
  const { data } = await admin.from('app_settings').select('value').eq('key', 'logo_url').maybeSingle()
  return (data?.value as string | undefined) ?? null
}

export default async function LoginPage() {
  const logo = await logoUrl().catch(() => null)
  return (
    <main className="auth">
      <ActionForm action={signIn} className="authcard">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img className="logo-img" src={logo} alt="PET-FRIENDLY" /> : <div className="logo" role="img" aria-label="PET-FRIENDLY" />}
        <div style={{ textAlign: 'center' }}><h1 style={{ fontSize: '1.4rem' }}>เข้าสู่ระบบหลังบ้าน</h1><p className="small muted" style={{ margin: '4px 0 0' }}>สำหรับพนักงาน PET-FRIENDLY</p></div>
        <div className="field"><label htmlFor="email">อีเมล</label><input id="email" name="email" type="email" className="input" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">รหัสผ่าน</label><input id="password" name="password" type="password" className="input" autoComplete="current-password" required /></div>
        <Submit className="btn pri xl" pendingText="กำลังเข้าสู่ระบบ…">เข้าสู่ระบบ</Submit>
      </ActionForm>
    </main>
  )
}
