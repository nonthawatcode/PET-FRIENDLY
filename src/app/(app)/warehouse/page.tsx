import Link from 'next/link'
import { addPackagingKind, deleteDesignFile, deletePackaging, deletePackagingKind, renamePackagingKind, savePackaging, setCapItem } from '@/app/actions'
import { ActionForm, Submit } from '@/components/ActionForm'
import { DeleteButton, EditableList } from '@/components/Editable'
import { DesignUpload } from '@/components/DesignUpload'
import { IconCamera, IconDownload, IconFile, IconPlus } from '@/components/icons'
import { NewPackagingForm } from '@/components/NewPackagingForm'
import { PackagingAdjuster } from '@/components/PackagingAdjuster'
import { ProductImageUpload } from '@/components/ProductImageUpload'
import { SheetFrame } from '@/components/SheetFrame'
import { getCapItemId, getDesignFiles, getPackaging, getPackagingKinds } from '@/lib/data'
import { when } from '@/lib/format'
import type { PackagingItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

type SP = { tab?: string; item?: string; new?: string; kinds?: string }
const baht = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function PackagingForm({ item, kinds }: { item: PackagingItem; kinds: string[] }) {
  return (
    <ActionForm action={savePackaging} className="formcard">
      <input type="hidden" name="item_id" value={item.id} />
      <div className="field"><label htmlFor="pn">ชื่อ</label><input id="pn" name="name" className="input" defaultValue={item.name} required placeholder="เช่น ขวดแก้ว 50 ml" /></div>
      <div className="formrow">
        <div className="field"><label htmlFor="pk">ประเภท</label>
          <select id="pk" name="kind" className="input" defaultValue={item.kind}>{kinds.map((k) => <option key={k}>{k}</option>)}</select></div>
        <div className="field"><label htmlFor="pp">ราคาต่อชิ้น (บาท)</label><input id="pp" name="unit_price" className="input" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={item.unit_price ?? ''} /></div>
      </div>
      <div className="field"><label htmlFor="pnote">หมายเหตุ</label><input id="pnote" name="note" className="input" defaultValue={item.note ?? ''} placeholder="เช่น ผู้ขาย, สี, ขนาด" /></div>
      <Submit>บันทึก</Submit>
    </ActionForm>
  )
}

export default async function WarehousePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const design = sp.tab === 'design'
  const [items, files, capId, kinds] = await Promise.all([design ? Promise.resolve([]) : getPackaging(), design ? getDesignFiles() : Promise.resolve([]), getCapItemId(), getPackagingKinds()])
  const grouped = (list: PackagingItem[]) => kinds.filter((k) => list.some((i) => i.kind === k)).map((k) => (
    <optgroup key={k} label={k}>{list.filter((i) => i.kind === k).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>
  ))
  const open = sp.item ? items.find((i) => i.id === sp.item) : undefined

  return (
    <>
      <div className="lt"><div><h1>โกดัง</h1><p>ข้อมูลหลังบ้าน</p></div></div>
      <div className="seg" role="tablist" aria-label="หมวดโกดัง">
        <Link role="tab" aria-selected={!design} href="/warehouse" scroll={false}>Packaging</Link>
        <Link role="tab" aria-selected={design} href="/warehouse?tab=design" scroll={false}>Design</Link>
      </div>

      {!design && (
        <>
          <div className="sect-h"><span className="cap" style={{ padding: 0 }}>Packaging ในคลัง</span><Link className="fchip" href="/warehouse?kinds=1" scroll={false}>จัดการประเภท</Link></div>
          {kinds.filter((k) => items.some((i) => i.kind === k)).map((k) => (
            <div className="sect" key={k}>
              <span className="cap">{k}</span>
              <div className="group">
                {items.filter((i) => i.kind === k).map((i) => (
                  <Link key={i.id} className="rowi" href={`/warehouse?item=${i.id}`} scroll={false}>
                    <span className="pimg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {i.image_url ? <img src={i.image_url} alt="" loading="lazy" /> : <IconCamera size={18} />}
                    </span>
                    <div className="main"><div className="t1">{i.name}</div><div className="t2">{baht(i.unit_price)} บาท/ชิ้น{i.note && ` · ${i.note}`}</div></div>
                    <div className="trail"><b className="num">{i.qty.toLocaleString('th-TH')}</b><span className="xs muted">ชิ้น</span></div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {!items.length && <div className="group"><div className="empty-state">ยังไม่มีรายการ Packaging</div></div>}
          <Link className="btn ink" href="/warehouse?new=1" scroll={false}><IconPlus /> เพิ่ม Packaging</Link>
          <div className="sect">
            <span className="cap">ฝาที่ใช้กับทุกกลิ่น</span>
            <ActionForm action={setCapItem} className="formcard">
              <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                <select name="cap_id" className="input" defaultValue={capId ?? ''} aria-label="ฝาที่ใช้กับทุกกลิ่น" style={{ flex: 1 }}>
                  <option value="">— ยังไม่เลือก —</option>
                  {grouped(items)}
                </select>
                <Submit className="btn">บันทึก</Submit>
              </div>
              <p className="xs muted" style={{ margin: 0 }}>สินค้า 1 ขวด ใช้ขวด + ฝา + กล่อง อย่างละ 1 ชิ้น</p>
            </ActionForm>
          </div>
        </>
      )}

      {design && (
        <>
          <DesignUpload />
          <div className="group">
            {files.map((f) => (
              <div className="rowi" key={f.id}>
                <span className="dthumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.url ? <img src={f.url} alt="" loading="lazy" /> : <IconFile />}
                </span>
                <div className="main"><div className="t1" style={{ wordBreak: 'break-all' }}>{f.name}</div><div className="t2">{size(f.size)} · {when(f.created_at)}{f.profiles?.display_name && ` · ${f.profiles.display_name}`}</div></div>
                {f.downloadUrl && <a className="iconbtn" href={f.downloadUrl} aria-label={`ดาวน์โหลด ${f.name}`} title="ดาวน์โหลด"><IconDownload /></a>}
                <DeleteButton action={deleteDesignFile} fields={{ file_id: f.id }} label={f.name} />
              </div>
            ))}
            {!files.length && <div className="empty-state">ยังไม่มีไฟล์ดีไซน์</div>}
          </div>
        </>
      )}

      {sp.new && (
        <SheetFrame closeHref="/warehouse" head={<h2>เพิ่ม Packaging</h2>}>
          <NewPackagingForm kinds={kinds} />
        </SheetFrame>
      )}
      {sp.kinds && (
        <SheetFrame closeHref="/warehouse" head={<h2>ประเภท Packaging</h2>}>
          <EditableList items={kinds.map((k) => ({ key: k, name: k, sub: `${items.filter((i) => i.kind === k).length} รายการ` }))}
            add={addPackagingKind} rename={renamePackagingKind} remove={deletePackagingKind} field={{ id: 'old' }}
            addLabel="เพิ่มประเภท" placeholder="เช่น สติกเกอร์, ถุง" />
          <p className="xs muted" style={{ margin: 0 }}>ลบได้เฉพาะประเภทที่ไม่มีรายการ</p>
        </SheetFrame>
      )}
      {open && (
        <SheetFrame closeHref="/warehouse" head={<div><div className="xs muted">{open.kind}</div><h2>{open.name}</h2></div>}>
          <div className="trio" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><span className="xs muted">ในคลัง</span><b>{open.qty.toLocaleString('th-TH')}</b></div>
            <div><span className="xs muted">ราคาต่อชิ้น</span><b>{baht(open.unit_price)}</b></div>
          </div>
          <PackagingAdjuster id={open.id} qty={open.qty} />
          <span className="cap">แก้ไขข้อมูล</span>
          <ProductImageUpload productId={open.id} url={open.image_url} packaging />
          <PackagingForm item={open} kinds={kinds} />
          <DeleteButton action={deletePackaging} fields={{ item_id: open.id }} label={open.name} block />
        </SheetFrame>
      )}
    </>
  )
}
