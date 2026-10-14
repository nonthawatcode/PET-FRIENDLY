import 'server-only'
import webpush from 'web-push'
import { createServiceClient } from './supabase/server'

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; user_id: string }

/** Signing keys for web push. Created once and kept in the database (service role only). */
async function vapid() {
  const admin = createServiceClient()
  if (!admin) return null
  const { data } = await admin.from('push_config').select('vapid_public, vapid_private').maybeSingle()
  if (data) return { admin, pub: data.vapid_public as string, priv: data.vapid_private as string }
  const keys = webpush.generateVAPIDKeys()
  await admin.from('push_config').upsert({ id: true, vapid_public: keys.publicKey, vapid_private: keys.privateKey })
  const { data: again } = await admin.from('push_config').select('vapid_public, vapid_private').maybeSingle()
  return again ? { admin, pub: again.vapid_public as string, priv: again.vapid_private as string } : null
}

export async function vapidPublicKey() {
  return (await vapid())?.pub ?? null
}

async function send(cfg: NonNullable<Awaited<ReturnType<typeof vapid>>>, subs: Sub[], payload: object) {
  const dead: string[] = []
  await Promise.all(
    subs.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          vapidDetails: { subject: 'mailto:noreply@pet-friendly.app', publicKey: cfg.pub, privateKey: cfg.priv },
          TTL: 60 * 60 * 24,
        })
        .catch((e: { statusCode?: number }) => {
          if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id) // phone unsubscribed
        }),
    ),
  )
  if (dead.length) await cfg.admin.from('push_subscriptions').delete().in('id', dead)
}

/** Sends phone notifications for every alert not pushed yet. Safe to call often. */
export async function dispatchPending() {
  const cfg = await vapid()
  if (!cfg) return
  const { data: pending } = await cfg.admin.from('notifications').select('id, title, body, url').is('pushed_at', null).order('id').limit(20)
  if (!pending?.length) return
  // Claim them first so two servers running at once don't both send.
  const { data: claimed } = await cfg.admin
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in('id', pending.map((p) => p.id))
    .is('pushed_at', null)
    .select('id, title, body, url')
  if (!claimed?.length) return
  const { data: subs } = await cfg.admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id')
  if (!subs?.length) return
  for (const n of claimed) await send(cfg, subs as Sub[], { title: n.title, body: n.body, url: n.url, tag: `n${n.id}` })
}

/** A test notification to the given user's phones only. */
export async function sendTest(userId: string) {
  const cfg = await vapid()
  if (!cfg) return 'no_service_key'
  const { data: subs } = await cfg.admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').eq('user_id', userId)
  if (!subs?.length) return 'no_subscription'
  await send(cfg, subs as Sub[], { title: 'PET-FRIENDLY', body: 'ทดสอบแจ้งเตือน ใช้งานได้แล้ว ✓', url: '/account', tag: 'test' })
  return 'ok'
}
