import type { Metadata, Viewport } from 'next'
import { Anuphan, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const anuphan = Anuphan({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-anuphan', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'PET-FRIENDLY Backoffice',
  description: 'ระบบหลังบ้าน แพ็กสินค้า ออเดอร์ และสต็อก',
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

// Applies the saved theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${anuphan.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  )
}
