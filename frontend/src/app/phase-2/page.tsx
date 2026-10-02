 'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
type Row = Record<string, any>
export default function Workspace() {
  const pathname = usePathname()
  const redemptionKey = useRef<{ points: string; key: string } | null>(null)
  const [role, setRole] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [profiles, setProfiles] = useState<Row[]>([])
  const [jobs, setJobs] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState(pathname.endsWith('/campaigns') ? 'campaigns' : pathname.endsWith('/payouts') ? 'payouts' : 'referrals')
  const [busy, setBusy] = useState(false)
  const staff = ['admin', 'super_admin'].includes(role)
  const payout = '/referrals/payouts'
  const campaigns = staff ? '/admin/campaigns' : '/employer/campaigns'
  const call = async (path: string, method = 'GET', body?: object) => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
    const response = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || 'Request failed')
    return result
  }
  const load = async () => {
    if (!role) return
    setBusy(true); setMessage(''); setRows([]); setProfiles([])
    try {
      if (tab === 'referrals') setRows((await call('/referrals/' + (staff ? 'admin' : role === 'candidate' ? 'my' : 'employer/tracking') + '?limit=200')).data)
      if (tab === 'campaigns') { setRows((await call(campaigns)).data); setJobs((await call(staff ? '/admin/jobs' : '/jobs/my')).data) }
      if (tab === 'payouts') {
        setRows((await call(payout + (staff ? '/admin/requests' : '/requests'))).data)
        if (staff) setProfiles((await call(payout + '/admin/profiles')).data)
        else { const r = await call(payout + '/profile'); setMessage(`Balance: ${r.balance} points. Rate: ${r.policy.valuePaise ?? 'not configured'} paise/point. Minimum: ${r.policy.minPoints}. Review: ${r.data?.reviewStatus || 'not submitted'}.`) }
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed') } finally { setBusy(false) }
  }
  useEffect(() => { try { setRole(JSON.parse(localStorage.getItem('user') || '{}').role || '') } catch { setMessage('Please log in') } }, [])
  useEffect(() => { void load() }, [role, tab])
  const act = async (path: string, method: string, body: object) => {
    if (!window.confirm('Submit this action?')) return
    setBusy(true)
    try { await call(path, method, body); if (path === payout + '/requests' && method === 'POST') redemptionKey.current = null; await load(); setMessage('Saved successfully') } catch (e) { setMessage(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  const form = (event: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(event.currentTarget).entries())
  const input = (name: string, label: string) => <label className="block" key={name}>{label}<input required name={name} className="ml-3 rounded border p-2" /></label>
  return <main className="mx-auto max-w-6xl space-y-5 px-6 pb-12 pt-24">
    <h1 className="text-3xl font-bold">Referrals and rewards</h1>
    <nav className="flex flex-wrap gap-4"><a href={staff ? '/admin' : '/dashboard'}>Dashboard</a><a href="/ai-screening">AI screening</a>{['referrals', ...(role !== 'candidate' ? ['campaigns'] : []), ...(role !== 'employer' ? ['payouts'] : [])].map(t => <button disabled={busy} key={t} onClick={() => setTab(t)} className="rounded border p-2">{t}</button>)}<button disabled={busy} onClick={() => void load()}>Refresh</button></nav>
    {!role && <a href="/login">Log in to continue</a>}
    {message && <p role="status" className="whitespace-pre-wrap">{message}</p>}
    {tab === 'referrals' && <><p>Showing up to 200 referrals. Credited loyalty points are not cash paid.</p>{rows.map(r => <article key={r.id} className="rounded border p-4"><p>{r.job?.title} · Candidate: {r.candidate?.email} · Referred by: {r.referrer?.email}</p><p>{r.status} · {r.rewardStatus} · {r.rewardPoints} points</p>{staff && r.status === 'hired' && !r.referralRewarded && <form onSubmit={e => { e.preventDefault(); const b = form(e); void act(`/referrals/applications/${r.id}/award`, 'POST', b) }}>{input('points', 'Reward points')}{input('reason', 'Audit reason')}<button disabled={busy}>Credit reward</button></form>}</article>)}</>}
    {tab === 'campaigns' && role !== 'candidate' && <><form className="space-y-3 rounded border p-5" onSubmit={e => { e.preventDefault(); void act(campaigns, 'POST', form(e)) }}><h2>Create campaign</h2><select required name="jobId" aria-label="Job">{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select><select name="audience" aria-label="Audience"><option value="referrers">Referrers</option><option value="applicants">Applicants</option></select><select name="recipientStatus" aria-label="Application status">{['applied', 'shortlisted', 'hired', 'rejected'].map(s => <option key={s}>{s}</option>)}</select><select name="template" aria-label="Template"><option value="referral_status">Referral status</option><option value="loyalty_balance">Loyalty balance</option></select><p>Templates personalize name, referral count, status, code and point balance. The loyalty-balance template is still limited to referrers/applicants of the selected job and status.</p><button disabled={busy}>Create draft</button></form>{rows.map(r => <article className="rounded border p-4" key={r.id}><p>{r.subject} · {r.audience} · {r.recipientStatus} · {r.status}</p><p>Recipients: {r.recipientCount}; sent: {r.sentCount}; failed: {r.failedCount}</p><p className="whitespace-pre-wrap">{r.message}</p><button disabled={busy || r.status !== 'draft'} onClick={() => void act(`${campaigns}/${r.id}/send`, 'POST', {})}>Confirm and send</button></article>)}</>}
    {tab === 'payouts' && <><p>Manual bank/document review only, not electronic Aadhaar verification. No bank transfer happens automatically. Do not enter or upload a full Aadhaar number here.</p>{role === 'candidate' && <><form className="space-y-3 rounded border p-5" onSubmit={e => { e.preventDefault(); const b = form(e); void act(payout + '/profile', 'PUT', { ...b, consent: b.consent === 'on' }) }}><h2>Bank and identity details</h2>{[['accountHolder', 'Account holder'], ['bankName', 'Bank name'], ['accountNumber', 'Account number'], ['ifsc', 'IFSC'], ['aadhaarLast4', 'Aadhaar last four digits only']].map(([n, l]) => input(n, l))}<label><input required type="checkbox" name="consent" /> I consent to encrypted bank storage and manual review for redemption.</label><button disabled={busy}>Submit for review</button></form><form onSubmit={e => { e.preventDefault(); const b = form(e); const points = String(b.points); if (redemptionKey.current?.points !== points) redemptionKey.current = { points, key: crypto.randomUUID() }; void act(payout + '/requests', 'POST', { ...b, idempotencyKey: redemptionKey.current.key }) }}>{input('points', 'Points to redeem')}<button disabled={busy}>Request redemption</button></form></>}
    {staff && profiles.map(p => <article key={p.userId} className="space-y-2 rounded border p-4"><p>User: {p.userId} · Bank ****{p.bankLast4} · Aadhaar ****{p.aadhaarLast4} · {p.reviewStatus}</p><button disabled={busy} onClick={async () => { try { const r = await call(`${payout}/admin/profiles/${p.userId}/bank`); window.alert(JSON.stringify(r.data, null, 2)) } catch (e) { setMessage(e instanceof Error ? e.message : 'Failed') } }}>View bank details (audited)</button>{p.reviewStatus === 'pending' && <form onSubmit={e => { e.preventDefault(); void act(`${payout}/admin/profiles/${p.userId}/review`, 'PATCH', { ...form(e), revision: p.revision }) }}><select name="decision" aria-label="Review decision"><option value="manual_approved">Approve manual review</option><option value="rejected">Reject</option></select>{input('bankEvidenceRef', 'Bank check evidence reference')}{input('identityEvidenceRef', 'Identity review evidence reference')}<button disabled={busy}>Record review</button></form>}</article>)}
    {rows.map(r => <article key={r.id} className="space-y-2 rounded border p-4"><p>Request: {r.id} · User: {r.userId} · {r.points} points · INR {(Number(r.amountPaise) / 100).toFixed(2)} · {r.status}</p>{staff && ['pending', 'approved'].includes(r.status) && <><button disabled={busy} onClick={async () => { try { const d = await call(`${payout}/admin/requests/${r.id}/bank`); window.alert(JSON.stringify(d.data, null, 2)) } catch (e) { setMessage(e instanceof Error ? e.message : 'Failed') } }}>View transfer bank snapshot</button><form onSubmit={e => { e.preventDefault(); void act(`${payout}/admin/requests/${r.id}`, 'PATCH', form(e)) }}><select name="status" aria-label="Redemption decision">{r.status === 'pending' ? <option value="approved">Approve</option> : <option value="paid">Record completed bank transfer</option>}<option value="rejected">Reject and refund points</option></select>{input('reason', 'Audit reason')}<input name="transferReference" aria-label="Actual bank transfer reference" placeholder="Actual transfer reference (required to mark paid)" /><button disabled={busy}>Record decision</button></form></>}</article>)}</>}
  </main>
}
