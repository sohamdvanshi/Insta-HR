'use client'
import { tr, useLocale } from '@/lib/localization'


import { useEffect, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const subscribe = (listener: () => void) => { window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener) }
const getRole = () => { try { return JSON.parse(localStorage.getItem('user') || '{}').role || '' } catch { return '' } }

export default function TrainerAccessGuard({ children }: { children: React.ReactNode }) {
  useLocale()

  const pathname = usePathname()
  const router = useRouter()
  const role = useSyncExternalStore(subscribe, getRole, () => '')
  const blocked = role === 'trainer' && !/^\/(trainer|training)(\/|$)/.test(pathname)
  useEffect(() => { if (blocked) router.replace('/trainer') }, [blocked, router])
  return blocked ? <main className="pt-24 text-center">{tr("Opening your training workspace...")}</main> : children
}
