import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
import { getShopDoc } from '@/lib/data'
import { docNo } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const dateTh = (iso: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

/** Printable delivery note (ใบส่งของ) / return note (ใบรับคืน) for a consignment shop. */
export default async function ShopDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [data, logo] = await Promise.all([
    getShopDoc(id),
    createClient().then((sb) => sb.from('app_settings').select('value').eq('key', 'logo_url').maybeSingle()),
  ])
  if (!data) notFound()
  const { doc, lines } = data
  const send = doc.kind === 'send'
  const total = lines.reduce((n, l) => n + l.qty, 0)
  const logoUrl = (logo.data?.value as string | undefined) ?? null

  return (
    <main className="printdoc">
      <div className="noprint printbar"><PrintButton /><span className="small muted">ตั้งค่ากระดาษ A4 แนวตั้ง</span></div>
      <article className="sheetA4">
        <header className="pd-h">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="PET-FRIENDLY" className="pd-logo" /> : <div className="logo pd-logo" role="img" aria-label="PET-FRIENDLY" />}
          <div style={{ textAlign: 'right' }}>
            <h1>{send ? 'ใบส่งของ (ฝากขาย)' : 'ใบรับคืนสินค้า (ฝากขาย)'}</h1>
            <div>เลขที่ <b className="mono">{docNo(doc)}</b></div>
            <div>วันที่ {dateTh(doc.created_at)}</div>
          </div>
        </header>

        <section className="pd-to">
          <div className="pd-k">{send ? 'ส่งถึง' : 'รับคืนจาก'}</div>
          <div><b>{doc.shops?.name}</b></div>
          {doc.shops?.address && <div>{doc.shops.address}</div>}
          {(doc.shops?.contact || doc.shops?.phone) && <div>{[doc.shops?.contact, doc.shops?.phone && `โทร ${doc.shops.phone}`].filter(Boolean).join(' · ')}</div>}
        </section>

        <table className="pd-t">
          <thead><tr><th style={{ width: 48 }}>ลำดับ</th><th style={{ width: 130 }}>รหัสสินค้า</th><th>รายการ</th><th style={{ width: 90, textAlign: 'right' }}>จำนวน (ชิ้น)</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}><td>{i + 1}</td><td className="mono">{l.products?.sku}</td><td>{l.products?.name}{l.products?.option_name && ` · ${l.products.option_name}`}</td><td style={{ textAlign: 'right' }}>{l.qty}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3} style={{ textAlign: 'right' }}><b>รวม</b></td><td style={{ textAlign: 'right' }}><b>{total}</b></td></tr></tfoot>
        </table>

        {doc.note && <p><b>หมายเหตุ:</b> {doc.note}</p>}
        <p className="small">{send ? 'สินค้าข้างต้นเป็นสินค้าฝากขาย กรรมสิทธิ์ยังเป็นของ PET-FRIENDLY จนกว่าจะขายได้' : 'รับสินค้าข้างต้นคืนเข้าคลัง PET-FRIENDLY เรียบร้อย'}</p>

        <footer className="pd-sign">
          <div><div className="pd-line" />ผู้ส่ง{send && doc.profiles?.display_name ? ` (${doc.profiles.display_name})` : ''}<br />วันที่ ........................</div>
          <div><div className="pd-line" />ผู้รับ{!send && doc.profiles?.display_name ? ` (${doc.profiles.display_name})` : ''}<br />วันที่ ........................</div>
        </footer>
      </article>
    </main>
  )
}
