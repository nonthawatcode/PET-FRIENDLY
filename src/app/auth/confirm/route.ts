import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Link target for invite / password-recovery emails:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (token_hash && type) {
    const sb = await createClient()
    const { error } = await sb.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(`${origin}${type === 'invite' || type === 'recovery' ? '/auth/set-password' : '/'}`)
  }
  return NextResponse.redirect(`${origin}/login?error=link`)
}
