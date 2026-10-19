export type Platform = 'shopee' | 'lazada' | 'tiktok'
export type OrderStatus = 'pending' | 'packing' | 'packed' | 'shipped' | 'cancelled'
export type MarketplaceState = 'unpaid' | 'ready' | 'shipped' | 'delivered' | 'cancelled'
export type MovementKind = 'receive' | 'reserve' | 'release' | 'deduct' | 'return' | 'adjust' | 'damage'

export interface ProductStock {
  id: string
  sku: string
  name: string
  option_name: string
  low_stock_threshold: number
  dm_fg: string
  dm_bg: string
  image_url: string | null
  category_id: string | null
  archived: boolean
  on_hand: number
  reserved: number
  available: number
  is_low: boolean
}

export interface OrderItem {
  id: string
  line_no: number
  platform_sku: string
  title: string | null
  product_id: string | null
  quantity: number
  listing_quantity: number
  unit_price: number | null
  reserved_qty: number
  returned_qty: number
  products: { sku: string; name: string; option_name: string } | null
}

export interface Order {
  id: string
  platform: Platform
  external_order_id: string
  source: 'api' | 'import' | 'sample'
  ordered_at: string
  buyer_name: string | null
  recipient_name: string | null
  total_amount: number | null
  status: OrderStatus
  marketplace_state: MarketplaceState
  marketplace_status: string | null
  tracking_number: string | null
  needs_attention: string | null
  packed_at: string | null
  packed_by: string | null
  shipped_at: string | null
  handover_id: string | null
  order_items: OrderItem[]
}

export interface Movement {
  id: number
  kind: MovementKind
  quantity: number
  delta_on_hand: number
  delta_reserved: number
  note: string | null
  created_at: string
  order_id: string | null
  products: { sku: string } | null
  orders: { external_order_id: string } | null
  profiles: { display_name: string } | null
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

export interface Notice {
  id: number
  kind: 'new_order' | 'low_stock' | 'handover_overdue' | 'storage_full' | string
  title: string
  body: string
  url: string
  created_at: string
}

export interface Category {
  id: string
  name: string
}

export interface Shop {
  id: string
  name: string
  contact: string | null
  phone: string | null
  address: string | null
}

export interface ShopStockLine {
  product_id: string
  qty: number
  products: { sku: string; name: string; option_name: string } | null
}

export interface ShopDoc {
  id: string
  no: number
  kind: 'send' | 'return'
  note: string | null
  created_at: string
  shop_id: string
  profiles: { display_name: string } | null
}

export interface ShopMove {
  id: number
  kind: 'send' | 'sold' | 'return' | 'adjust'
  qty: number
  note: string | null
  created_at: string
  doc_id: string | null
  products: { sku: string; option_name: string; name: string } | null
  profiles: { display_name: string } | null
}

export interface PackagingItem {
  id: string
  name: string
  kind: string
  qty: number
  unit_price: number
  note: string | null
}

export interface DesignFile {
  id: string
  name: string
  path: string
  size: number
  mime: string | null
  note: string | null
  created_at: string
  profiles: { display_name: string } | null
  url?: string
  downloadUrl?: string
}
