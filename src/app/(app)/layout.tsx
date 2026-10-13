import Link from 'next/link'
import { Dock } from '@/components/Dock'
import { LiveRefresh } from '@/components/LiveRefresh'
import { IconBell, IconSearch } from '@/components/icons'
import { getShell } from '@/lib/data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const shell = await getShell()
  const name = shell.profile?.display_name || shell.profile?.email || 'ผู้ใช้'
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" aria-label="หน้าแรก">
            {shell.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo-img" src={shell.logoUrl} alt="PET-FRIENDLY" />
            ) : (
              <div className="logo" role="img" aria-label="PET-FRIENDLY" />
            )}
          </Link>
          <div className="sp" />
          <span className="chip warn" title="ยังไม่ได้เชื่อม API ของ Marketplace">ยังไม่เชื่อม Marketplace</span>
          <Link className="cbtn" href="/orders?focus=1" aria-label="ค้นหาออเดอร์" title="ค้นหาออเดอร์"><IconSearch size={18} /></Link>
          <Link className="cbtn" href="/stock" aria-label="สินค้าใกล้หมด" title="สินค้าใกล้หมด">
            <IconBell />{shell.lowCount > 0 && <span className="dot" />}
          </Link>
        </div>
      </header>
      {children}
      <Dock pending={shell.pendingCount} low={shell.lowCount} initials={initials(name)} />
      <LiveRefresh />
    </>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}
