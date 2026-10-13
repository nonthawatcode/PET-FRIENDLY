'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Re-renders server data when orders or stock change anywhere (Supabase Realtime). */
export function LiveRefresh() {
  const router = useRouter()
  useEffect(() => {
    const sb = createClient()
    let t: ReturnType<typeof setTimeout> | undefined
    const bump = () => { clearTimeout(t); t = setTimeout(() => router.refresh(), 500) }
    const ch = sb
      .channel('backoffice-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, bump)
      .subscribe()
    return () => { clearTimeout(t); sb.removeChannel(ch) }
  }, [router])
  return null
}
