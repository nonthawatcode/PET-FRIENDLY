import { dispatchPending } from '@/lib/push'
import { createServiceClient } from '@/lib/supabase/server'

// Runs once a day (vercel.json → crons): parcels not handed over, photo storage nearly full,
// then sends any phone notifications still waiting. Repeated calls do not create duplicates.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // If CRON_SECRET is set in Vercel, only Vercel's scheduler (which sends it) may run this.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 })
  const admin = createServiceClient()
  if (!admin) return Response.json({ ok: false, error: 'no_service_key' }, { status: 500 })
  const { data: limit } = await admin.from('app_settings').select('value').eq('key', 'storage_limit_mb').maybeSingle()
  const { data, error } = await admin.rpc('run_daily_checks', { p_storage_limit_mb: Number(limit?.value ?? 1024) || 1024 })
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  await dispatchPending()
  return Response.json({ ok: true, ...(data as object) })
}
