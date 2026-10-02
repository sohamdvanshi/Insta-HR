 'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
type Job = { id: string; title: string }
type Result = { applicationId: string; applicationStatus: string; name: string; aiScore: number | null; aiStatus: string; screeningComment: string; matchedSkills: string[]; missingSkills: string[]; resumeUrl: string | null }
function Screening() {
  const params = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [rows, setRows] = useState<Result[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const call = async (path: string, method = 'GET', body?: object) => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
    const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.message || 'Request failed')
    return data
  }
  const load = async (id: string) => {
    setSelected(id); setBusy(true); setError(''); setRows([])
    try { setRows((await call(`/ai/screen/${id}`)).data || []) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  useEffect(() => {
    call('/jobs/my').then(data => { setJobs(data.data || []); const id = params.get('jobId'); if (id && data.data?.some((j: Job) => j.id === id)) void load(id) }).catch(e => setError(e.message))
  }, [params])
  const update = async (id: string, status: string) => {
    setBusy(true); setError('')
    try { await call(`/ai/application/${id}/status`, 'PATCH', { status }); setRows(previous => previous.map(x => x.applicationId === id ? { ...x, applicationStatus: status } : x)) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-6xl space-y-5 px-6 pb-12 pt-24">
    <h1 className="text-3xl font-bold">AI screening results</h1>
    <p>Scores and explanations below are the same stored resume-screening results shown to candidates. These support human review, not automatic hiring decisions.</p>
    <a href="/employer">Back to employer dashboard</a> · <a href="/phase-2">Referrals and rewards workspace</a>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <select aria-label="Job" disabled={busy} value={selected} onChange={e => void load(e.target.value)} className="w-full rounded border p-3"><option value="">Choose a job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
    {busy && <p>Loading...</p>}
    {!busy && selected && !rows.length && <p>No applications found.</p>}
    {rows.map(row => <article key={row.applicationId} className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{row.name}</h2>
      <p>Match score: {row.aiScore === null ? `Not available (${row.aiStatus})` : `${row.aiScore}/100`}</p>
      <p className="whitespace-pre-wrap">{row.screeningComment}</p>
      <p>Matched skills: {row.matchedSkills.join(', ') || 'None reported'}</p>
      <p>Missing skills: {row.missingSkills.join(', ') || 'None reported'}</p>
      {row.resumeUrl && /^https?:\/\//i.test(row.resumeUrl) ? <a className="text-blue-700 underline" href={row.resumeUrl} target="_blank" rel="noopener noreferrer">View Uploaded Resume</a> : <p>No resume link available</p>}
      <select aria-label={`Application status for ${row.name}`} value={row.applicationStatus} disabled={busy} onChange={e => void update(row.applicationId, e.target.value)} className="ml-4 rounded border p-2">{['applied', 'shortlisted', 'interview', 'hired', 'rejected'].map(s => <option key={s}>{s}</option>)}</select>
    </article>)}
  </main>
}
export default function Page() { return <Suspense fallback={<p>Loading...</p>}><Screening /></Suspense> }
