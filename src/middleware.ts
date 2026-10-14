import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/version|favicon.ico|logo-mask.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
