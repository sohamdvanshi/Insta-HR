'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { candidateSession, getSector, resumeCatalog, resumeRequest } from '@/lib/resume'

export default function NewResumePage() {
  const router = useRouter()
  const [sector, setSector] = useState('general')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [creating, setCreating] = useState(false)
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    if (!candidateSession(window.location.pathname + window.location.search)) { setError('Please sign in with a candidate account to build resumes.'); return }
    const selected = new URLSearchParams(window.location.search).get('sector')
    if (selected) setSector(getSector(selected).id)
    resumeRequest('').then(data => { setAllowed(data.entitlement.canCreate); setReady(true) }).catch(error => setError(error.message))
  }, [])
  async function create() {
    if (creating || !allowed) return
    setCreating(true); setError('')
    try {
      const data = await resumeRequest('', { method: 'POST', body: JSON.stringify({ title: `${getSector(sector).label} Resume`, sector, template: getSector(sector).template }) })
      router.replace(`/resume/${data.data.id}`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create resume'); setCreating(false) }
  }
  return <main className="min-h-screen bg-gray-50 px-6 pt-24"><div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm"><Link href="/resume" className="text-blue-600">← My resumes</Link><h1 className="mt-4 text-2xl font-bold">Create your resume</h1><p className="my-4 text-gray-600">Your profile details will be copied into an editable draft. Your profile and other resumes will stay unchanged.</p><label htmlFor="sector" className="block font-medium">Choose your sector</label><select id="sector" className="my-3 w-full rounded-lg border p-3" value={sector} onChange={event => setSector(event.target.value)}>{resumeCatalog.sectors.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><p className="text-sm text-gray-600">{getSector(sector).hints[0]}</p><p className="my-4 text-sm">One saved resume is free. Active Premium or Enterprise unlocks additional resumes.</p>{error && <p role="alert" className="my-4 text-red-700">{error}</p>}{ready && !allowed ? <div className="rounded-lg bg-amber-50 p-4"><p>You already have your free resume. Edit it, or upgrade to create more.</p><Link className="font-semibold text-blue-700" href="/subscription">View Premium plan →</Link></div> : <button disabled={!ready || creating} onClick={create} className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-white disabled:opacity-50">{creating ? 'Creating…' : 'Create from my profile'}</button>}<Link className="mt-5 block text-blue-600" href="/resume/samples">Browse sample resumes</Link></div></main>
}
