import { markHandedOver, recordReturn, unpackOrder } from '@/app/actions'
import { getOrder } from '@/lib/data'
import { PLATFORM, baht, when } from '@/lib/format'
import { ActionForm, Submit } from './ActionForm'
import { PlatformMark, Status } from './bits'
import { IconPack } from './icons'
import { SheetFrame } from './SheetFrame'
import Link from 'next/link'

export async function OrderSheet({ id, closeHref }: { id: string; closeHref: string }) {
  const data = await getOrder(id)
  if (!data) {
    return <SheetFrame closeHref={closeHref} head={<h2>ไม่พบออเดอร์</h2>}><p className="muted">ออเดอร์นี้อาจถูกลบหรือไม่มีสิทธิ์เข้าถึง</p></SheetFrame>
  }
  const { order: o, events, packedByName } = data
  const unmapped = o.order_items.filter((i) => !i.product_id)
  const open = o.status === 'pending' || o.status === 'packing'
  const canReturn = o.status === 'packed' || o.status === 'shipped'
  const returnable = o.order_items.filter((i) => i.product_id && i.returned_qty < i.quantity)

  return (
    <SheetFrame
      closeHref={closeHref}
      head={
        <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
          <PlatformMark p={o.platform} />
          <div><div className="xs muted">{PLATFORM[o.platform]}{o.source === 'sample' && ' · ออเดอร์ตัวอย่าง'}</div><h2 className="mono" style={{ fontSize: '1.05rem' }}>{o.external_order_id}</h2></div>
        </div>
      }
      foot={
        open && !unmapped.length && o.marketplace_state !== 'unpaid' ? (
          <><span className="small muted">สแกนใบปะหน้าที่สถานีแพ็กเพื่อเริ่ม</span><Link className="btn pri" href="/">ไปสถานีแพ็ก</Link></>
        ) : o.status === 'packed' ? (
          <><span className="small muted">ขนส่งมารับพัสดุแล้ว?</span>
            <ActionForm action={markHandedOver}><input type="hidden" name="order_id" value={o.id} /><Submit>ส่งมอบขนส่งแล้ว</Submit></ActionForm></>
        ) : undefined
      }
    >
      {unmapped.length > 0 && open && (
        <div className="note bad small">
          สินค้า <span className="mono">{unmapped.map((i) => i.platform_sku).join(', ')}</span> ยังไม่ผูกกับ SKU ในระบบ จึงยังไม่จองสต็อกและแพ็กไม่ได้ ·{' '}
          <Link className="link" href="/stock">ผูก SKU ที่หน้าสต็อก</Link>
        </div>
      )}
      {o.needs_attention === 'cancelled_after_pack' && <div className="note bad small">ลูกค้ายกเลิกหลังแพ็กแล้ว เมื่อได้ของคืน ให้บันทึกสินค้าคืนด้านล่าง</div>}

      <div className="group kvg">
        <div className="rowi noicon"><span className="k">สถานะ</span><span className="v"><Status s={o.status} /></span></div>
        <div className="rowi noicon"><span className="k">Marketplace</span><span className="v mono small">{o.marketplace_status ?? o.marketplace_state}</span></div>
        <div className="rowi noicon"><span className="k">ผู้รับ</span><span className="v">{o.recipient_name ?? o.buyer_name ?? '—'}</span></div>
        <div className="rowi noicon"><span className="k">เลขพัสดุ</span><span className="v mono">{o.tracking_number ?? <span className="muted">ยังไม่มี</span>}</span></div>
        <div className="rowi noicon"><span className="k">ยอด</span><span className="v"><b>{baht(o.total_amount)}</b></span></div>
        <div className="rowi noicon"><span className="k">สั่งเมื่อ</span><span className="v">{when(o.ordered_at)}</span></div>
        {o.packed_at && <div className="rowi noicon"><span className="k">แพ็กโดย</span><span className="v">{packedByName ?? '—'} · {when(o.packed_at)}</span></div>}
      </div>

      <div className="sect">
        <span className="cap">สินค้า</span>
        <div className="group">
          {o.order_items.sort((a, b) => a.line_no - b.line_no).map((i) => (
            <div className="rowi" key={i.id}>
              <span className="ic"><IconPack size={20} /></span>
              <div className="main">
                <div className="t1">{i.products ? i.products.option_name || i.products.name : <span className="flag">ยังไม่ผูก SKU</span>}</div>
                <div className="t2 mono">{i.products?.sku ?? `${PLATFORM[o.platform]} ${i.platform_sku}`}{i.returned_qty > 0 && ` · คืนแล้ว ${i.returned_qty}`}</div>
              </div>
              <b className="num">×{i.quantity}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="sect">
        <span className="cap">ประวัติ</span>
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}><div className="xs muted">{when(e.created_at)}{e.profiles?.display_name && ` · ${e.profiles.display_name}`}</div>{e.message}</li>
          ))}
        </ul>
      </div>

      {o.status === 'packed' && (
        <details className="formcard">
          <summary className="link bad">คืนสต็อก (แพ็กผิด)</summary>
          <ActionForm action={unpackOrder} className="sect">
            <input type="hidden" name="order_id" value={o.id} />
            <p className="small muted" style={{ margin: 0 }}>สินค้ากลับเข้าคลังและกลับเป็นยอดจอง ออเดอร์กลับไปเป็น “รอแพ็ก”</p>
            <div className="field"><label htmlFor="reason">เหตุผล</label><input id="reason" name="reason" className="input" required placeholder="เช่น หยิบกลิ่นผิด" /></div>
            <Submit>คืนสต็อก</Submit>
          </ActionForm>
        </details>
      )}

      {canReturn && returnable.length > 0 && (
        <details className="formcard">
          <summary className="link">บันทึกสินค้าคืน / ตีกลับ</summary>
          <ActionForm action={recordReturn} className="sect">
            <input type="hidden" name="order_id" value={o.id} />
            {returnable.map((i) => (
              <div key={i.id} className="sect" style={{ gap: 6 }}>
                <input type="hidden" name="item_id" value={i.id} />
                <div className="small"><span className="mono">{i.products?.sku}</span> · คืนได้อีก {i.quantity - i.returned_qty} ชิ้น</div>
                <div className="formrow">
                  <div className="field"><label htmlFor={`g${i.id}`}>สภาพดี คืนเข้าสต็อก</label><input id={`g${i.id}`} name={`good_${i.id}`} className="input" type="number" min={0} max={i.quantity - i.returned_qty} defaultValue={0} /></div>
                  <div className="field"><label htmlFor={`d${i.id}`}>ชำรุด ไม่คืนเข้าสต็อก</label><input id={`d${i.id}`} name={`damaged_${i.id}`} className="input" type="number" min={0} max={i.quantity - i.returned_qty} defaultValue={0} /></div>
                </div>
              </div>
            ))}
            <div className="field"><label htmlFor="rnote">หมายเหตุ</label><input id="rnote" name="note" className="input" placeholder="เช่น ลูกค้าตีกลับ กล่องบุบ" /></div>
            <Submit>บันทึกสินค้าคืน</Submit>
          </ActionForm>
        </details>
      )}
    </SheetFrame>
  )
}
