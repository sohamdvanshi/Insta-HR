"use client"
import { API_BASE, BACKEND_BASE } from '@/lib/api'
import { tr, trError, useLocale } from '@/lib/localization'
import { readStoredUser } from '@/lib/storage'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ResumeLink = { id: string; resumeId?: string; url?: string; title?: string }
type Candidate = {
  id: string; userId: string; firstName?: string; lastName?: string; email?: string; phone?: string;
  headline?: string; summary?: string; currentLocation?: string; yearsOfExperience?: number;
  expectedSalary?: string | number; skills: string[]; industries: string[]; preferredLocations: string[];
  appliedLocations: string[]; jobTypes: string[]; resumes: ResumeLink[];
}
const emptyFilters = { keyword: '', location: '', jobType: '', industry: '', skills: '', minExperience: '', maxExperience: '', education: '', maxSalary: '' }
const fields = [
  ['keyword', 'Keyword', 'text'], ['location', 'City / location', 'text'],
  ['industry', 'Industry', 'text'], ['skills', 'Skills (comma separated)', 'text'],
  ['minExperience', 'Min Experience', 'number'], ['maxExperience', 'Maximum experience', 'number'],
  ['education', 'Education / qualification', 'text'], ['maxSalary', 'Maximum expected salary', 'number']
] as const
const jobTypes = [['full-time', 'Full-time'], ['part-time', 'Part-time'], ['internship', 'Internship'], ['contract', 'Contract'], ['remote', 'Remote']]

export default function EmployerCandidatesPage() {
  useLocale()
  const router = useRouter(), requestId = useRef(0)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const fetchCandidates = async (values = filters) => {
    const currentRequest = ++requestId.current
    const token = localStorage.getItem('token')
    if (!token) { router.replace('/login'); return }
    setError(''); setSearching(true)
    try {
      const params = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value))
      const query = params.toString()
      const response = await fetch(`${API_BASE}/employer/candidates${query ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (currentRequest !== requestId.current) return
      if (!response.ok || !data.success || !Array.isArray(data.data)) { setError(data.message || 'Failed to load candidates'); return }
      setCandidates(data.data)
    } catch {
      if (currentRequest === requestId.current) setError('Failed to load candidates')
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setSearching(false) }
    }
  }
  useEffect(() => {
    const user = readStoredUser()
    if (!localStorage.getItem('token')) { router.replace('/login'); return }
    if (user.role !== 'employer') { router.replace('/dashboard'); return }
    fetchCandidates(emptyFilters)
    return () => { requestId.current++ }
  }, [router])
  return <main className="min-h-screen bg-gray-50 pt-20 pb-12">
    <div className="max-w-7xl mx-auto px-6">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white my-6">
        <h1 className="text-3xl font-bold">{tr('Resume Databank')}</h1>
        <p className="mt-2 text-blue-100">{tr('One candidate, all available resumes.')}</p>
      </header>
      <form onSubmit={event => { event.preventDefault(); fetchCandidates() }} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fields.map(([key, label, type]) => <label key={key} className="text-sm font-medium text-gray-700">
            {tr(label)}
            <input type={type} placeholder={tr(label)} value={filters[key]} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
              onChange={event => setFilters(previous => ({ ...previous, [key]: event.target.value }))}
              className="block w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl font-normal" />
          </label>)}
          <label className="text-sm font-medium text-gray-700">{tr('Job type')}
            <select value={filters.jobType} onChange={event => setFilters(previous => ({ ...previous, jobType: event.target.value }))} className="block w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl font-normal">
              <option value="">{tr('All job types')}</option>
              {jobTypes.map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
            </select>
          </label>
        </div>
        <p className="text-sm text-gray-500 mt-4">{tr('City includes current location, preferred cities, and cities where the candidate has applied. All listed skills must match.')}</p>
        <div className="flex gap-3 mt-4">
          <button type="submit" disabled={searching} className="bg-blue-600 text-white rounded-xl px-5 py-2 disabled:opacity-50">{tr(searching ? 'Searching...' : 'Search Candidates')}</button>
          <button type="button" onClick={() => { setFilters(emptyFilters); fetchCandidates(emptyFilters) }} className="bg-gray-100 rounded-xl px-5 py-2">{tr('Clear Filters')}</button>
        </div>
      </form>
      {error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl mt-6">{trError(error)}</p>}
      <div aria-live="polite" aria-busy={loading || searching} className="my-6 text-gray-600">
        {loading ? tr('Loading candidates...') : <>{candidates.length} {tr('Candidates')}</>}
      </div>
      {!loading && !error && candidates.length === 0 && <div className="p-10 bg-white rounded-2xl text-center text-gray-500"><p>{tr('No candidates found')}</p><p className="mt-2 text-sm">{tr('Try changing your filters or search terms')}</p></div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {candidates.map(candidate => <article key={candidate.userId} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">{[candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.email || tr('Candidate')}</h2>
          <p className="text-sm text-gray-500">{candidate.email}</p>
          {candidate.headline && <p className="mt-2 text-gray-700">{candidate.headline}</p>}
          <dl className="text-sm text-gray-600 space-y-2 mt-4">
            <div><dt className="inline font-medium">{tr('Current location')}: </dt><dd className="inline">{candidate.currentLocation || '—'}</dd></div>
            {!!candidate.preferredLocations?.length && <div><dt className="inline font-medium">{tr('Preferred cities')}: </dt><dd className="inline">{candidate.preferredLocations.join(', ')}</dd></div>}
            {!!candidate.appliedLocations?.length && <div><dt className="inline font-medium">{tr('Applied cities')}: </dt><dd className="inline">{candidate.appliedLocations.join(', ')}</dd></div>}
            {!!candidate.jobTypes?.length && <div><dt className="inline font-medium">{tr('Preferred or applied job types')}: </dt><dd className="inline">{candidate.jobTypes.map(value => tr(jobTypes.find(([type]) => type === value)?.[1] || value)).join(', ')}</dd></div>}
            <div><dt className="inline font-medium">{tr('Experience')}: </dt><dd className="inline">{candidate.yearsOfExperience ?? 0} {tr('yrs')}</dd></div>
            {!!candidate.industries?.length && <div><dt className="inline font-medium">{tr('Industry')}: </dt><dd className="inline">{candidate.industries.join(', ')}</dd></div>}
          </dl>
          {candidate.summary && <p className="text-sm text-gray-600 mt-4">{candidate.summary}</p>}
          <div className="flex flex-wrap gap-2 my-4">{candidate.skills?.map(skill => <span key={skill.toLowerCase()} className="bg-blue-50 text-blue-700 text-xs rounded-full px-3 py-1">{skill}</span>)}</div>
          {!!candidate.resumes?.length && <details className="border-t border-gray-100 py-3">
            <summary className="cursor-pointer font-medium text-blue-700">{tr('Resumes')} ({candidate.resumes.length})</summary>
            <ul className="mt-3 space-y-2">{candidate.resumes.map(resume => <li key={resume.id}>
              <a href={resume.resumeId ? `/resume/share/${resume.resumeId}` : /^https?:\/\//i.test(resume.url || '') ? resume.url : `${BACKEND_BASE}/${(resume.url || '').replace(/^\/+/, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">{resume.title || tr('View Resume')}</a>
            </li>)}</ul>
          </details>}
          {candidate.email && <a href={`mailto:${candidate.email}`} className="text-purple-600 text-sm hover:underline">{tr('Contact Candidate')}</a>}
        </article>)}
      </div>
    </div>
  </main>
}
