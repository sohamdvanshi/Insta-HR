'use client'
import { tr, trError, useLocale, locale } from '@/lib/localization'

import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { adminRequest } from '@/lib/adminApi'

export type StaffUser = { id: string; email: string; role: string }
const Context = createContext<StaffUser>({ id: '', email: '', role: '' })
export const useStaff = () => useContext(Context)
export const fieldStyle = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900'
export const primaryStyle = 'rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50'
export const secondaryStyle = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 disabled:opacity-50'

export default function AdminShell({ children, superOnly = false }: { children: React.ReactNode; superOnly?: boolean }) {
  useLocale()

  const [staff, setStaff] = useState<StaffUser | null>(null), [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    adminRequest('/admin/workspace/me').then(result => {
      if (superOnly && result.data.role !== 'super_admin') { window.location.assign('/admin'); return }
      if (!cancelled) { setStaff(result.data); localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user') || '{}'), ...result.data })) }
    }).catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [superOnly])
  if (!staff) return <main className="px-6 pt-28"><p role={error ? 'alert' : undefined}>{tr(error || 'Checking admin access…')}</p>{error && <Link className="text-blue-700 underline" href="/login">{tr("Sign in with an admin account")}</Link>}</main>
  return <Context.Provider value={staff}>{children}</Context.Provider>
}
export function AdminFrame({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  useLocale()

  const staff = useStaff(), root = staff.role === 'super_admin' ? '/super-admin' : '/admin'
  const links = [['Overview', root], ['Candidates', '/admin/candidates'], ['Employers', '/admin/employers'], ['Jobs', '/admin/jobs'], ['Applications', '/admin/applications'], ['Payments', '/admin/payments'], ['Invoices', '/admin/invoices'], ['Support & notes', `${root}/communication`], ['Audit logs', `${root}/audit-logs`], ['Training', '/admin/training']]
  if (staff.role === 'super_admin') links.push(['Wage registers', '/super-admin/wage-register'], ['Staff & roles', '/super-admin/staff'], ['Plans', '/super-admin/plans'], ['Feature flags', '/super-admin/feature-flags'], ['Infrastructure', '/super-admin/infrastructure'])
  return <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-24 text-slate-900 sm:px-6"><div className="mx-auto max-w-7xl"><p className="text-sm text-blue-700">{tr(staff.role === 'super_admin' ? 'System control' : 'Insta-HR team')}</p><h1 className="mt-1 text-3xl font-bold">{tr(title)}</h1>{description && <p className="mt-2 text-slate-600">{tr(description)}</p>}<nav aria-label={tr("Admin tools")} className="my-6 flex flex-wrap gap-2">{links.map(([label, href]) => <Link key={label} href={href} className="rounded-lg border bg-white px-3 py-2 text-sm text-blue-800 hover:bg-blue-50">{tr(label)}</Link>)}</nav>{children}</div></main>
}
export function Notice({ error, success }: { error?: string; success?: string }) {
  useLocale()

  return <>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">{trError(error)}</p>}{success && <p role="status" className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{tr(success)}</p>}</>
}
export const label = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
export function RecordFields({ data, fieldKey = "" }: { data: unknown; fieldKey?: string }) {
  useLocale()

  if (data === null || data === undefined || data === '') return <span className="text-slate-500">—</span>
  if (Array.isArray(data)) return data.length ? <div className="space-y-2">{data.map((value, index) => <div key={index} className="rounded border bg-white p-2"><RecordFields data={value} fieldKey={fieldKey} /></div>)}</div> : <span className="text-slate-500">{tr("None")}</span>
  if (typeof data === 'object') return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(data as Record<string, unknown>).map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{tr(label(key))}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm"><RecordFields data={value} fieldKey={key} /></dd></div>)}</dl>
  if (typeof data === 'boolean') return <span>{tr(data ? 'Yes' : 'No')}</span>
  if (typeof data === 'string' && /^https?:\/\//i.test(data)) { try { const url = new URL(data); if (!url.username && !url.password) return <a href={url.href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{tr("Open link ↗")}</a> } catch { /* Display malformed values as text. */ } }
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(data) && !Number.isNaN(Date.parse(data))) return <span>{tr(new Date(data).toLocaleString(locale()))}</span>
  if (typeof data === "number") return <span>{new Intl.NumberFormat(locale()).format(data)}</span>
  return <span>{["role", "status", "mode", "jobType", "employmentType", "priority", "category", "plan", "subscriptionPlan", "manualReviewStatus", "actorRole", "industry", "sector", "experienceLevel", "billingType", "shiftType", "interviewStatus", "recipientStatus", "referralType", "bonusStatus"].includes(fieldKey) ? tr(String(data)) : String(data)}</span>
}
export function Pages({ pagination, onPage, busy = false }: { pagination?: { page: number; pages: number; total: number }; onPage: (page: number) => void; busy?: boolean }) {
  useLocale()

  if (!pagination) return null
  return <div className="my-4 flex flex-wrap items-center gap-3 text-sm"><span>{pagination.total}{tr(" records · Page ")}{pagination.page}{tr(" of ")}{Math.max(pagination.pages, 1)}</span><button className={secondaryStyle} disabled={busy || pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>{tr("Previous")}</button><button className={secondaryStyle} disabled={busy || pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>{tr("Next")}</button></div>
}
