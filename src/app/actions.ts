'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { errorText } from '@/lib/format'
import type { ActionResult, Order, Platform } from '@/lib/types'

const refresh = () => revalidatePath('/', 'layout')
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const int = (fd: FormData, k: string) => Number.parseInt(str(fd, k), 10)

async function rpc(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const sb = await createClient()
  const { error } = await sb.rpc(fn, args)
  if (error) return { ok: false, error: errorText(error) }
  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------- auth
export async function signIn(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sb = await createClient()
  const { error } = await sb.auth.signInWithPassword({ email: str(fd, 'email'), password: String(fd.get('password') ?? '') })
  if (error) return { ok: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
  redirect('/')
}

export async function signOut() {
  const sb = await createClient()
  await sb.auth.signOut()
  redirect('/login')
}

// ---------------------------------------------------------------- packing
export type StartPackResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; code: string; orderId?: string; detail?: string }

export async function startPack(code: string): Promise<StartPackResult> {
  const sb = await createClient()
  const { data, error } = await sb.rpc('start_pack', { p_code: code })
  if (error) return { ok: false, code: 'error', error: errorText(error) }
  const r = data as { ok: boolean; error?: string; order_id?: string; packed_by?: string; packed_at?: string; packing_by?: string }
  if (!r.ok) {
    const detail = r.error === 'already_packed' && r.packed_at
      ? `${r.packed_by ?? ''} · ${new Date(r.packed_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })}`
      : r.error === 'being_packed' ? `โดย ${r.packing_by ?? 'ผู้ใช้อื่น'}` : undefined
    return { ok: false, code: r.error ?? 'error', error: errorText(r.error), orderId: r.order_id, detail }
  }
  const { data: order } = await sb
    .from('orders')
    .select('id, platform, external_order_id, source, ordered_at, buyer_name, recipient_name, total_amount, status, marketplace_state, marketplace_status, tracking_number, needs_attention, packed_at, packed_by, shipped_at, order_items(id, line_no, platform_sku, title, product_id, quantity, listing_quantity, unit_price, reserved_qty, returned_qty, products(sku, name, option_name))')
    .eq('id', r.order_id!)
    .single()
  refresh()
  return { ok: true, order: order as unknown as Order }
}

export async function parkPack(orderId: string): Promise<ActionResult> {
  return rpc('park_pack', { p_order: orderId })
}

export async function confirmPack(orderId: string, scanned: Record<string, number>): Promise<ActionResult> {
  const sb = await createClient()
  const { data, error } = await sb.rpc('confirm_pack', { p_order: orderId, p_scanned: scanned })
  if (error) return { ok: false, error: errorText(error) }
  const r = data as { ok: boolean; error?: string; already?: boolean }
  if (!r.ok) return { ok: false, error: errorText(r.error) }
  refresh()
  return { ok: true, message: r.already ? 'ออเดอร์นี้แพ็กไว้แล้ว ไม่ได้ตัดสต็อกซ้ำ' : undefined }
}

export async function bindLabelCode(code: string, externalOrderId: string): Promise<ActionResult> {
  const sb = await createClient()
  const { data: matches } = await sb.from('orders').select('id').ilike('external_order_id', externalOrderId.trim()).limit(2)
  if (!matches?.length) return { ok: false, error: 'ไม่พบเลขออเดอร์นี้' }
  if (matches.length > 1) return { ok: false, error: 'เลขออเดอร์ซ้ำกันหลายช่องทาง' }
  return rpc('bind_label_code', { p_code: code, p_order: matches[0].id })
}

// ---------------------------------------------------------------- order follow-up
export async function unpackOrder(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return rpc('unpack_order', { p_order: str(fd, 'order_id'), p_reason: str(fd, 'reason') })
}

export async function markHandedOver(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return rpc('mark_handed_over', { p_order: str(fd, 'order_id') })
}

export async function recordReturn(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const lines = fd.getAll('item_id').map((id) => ({
    item_id: String(id),
    good: Number(fd.get(`good_${id}`) || 0),
    damaged: Number(fd.get(`damaged_${id}`) || 0),
  })).filter((l) => l.good > 0 || l.damaged > 0)
  if (!lines.length) return { ok: false, error: 'ใส่จำนวนที่ได้รับคืนอย่างน้อย 1 ชิ้น' }
  return rpc('record_return', { p_order: str(fd, 'order_id'), p_lines: lines, p_note: str(fd, 'note') || null })
}

// ---------------------------------------------------------------- stock
export async function receiveStock(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const r = await rpc('receive_stock', { p_product: str(fd, 'product_id'), p_qty: int(fd, 'qty'), p_note: str(fd, 'note') || null })
  return r.ok ? { ok: true, message: `รับเข้า +${int(fd, 'qty')} แล้ว` } : r
}

export async function adjustStock(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const r = await rpc('adjust_stock', { p_product: str(fd, 'product_id'), p_delta: int(fd, 'delta'), p_reason: str(fd, 'reason') })
  return r.ok ? { ok: true, message: 'บันทึกการแก้ไขแล้ว' } : r
}

export async function bindListing(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sku = str(fd, 'external_sku')
  if (!sku) return { ok: false, error: 'ใส่รหัสสินค้าของ Marketplace' }
  const sb = await createClient()
  const { data, error } = await sb.rpc('bind_listing', {
    p_product: str(fd, 'product_id'),
    p_platform: str(fd, 'platform') as Platform,
    p_external_sku: sku,
  })
  if (error) return { ok: false, error: errorText(error) }
  refresh()
  return { ok: true, message: data ? `ผูกแล้ว และจองสต็อกให้ ${data} ออเดอร์ที่รออยู่` : 'ผูกรหัสแล้ว' }
}

export async function unbindListing(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return rpc('unbind_listing', { p_listing: str(fd, 'listing_id') })
}

export async function saveProduct(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sb = await createClient()
  const { error } = await sb
    .from('products')
    .update({ name: str(fd, 'name'), option_name: str(fd, 'option_name'), low_stock_threshold: Math.max(0, int(fd, 'threshold') || 0) })
    .eq('id', str(fd, 'product_id'))
  if (error) return { ok: false, error: errorText(error) }
  refresh()
  return { ok: true, message: 'บันทึกแล้ว' }
}

export async function createProduct(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sku = str(fd, 'sku').toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9-]{1,40}$/.test(sku)) return { ok: false, error: 'SKU ใช้ได้เฉพาะ A-Z, 0-9 และ - (เช่น PF-FDP-04)' }
  const sb = await createClient()
  const { error } = await sb.from('products').insert({
    sku,
    name: str(fd, 'name') || 'FUR DE PARFUM',
    option_name: str(fd, 'option_name'),
    low_stock_threshold: Math.max(0, int(fd, 'threshold') || 20),
  })
  if (error) return { ok: false, error: error.code === '23505' ? 'มี SKU นี้อยู่แล้ว' : errorText(error) }
  refresh()
  redirect(`/stock?sku=${encodeURIComponent(sku)}&tab=dm`)
}

