import 'server-only'
import { createClient } from './supabase/server'
import { bkkStart } from './format'
import type { Movement, Notice, Order, OrderStatus, Platform, ProductStock, Category } from './types'

const ORDER_SELECT =
  'id, platform, external_order_id, source, ordered_at, buyer_name, recipient_name, total_amount, status, marketplace_state, marketplace_status, tracking_number, needs_attention, packed_at, packed_by, shipped_at, handover_id, order_items(id, line_no, platform_sku, title, product_id, quantity, listing_quantity, unit_price, reserved_qty, returned_qty, products(sku, name, option_name))'

export async function getShell() {
  const sb = await createClient()
  // The middleware already verified the login; reading the id from the session cookie
  // avoids another round trip. Every query below is still protected by database rules.
  const { data: { session } } = await sb.auth.getSession()
  const uid = session?.user.id ?? ''
  const [pending, low, logo, profile, notes] = await Promise.all([
    sb.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'packing']),
    sb.from('product_stock').select('id', { count: 'exact', head: true }).eq('is_low', true).eq('archived', false),
    sb.from('app_settings').select('value').eq('key', 'logo_url').maybeSingle(),
    sb.from('profiles').select('id, display_name, email, notifications_seen_at').eq('id', uid).maybeSingle(),
    sb.from('notifications').select('id, kind, title, body, url, created_at').order('created_at', { ascending: false }).limit(30),
  ])
  const seenAt = (profile.data as { notifications_seen_at?: string } | null)?.notifications_seen_at ?? ''
  const notifications = (notes.data ?? []) as Notice[]
  return {
    profile: profile.data,
    pendingCount: pending.count ?? 0,
    lowCount: low.count ?? 0,
    logoUrl: (logo.data?.value as string | undefined) ?? null,
    notifications,
    unread: notifications.filter((n) => n.created_at > seenAt).length,
  }
}

export async function getProducts(includeArchived = false) {
  const sb = await createClient()
  let q = sb.from('product_stock').select('*').order('sku')
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ProductStock[]
}

export async function getCategories() {
  const sb = await createClient()
  const { data, error } = await sb.from('categories').select('id, name').order('created_at')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function getQueue() {
  const sb = await createClient()
  const { data, error } = await sb
    .from('orders')
    .select(ORDER_SELECT)
    .in('status', ['pending', 'packing'])
    .order('ordered_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

export async function getPacked() {
  const sb = await createClient()
  const { data, error } = await sb.from('orders').select(ORDER_SELECT).eq('status', 'packed').order('packed_at', { ascending: true }).limit(300)
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

export async function getHandover(id: string) {
  const sb = await createClient()
  const { data } = await sb.from('handovers').select('id, courier, photo_paths, note, created_at, profiles(display_name)').eq('id', id).maybeSingle()
  if (!data) return null
  const h = data as unknown as { id: string; courier: string; photo_paths: string[]; note: string | null; created_at: string; profiles: { display_name: string } | null }
  if (!h.photo_paths.length) return { ...h, photos: [] as string[] }
  const { data: signed } = await sb.storage.from('handover').createSignedUrls(h.photo_paths, 60 * 60)
  return { ...h, photos: (signed ?? []).map((x) => x.signedUrl).filter(Boolean) as string[] }
}

export async function getPackStats() {
  const sb = await createClient()
  const { count } = await sb.from('orders').select('id', { count: 'exact', head: true }).gte('packed_at', bkkStart(0))
  return { packedToday: count ?? 0 }
}

export interface OrderFilters {
  tab: 'all' | 'pending' | OrderStatus
  q: string
  platform: 'all' | Platform
  range: 'today' | '7' | '30' | 'all'
}

export async function getOrders(f: OrderFilters) {
  const sb = await createClient()
  let q = sb.from('orders').select(ORDER_SELECT).order('ordered_at', { ascending: false }).limit(500)
  if (f.platform !== 'all') q = q.eq('platform', f.platform)
  if (f.range === 'today') q = q.gte('ordered_at', bkkStart(0))
  else if (f.range !== 'all') q = q.gte('ordered_at', bkkStart(Number(f.range) - 1))
  const term = f.q.trim().replace(/[,()*%]/g, ' ').trim()
  if (term) {
    q = q.or(`external_order_id.ilike.%${term}%,tracking_number.ilike.%${term}%,buyer_name.ilike.%${term}%,recipient_name.ilike.%${term}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

export async function getOrder(id: string) {
  const sb = await createClient()
  const [{ data: order }, { data: events }, { data: packer }] = await Promise.all([
    sb.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle(),
    sb.from('order_events').select('id, kind, message, created_at, profiles(display_name)').eq('order_id', id).order('created_at'),
    sb.from('orders').select('packer:profiles!orders_packed_by_fkey(display_name)').eq('id', id).maybeSingle(),
  ])
  if (!order) return null
  return {
    order: order as unknown as Order,
    events: (events ?? []) as unknown as { id: number; kind: string; message: string; created_at: string; profiles: { display_name: string } | null }[],
    packedByName: (packer as unknown as { packer: { display_name: string } | null } | null)?.packer?.display_name ?? null,
  }
}

export async function getMovements(opts: { productId?: string; limit?: number; hideReservations?: boolean } = {}) {
  const sb = await createClient()
  let q = sb
    .from('stock_movements')
    .select('id, kind, quantity, delta_on_hand, delta_reserved, note, created_at, order_id, products(sku), orders(external_order_id), profiles(display_name)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(opts.limit ?? 50)
  if (opts.productId) q = q.eq('product_id', opts.productId)
  if (opts.hideReservations) q = q.not('kind', 'in', '(reserve,release)')
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as Movement[]
}

export async function getListings(productId: string) {
  const sb = await createClient()
  const { data } = await sb.from('marketplace_listings').select('id, platform, external_sku, units_per_item').eq('product_id', productId).order('platform')
  return (data ?? []) as { id: string; platform: Platform; external_sku: string; units_per_item: number }[]
}

export async function getUnmappedSkus() {
  const sb = await createClient()
  const { data } = await sb
    .from('order_items')
    .select('platform_sku, orders!inner(platform, status)')
    .is('product_id', null)
    .in('orders.status', ['pending', 'packing'])
  const seen = new Map<string, { platform: Platform; sku: string; count: number }>()
  for (const r of (data ?? []) as unknown as { platform_sku: string; orders: { platform: Platform } }[]) {
    const k = r.orders.platform + ':' + r.platform_sku
    const e = seen.get(k) ?? { platform: r.orders.platform, sku: r.platform_sku, count: 0 }
    e.count++
    seen.set(k, e)
  }
  return [...seen.values()]
}

export async function getStaff() {
  const sb = await createClient()
  const { data } = await sb.from('profiles').select('id, display_name, email, disabled').order('created_at')
  return (data ?? []) as { id: string; display_name: string; email: string | null; disabled: boolean }[]
}
