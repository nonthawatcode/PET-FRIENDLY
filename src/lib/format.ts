import type { MovementKind, OrderStatus, Platform } from './types'

export const PLATFORM: Record<Platform, string> = { shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok Shop' }
export const STATUS: Record<OrderStatus, string> = {
  pending: 'รอแพ็ก',
  packing: 'กำลังแพ็ก',
  packed: 'แพ็กแล้ว',
  shipped: 'จัดส่งแล้ว',
  cancelled: 'ยกเลิก',
}
export const KIND: Record<MovementKind, string> = {
  receive: 'รับเข้า',
  reserve: 'จอง',
  release: 'ปลดจอง',
  deduct: 'ตัดสต็อก',
  return: 'คืนเข้าสต็อก',
  adjust: 'แก้ไขสต็อก',
  damage: 'ชำรุด',
}

const TZ = 'Asia/Bangkok'

export function baht(n: number | null | undefined) {
  if (n == null) return '—'
  return '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

/** YYYY-MM-DD in Bangkok time. */
export function bkkDay(d: string | Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
}

export function hm(d: string | Date) {
  return new Date(d).toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

export function dayLabel(day: string, today = bkkDay(new Date())) {
  if (day === today) return 'วันนี้'
  const y = new Date(today + 'T12:00:00+07:00')
  y.setDate(y.getDate() - 1)
  if (day === bkkDay(y)) return 'เมื่อวาน'
  return new Date(day + 'T12:00:00+07:00').toLocaleDateString('th-TH', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
}

export function when(d: string | Date) {
  const day = bkkDay(d)
  const today = bkkDay(new Date())
  const prefix = day === today ? 'วันนี้' : new Date(d).toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short' })
  return `${prefix} ${hm(d)}`
}

export function longDate(d = new Date()) {
  return d.toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
}

/** Start of the Bangkok day `daysAgo` days back, as an ISO string. */
export function bkkStart(daysAgo = 0) {
  const day = bkkDay(new Date(Date.now() - daysAgo * 864e5))
  return new Date(day + 'T00:00:00+07:00').toISOString()
}

const ERRORS: Record<string, string> = {
  not_authenticated: 'กรุณาเข้าสู่ระบบใหม่',
  account_disabled: 'บัญชีนี้ถูกปิดใช้งาน',
  not_found: 'ไม่พบออเดอร์ของรหัสนี้',
  ambiguous: 'รหัสนี้ตรงกับหลายออเดอร์ ค้นหาจากหน้าออเดอร์แทน',
  already_packed: 'ออเดอร์นี้แพ็กไปแล้ว ไม่ตัดสต็อกซ้ำ',
  cancelled: 'ออเดอร์นี้ถูกยกเลิก ห้ามแพ็กและจัดส่ง',
  unpaid: 'ยังไม่ชำระเงิน รอ Marketplace ยืนยันก่อนแพ็ก',
  unmapped_sku: 'มีสินค้าที่ยังไม่ผูก SKU ผูกที่หน้าสต็อกก่อน',
  being_packed: 'มีคนอื่นกำลังแพ็กออเดอร์นี้อยู่',
  count_mismatch: 'จำนวนที่สแกนไม่ตรงกับออเดอร์',
  insufficient_stock: 'สต็อกในคลังไม่พอ ตรวจนับหรือรับสินค้าเข้าก่อน',
  reason_required: 'ใส่เหตุผลก่อนบันทึก',
  invalid_quantity: 'จำนวนไม่ถูกต้อง',
  not_packed: 'ทำได้เฉพาะออเดอร์ที่แพ็กแล้ว',
  return_exceeds_order: 'จำนวนคืนเกินจำนวนที่สั่ง',
  sku_locked: 'SKU ถูกพิมพ์ลงบรรจุภัณฑ์แล้ว เปลี่ยนไม่ได้',
  no_listings: 'ผูก SKU ของ Marketplace กับสินค้าก่อนสร้างออเดอร์ตัวอย่าง',
  courier_required: 'เลือกขนส่งก่อน',
  photo_required: 'ถ่ายรูปพัสดุอย่างน้อย 1 รูป',
  nothing_selected: 'เลือกกล่องที่จะส่งอย่างน้อย 1 กล่อง',
  nothing_to_hand_over: 'กล่องที่เลือกถูกส่งไปแล้ว หรือยังไม่ได้แพ็ก',
  shop_not_found: 'ไม่พบร้านค้านี้',
  packaging_short: 'Packaging ในโกดังไม่พอ (ขวด ฝา หรือกล่อง) เติมที่หน้าโกดังก่อน',
  packaging_not_set: 'ยังไม่ได้เลือกขวด/กล่องของกลิ่นนี้ หรือฝาที่ใช้ เลือกที่ การ์ดสินค้า → ข้อมูล และหน้าโกดัง',
  shop_stock_short: 'จำนวนเกินของที่อยู่ที่ร้าน',
  '23505': 'ข้อมูลนี้มีอยู่แล้ว',
}

export function errorText(e: { message?: string; code?: string } | string | null | undefined) {
  if (!e) return 'เกิดข้อผิดพลาด'
  const msg = typeof e === 'string' ? e : e.message ?? ''
  const code = typeof e === 'string' ? '' : e.code ?? ''
  return ERRORS[msg] ?? ERRORS[code] ?? (msg || 'เกิดข้อผิดพลาด')
}

export const COURIERS = ['SPX Express', 'Flash Express', 'J&T Express', 'Kerry Express', 'Lazada Express', 'ไปรษณีย์ไทย', 'Best Express']

/** Document number shown on delivery / return notes. */
export const docNo = (d: { kind: 'send' | 'return'; no: number }) => `${d.kind === 'send' ? 'DN' : 'RN'}-${String(d.no).padStart(5, '0')}`