export async function saveDmColors(productId: string, fg: string, bg: string): Promise<ActionResult> {
  const sb = await createClient()
  const { error } = await sb.from('products').update({ dm_fg: fg.toUpperCase(), dm_bg: bg.toUpperCase() }).eq('id', productId)
  if (error) return { ok: false, error: errorText(error) }
  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------- test data
export async function createSampleOrder(): Promise<ActionResult> {
  const r = await rpc('create_sample_order', {})
  return r.ok ? { ok: true, message: 'สร้างออเดอร์ตัวอย่างแล้ว' } : r
}

// ---------------------------------------------------------------- account
export async function updateDisplayName(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sb = await createClient()
  const { data } = await sb.auth.getUser()
  if (!data.user) return { ok: false, error: errorText('not_authenticated') }
  const { error } = await sb.from('profiles').update({ display_name: str(fd, 'display_name') }).eq('id', data.user.id)
  if (error) return { ok: false, error: errorText(error) }
  refresh()
  return { ok: true, message: 'บันทึกแล้ว' }
}

export async function inviteUser(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const admin = createServiceClient()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์' }
  const sb = await createClient()
  const { data: me } = await sb.auth.getUser()
  if (!me.user) return { ok: false, error: errorText('not_authenticated') }
  const email = str(fd, 'email')
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: str(fd, 'display_name') || undefined } })
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true, message: `ส่งคำเชิญไปที่ ${email} แล้ว` }
}

export async function setUserDisabled(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const admin = createServiceClient()
  if (!admin) return { ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์' }
  const sb = await createClient()
  const { data: me } = await sb.auth.getUser()
  if (!me.user) return { ok: false, error: errorText('not_authenticated') }
  const id = str(fd, 'user_id')
  if (id === me.user.id) return { ok: false, error: 'ปิดบัญชีตัวเองไม่ได้' }
  const disabled = str(fd, 'disabled') === 'true'
  const { error } = await admin.from('profiles').update({ disabled }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await admin.auth.admin.updateUserById(id, { ban_duration: disabled ? '876000h' : 'none' })
  refresh()
  return { ok: true }
}

export async function uploadLogo(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const file = fd.get('logo')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'เลือกไฟล์โลโก้ก่อน' }
  if (!['image/png', 'image/svg+xml', 'image/webp'].includes(file.type)) return { ok: false, error: 'ใช้ไฟล์ PNG, SVG หรือ WebP' }
  if (file.size > 1_000_000) return { ok: false, error: 'ไฟล์ใหญ่เกิน 1 MB' }
  const sb = await createClient()
  const path = `logo-${Date.now()}.${file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]}`
  const { error } = await sb.storage.from('brand').upload(path, file, { contentType: file.type, upsert: true })
  if (error) return { ok: false, error: error.message }
  const url = sb.storage.from('brand').getPublicUrl(path).data.publicUrl
  const { error: e2 } = await sb.from('app_settings').upsert({ key: 'logo_url', value: url, updated_at: new Date().toISOString() })
  if (e2) return { ok: false, error: errorText(e2) }
  refresh()
  return { ok: true, message: 'เปลี่ยนโลโก้แล้ว' }
}

export async function resetLogo(): Promise<ActionResult> {
  const sb = await createClient()
  const { error } = await sb.from('app_settings').delete().eq('key', 'logo_url')
  if (error) return { ok: false, error: errorText(error) }
  refresh()
  return { ok: true }
}
