'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { tr, useLocale } from '@/lib/localization'
import { readStoredUser } from '@/lib/storage'
import { getNavigation, isNavActive, type NavGroup, type NavItem } from '@/lib/navigation'

type NavUser = { email: string; role: string; firstName?: string; name?: string }
export default function Navbar() {
  const { language } = useLocale()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [user, setUser] = useState<NavUser | null>(null)
  const pathname = usePathname()
  const navRef = useRef<HTMLElement | null>(null)
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({})
  const navigation = getNavigation(user?.role)
  const close = () => { setOpen(null); setMobileOpen(false) }
  useEffect(() => {
    const stored = readStoredUser()
    setUser(typeof stored.email === 'string' && ['candidate', 'employer', 'admin', 'super_admin', 'trainer'].includes(stored.role) ? { email: stored.email, role: stored.role, firstName: typeof stored.firstName === 'string' ? stored.firstName : undefined, name: typeof stored.name === 'string' ? stored.name : undefined } : null)
    close()
  }, [pathname, language])
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (navRef.current && !navRef.current.contains(event.target as Node)) close() }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileOpen) triggers.current.mobile?.focus()
        else if (open) triggers.current[open]?.focus()
        setOpen(null); setMobileOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open, mobileOpen])
  function logout() {
    for (const key of ['token', 'user', 'authToken', 'accessToken', 'currentUser']) { localStorage.removeItem(key); sessionStorage.removeItem(key) }
    setUser(null); window.location.href = '/'
  }
  const link = (item: NavItem, dropdown = false) => {
    const active = isNavActive(pathname, item)
    return <Link key={item.href} href={item.href} onClick={close} aria-current={active ? 'page' : undefined} className={`${dropdown ? 'block rounded-lg px-3 py-2.5' : 'rounded-lg px-3 py-2'} text-sm ${active ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-700'}`}>{tr(item.label)}</Link>
  }
  function disclosure(group: NavGroup, mobile = false) {
    const id = `${mobile ? 'mobile-' : ''}${group.id}`, expanded = open === id
    const active = group.items.some(item => isNavActive(pathname, item))
    return <div key={id} className={mobile ? 'rounded-xl border border-gray-100' : 'relative'}>
      <button ref={node => { if (triggers.current) triggers.current[id] = node }} type="button" onClick={() => setOpen(expanded ? null : id)} aria-expanded={expanded} aria-controls={`nav-${id}`} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium ${mobile ? 'w-full' : ''} ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
        {tr(group.label)}<span aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {expanded && <div id={`nav-${id}`} className={mobile ? 'px-2 pb-2' : 'absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl'}>{group.items.map(item => link(item, true))}</div>}
    </div>
  }
  function account(mobile = false) {
    if (!user) return <div className="flex items-center gap-2">{link({ label: 'Login', href: '/login' })}<Link href="/register" onClick={close} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">{tr('Sign Up')}</Link></div>
    const id = mobile ? 'mobile-account' : 'account', expanded = open === id
    const active = navigation.account.some(item => isNavActive(pathname, item))
    return <div className={mobile ? 'rounded-xl border border-gray-100' : 'relative'}>
      <button ref={node => { if (triggers.current) triggers.current[id] = node }} type="button" onClick={() => setOpen(expanded ? null : id)} aria-expanded={expanded} aria-controls={`nav-${id}`} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left ${active ? 'bg-blue-50' : 'hover:bg-gray-50'} ${mobile ? 'w-full' : ''}`}>
        <div className="min-w-0"><p className="max-w-36 truncate text-sm font-semibold text-gray-900">{user.firstName || user.name || user.email}</p><p className="text-xs text-gray-500">{tr(user.role)}</p></div><span aria-hidden="true">⌄</span>
      </button>
      {expanded && <div id={`nav-${id}`} className={mobile ? 'px-2 pb-2' : 'absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-xl'}>
        <p className="break-all px-3 py-2 text-xs text-gray-500">{user.email}</p>{navigation.account.map(item => link(item, true))}
        <button type="button" onClick={logout} className="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50">{tr('Logout')}</button>
      </div>}
    </div>
  }
  return <nav ref={navRef} aria-label={tr('Main navigation')} className="fixed inset-x-0 top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
      <Link href={navigation.home} onClick={close} className="flex shrink-0 items-center gap-2"><span className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600" aria-hidden="true" /><span className="text-xl font-bold text-gray-900">{tr('InstaHire')}</span></Link>
      <div className="hidden items-center gap-1 xl:flex">{navigation.primary.map(item => link(item))}{navigation.groups.map(group => disclosure(group))}</div>
      <div className="hidden shrink-0 items-center gap-2 xl:flex"><LanguageSwitcher />{account()}</div>
      <button ref={node => { if (triggers.current) triggers.current.mobile = node }} type="button" onClick={() => { setMobileOpen(!mobileOpen); setOpen(null) }} aria-label={tr('Toggle menu')} aria-expanded={mobileOpen} aria-controls="mobile-navigation" className="rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-50 xl:hidden"><span aria-hidden="true">☰</span></button>
    </div>
    {mobileOpen && <div id="mobile-navigation" className="max-h-[calc(100dvh-4rem)] space-y-3 overflow-y-auto border-t border-gray-100 bg-white px-4 py-4 xl:hidden"><LanguageSwitcher /><div className="flex flex-col gap-1">{navigation.primary.map(item => link(item))}</div>{navigation.groups.map(group => disclosure(group, true))}{account(true)}</div>}
  </nav>
}
