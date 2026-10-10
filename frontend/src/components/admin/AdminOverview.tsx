'use client'
import { tr, useLocale, locale } from '@/lib/localization'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminRequest } from '@/lib/adminApi'
import { AdminFrame, Notice, useStaff, label } from './AdminShell'
export default function AdminOverview() {
  useLocale()

  const staff = useStaff(), [stats, setStats] = useState<Record<string, number> | null>(null), [error, setError] = useState('')
  useEffect(() => { adminRequest('/admin/workspace/summary').then(result => setStats(result.data)).catch(err => setError(err.message)) }, [])
  const cards = [['Candidates', 'Profiles, resumes, applications, training and deployment history.', '/admin/candidates'], ['Employers', 'Company profiles, jobs, applications and billing history.', '/admin/employers'], ['Support & internal communication', 'Assign tickets, discuss cases and attach private notes to records.', '/admin/communication'], ['Audit & fraud review', 'Review operational changes and suspicious application alerts.', '/admin/audit']]
  if (staff.role === 'super_admin') cards.push(['Staff & roles', 'Create internal team accounts and manage system access.', '/super-admin/staff'], ['Plans & perks', 'Manage displayed perks, prices and duration for new purchases.', '/super-admin/plans'], ['Feature flags', 'Enable or disable modules for portal users.', '/super-admin/feature-flags'], ['Infrastructure', 'Inspect database, search, cache and integration readiness.', '/super-admin/infrastructure'])
  return <AdminFrame title={tr(staff.role === 'super_admin' ? 'Super admin dashboard' : 'Admin dashboard')} description={tr("Review platform activity and open the tools for your team.")}><Notice error={error} />{!stats && !error && <p>{tr("Loading activity…")}</p>}{stats && <div className="mb-7 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(stats).map(([key, value]) => <div key={key} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-600">{tr(label(key))}</p><p className="mt-2 text-2xl font-bold">{tr(key === 'revenue' ? `₹${value.toLocaleString(locale())}` : value.toLocaleString(locale()))}</p></div>)}</div>}<div className="grid gap-4 sm:grid-cols-2">{cards.map(([title, description, href]) => <Link href={href} key={href} className="rounded-xl border bg-white p-5 hover:border-blue-400"><h2 className="font-semibold">{tr(title)}</h2><p className="mt-2 text-sm text-slate-600">{tr(description)}</p></Link>)}</div></AdminFrame>
}
