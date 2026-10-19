import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 24, rest: SVGProps<SVGSVGElement>) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...rest,
})

export const IconPack = ({ size, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 1.8, ...p })}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></svg>
)
export const IconOrders = ({ size, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 1.8, ...p })}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
)
export const IconStock = ({ size, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 1.8, ...p })}><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 9l2-5h14l2 5M10 13h4" /></svg>
)
export const IconScan = ({ size = 22, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 9v6M10 9v6M13 9v6M17 9v6" /></svg>
)
export const IconCheck = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2.4, ...p })}><path d="m5 12 4 4 10-10" /></svg>
)
export const IconSearch = ({ size = 17, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const IconBell = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
)
export const IconX = ({ size = 16, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2.4, ...p })}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconIn = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M12 4v12M6 10l6 6 6-6M5 20h14" /></svg>
)
export const IconOut = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M12 20V8M6 14l6-6 6 6M5 4h14" /></svg>
)
export const IconLock = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
)
export const IconChevron = ({ size = 16, ...p }: P) => (
  <svg className="chev" {...base(size, { strokeWidth: 2.4, ...p })}><path d="m9 6 6 6-6 6" /></svg>
)
export const IconCamera = ({ size = 20, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const IconCopy = ({ size = 16, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
)
export const IconWarehouse = ({ size, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 1.8, ...p })}><path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8M7 17h10" /></svg>
)
export const IconFile = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 1.8, ...p })}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
)
export const IconEdit = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
)
export const IconTrash = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
)
export const IconPlus = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2.2, ...p })}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconDownload = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2, ...p })}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
)
