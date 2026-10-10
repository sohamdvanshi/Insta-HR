'use client'
import { tr, useLocale, locale } from '@/lib/localization'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { adminRequest, mutation } from '@/lib/adminApi'
import { AdminFrame, Notice, Pages, RecordFields, fieldStyle, primaryStyle, secondaryStyle } from './AdminShell'
type Kind = 'users' | 'jobs' | 'applications' | 'payments' | 'invoices' | 'audit'
const statuses: Record<string, string[]> = { jobs: ['draft', 'active', 'closed'], applications: ['applied', 'shortlisted', 'interview', 'rejected', 'hired'], payments: ['created', 'success', 'failed'], invoices: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] }
export default function AdminCollection({ kind, title, fixedRole = '' }: { kind: Kind; title: string; fixedRole?: string }) {
  useLocale()

  const [rows, setRows] = useState<any[]>([]), [pagination, setPagination] = useState<any>(), [page, setPage] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [draft, setDraft] = useState({ q: '', status: '', role: fixedRole, active: '', action: '', targetUserId: '' }), [filters, setFilters] = useState(draft), version = useRef(0)
  const [moderation, setModeration] = useState<Record<string, { status: string; reason: string }>>({})
  const load = async () => {
    const request = ++version.current; setBusy(true); setError('')
    try { const query = new URLSearchParams({ page: String(page), limit: '20' }); Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value) }); const result = await adminRequest(`/admin/workspace/${kind}?${query}`); if (version.current === request) { setRows(result.data); setPagination(result.pagination) } }
    catch (err) { if (version.current === request) { setRows([]); setPagination(undefined); setError((err as Error).message) } }
    finally { if (version.current === request) setBusy(false) }
  }
  useEffect(() => { load(); return () => { version.current++ } }, [page, filters, kind])
  const moderate = async (row: any) => {
    const changes = moderation[row.id]; if (!changes) return
    setBusy(true); setError(''); setSuccess('')
    try { await adminRequest(`/admin/workspace/jobs/${row.id}/status`, mutation('PATCH', changes)); setSuccess('Job status updated and recorded in the audit log.'); await load() }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const heading = (row: any) => row.email || row.title || row.job?.title || row.invoiceNumber || row.planName || row.action || row.id
  return <AdminFrame title={tr(title)} description={tr("Search and review platform records. Expand a record to view its details.")}><Notice error={error} success={success} />
    <form className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4" onSubmit={event => { event.preventDefault(); setPage(1); setFilters({ ...draft }) }}>
      {['users', 'jobs'].includes(kind) && <label>{tr("Search name, email, phone or company")}<input className={fieldStyle} value={draft.q} maxLength={200} onChange={event => setDraft({ ...draft, q: event.target.value })} /></label>}
      {kind === 'users' && !fixedRole && <label>{tr("Role")}<select className={fieldStyle} value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}><option value="">{tr("All roles")}</option>{['candidate', 'employer', 'trainer', 'admin', 'super_admin'].map(value => <option key={value} value={value}>{tr(value)}</option>)}</select></label>}
      {kind === 'users' && <label>{tr("Account status")}<select className={fieldStyle} value={draft.active} onChange={event => setDraft({ ...draft, active: event.target.value })}><option value="">{tr("All")}</option><option value="true">{tr("Active")}</option><option value="false">{tr("Inactive")}</option></select></label>}
      {statuses[kind] && <label>{tr("Status")}<select className={fieldStyle} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="">{tr("All statuses")}</option>{statuses[kind].map(value => <option key={value} value={value}>{tr(value)}</option>)}</select></label>}
      {kind === 'audit' && <><label>{tr("Action")}<input className={fieldStyle} value={draft.action} placeholder={tr("admin.user_access")} onChange={event => setDraft({ ...draft, action: event.target.value })} /></label><label>{tr("Target user ID")}<input className={fieldStyle} value={draft.targetUserId} onChange={event => setDraft({ ...draft, targetUserId: event.target.value })} /></label></>}
      <button disabled={busy} className={primaryStyle}>{tr("Apply filters")}</button><button type="button" disabled={busy} className={secondaryStyle} onClick={() => load()}>{tr("Refresh")}</button>
    </form>
    <Pages pagination={pagination} busy={busy} onPage={setPage} />{busy && <p role="status" className="mb-3">{tr("Loading records…")}</p>}{!busy && !rows.length && !error && <p className="rounded-xl border bg-white p-5">{tr("No matching records.")}</p>}
    <div className="space-y-3">{rows.map(row => <article key={row.id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{heading(row)}</h2><p className="mt-1 text-sm text-slate-600">{row.role || row.status || row.entityType} {tr(row.isActive !== undefined && `· ${row.isActive ? 'Active' : 'Inactive'}`)} {tr(row.amount !== undefined && `· ${row.currency || 'INR'} ${Number(row.amount).toLocaleString(locale())}`)}</p>{row.candidateProfile && <p className="text-sm">{row.candidateProfile.firstName} {row.candidateProfile.lastName}</p>}{row.employerProfile && <p className="text-sm">{row.employerProfile.companyName}</p>}{row.companyName && <p className="text-sm">{row.companyName}</p>}{row.user?.email && <p className="text-sm">{row.user.email}</p>}{row.candidate?.email && <Link className="text-sm text-blue-700 underline" href={`/admin/users/${row.candidate.id}`}>{row.candidate.email}</Link>}</div>{kind === 'users' && <Link href={`/admin/users/${row.id}`} className={secondaryStyle}>{tr("Open profile & activity")}</Link>}</div><details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-blue-700">{tr("Full record details")}</summary><div className="mt-4"><RecordFields data={row} /></div></details>
      {kind === 'jobs' && <form className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4" onSubmit={event => { event.preventDefault(); moderate(row) }}><label>{tr("Status")}<select className={fieldStyle} value={moderation[row.id]?.status || row.status} onChange={event => setModeration({ ...moderation, [row.id]: { reason: moderation[row.id]?.reason || '', status: event.target.value } })}>{statuses.jobs.map(value => <option key={value} value={value}>{tr(value)}</option>)}</select></label><label className="grow">{tr("Reason")}<input required minLength={5} maxLength={500} className={fieldStyle} value={moderation[row.id]?.reason || ''} onChange={event => setModeration({ ...moderation, [row.id]: { status: moderation[row.id]?.status || row.status, reason: event.target.value } })} /></label><button disabled={busy} className={primaryStyle}>{tr("Update status")}</button></form>}
    </article>)}</div><Pages pagination={pagination} busy={busy} onPage={setPage} />
  </AdminFrame>
}
