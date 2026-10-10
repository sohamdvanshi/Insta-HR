'use client'
import { tr, trError, useLocale, locale } from '@/lib/localization'


import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Job {
  id: string
  title: string
  requiredSkills?: string[] | string
  skills?: string[] | string
  minExperienceYears?: number
}

interface Candidate {
  applicationId: string
  applicationStatus: string
  name: string
  email?: string
  headline?: string
  currentLocation?: string
  yearsOfExperience: number
  resumeUrl: string | null
  resumeFilename: string | null
  screeningComment: string
  matchedSkills: string[]
  missingSkills: string[]
  scores: {
    skillMatch: number
    experienceMatch: number
    keywordRelevance: number
    overall: number
  }
  label: string
  labelColor: 'green' | 'blue' | 'yellow' | 'red'
  appliedAt?: string
  photoUrl?: string | null
}

interface Summary {
  total: number
  excellent: number
  good: number
  partial: number
  low: number
  avgScore: number
  jobTitle: string
  jobSkills: string | string[]
  jobExpMin: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

const LABELS = {
  green: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  yellow: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  red: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' }
}

const STATUS_COLORS: Record<string, string> = {
  applied: '#2563EB',
  shortlisted: '#10B981',
  interview: '#3B82F6',
  hired: '#8B5CF6',
  rejected: '#EF4444'
}

function headers(includeJson = false): HeadersInit {
  const token = typeof window === 'undefined' ? null : localStorage.getItem('token')
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean)
  return []
}

function normalizeStatus(status?: string) {
  return !status || status === 'pending' ? 'applied' : status
}

function scoreColor(value: number) {
  if (value >= 80) return '#10B981'
  if (value >= 60) return '#3B82F6'
  if (value >= 40) return '#F59E0B'
  return '#EF4444'
}

function resumeUrl(value?: string | null) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `${BACKEND_BASE}${value.startsWith('/') ? value : `/${value}`}`
}

function normalizeCandidate(item: any): Candidate {
  const scores = item.scores || {}
  const overall = Number(item.aiScore ?? scores.overall ?? item.overall ?? 0)
  const color = item.labelColor || (overall >= 80 ? 'green' : overall >= 60 ? 'blue' : overall >= 40 ? 'yellow' : 'red')

  return {
    applicationId: String(item.applicationId ?? item.id),
    applicationStatus: normalizeStatus(item.applicationStatus ?? item.status),
    name: item.name || item.candidateName || item.candidate?.candidateProfile?.firstName || item.candidate?.email || 'Candidate',
    email: item.email || item.candidate?.email,
    headline: item.headline || item.candidate?.candidateProfile?.headline,
    currentLocation: item.currentLocation || item.candidate?.candidateProfile?.currentLocation,
    yearsOfExperience: Number(item.yearsOfExperience ?? item.candidate?.candidateProfile?.yearsOfExperience ?? 0),
    resumeUrl: item.resumeUrl ?? item.resumeURL ?? null,
    resumeFilename: item.resumeFilename ?? null,
    screeningComment: item.screeningComment || item.aiSummary || item.aiSummaryText || '',
    matchedSkills: toArray(item.matchedSkills),
    missingSkills: toArray(item.missingSkills),
    scores: {
      skillMatch: Number(item.skillMatch ?? scores.skillMatch ?? 0),
      experienceMatch: Number(item.experienceMatch ?? scores.experienceMatch ?? 0),
      keywordRelevance: Number(item.keywordRelevance ?? scores.keywordRelevance ?? 0),
      overall
    },
    label: item.label || (overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : overall >= 40 ? 'Partial' : 'Low'),
    labelColor: color,
    appliedAt: item.appliedAt || item.createdAt,
    photoUrl: item.photoUrl || item.candidate?.avatar || null
  }
}

function ScoreRing({ value }: { value: number }) {
  useLocale()

  const size = 58
  const radius = 25
  const circumference = 2 * Math.PI * radius
  const safe = Math.min(Math.max(value, 0), 100)
  const dash = safe / 100 * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 58 58" aria-label={tr("{{value0}}% overall match", { value0: Math.round(value) })}>
      <circle cx="29" cy="29" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="5" />
      <circle cx="29" cy="29" r={radius} fill="none" stroke={scoreColor(value)} strokeWidth="5" strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round" transform="rotate(-90 29 29)" />
      <text x="29" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">{Math.round(value)}</text>
    </svg>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  useLocale()

  const safe = Math.min(Math.max(value, 0), 100)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span>{tr(label)}</span><strong>{Math.round(value)}%</strong>
      </div>
      <div style={{ height: 7, background: '#F3F4F6', borderRadius: 99 }}>
        <div style={{ height: 7, width: `${safe}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  )
}

function AIScreeningContent() {
  useLocale()

  const searchParams = useSearchParams()
  const preselectedJobId = searchParams.get('jobId')
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [results, setResults] = useState<Candidate[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const screen = useCallback(async (jobId: string) => {
    setSelectedJobId(jobId)
    setLoading(true)
    setError('')
    setResults([])
    setSummary(null)
    setExpanded(null)

    try {
      const response = await fetch(`${API_BASE}/ai/screen/${jobId}`, { headers: headers() })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Screening failed')
      setResults((Array.isArray(data.data) ? data.data : []).map(normalizeCandidate))
      setSummary(data.summary || null)
    } catch (err: any) {
      setError(err.message || 'Could not connect to the backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      window.location.href = '/login'
      return
    }

    fetch(`${API_BASE}/jobs/my`, { headers: headers() })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Could not load jobs')
        return data
      })
      .then(data => {
        const loadedJobs: Job[] = Array.isArray(data.data) ? data.data : []
        setJobs(loadedJobs)
        const selected = loadedJobs.find(job => String(job.id) === String(preselectedJobId))
        if (selected) screen(String(selected.id))
      })
      .catch((err: any) => setError(err.message || 'Could not load jobs'))
      .finally(() => setLoadingJobs(false))
  }, [preselectedJobId, screen])

  const updateStatus = async (applicationId: string, status: string) => {
    setStatusUpdatingId(applicationId)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/ai/application/${applicationId}/status`, {
        method: 'PATCH',
        headers: headers(true),
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to update status')
      setResults(previous => previous.map(candidate => candidate.applicationId === applicationId ? { ...candidate, applicationStatus: status } : candidate))
    } catch (err: any) {
      setError(err.message || 'Failed to update application status')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const filteredResults = useMemo(() => filter === 'all' ? results : results.filter(candidate => candidate.labelColor === filter), [filter, results])
  const jobSkills = summary ? toArray(summary.jobSkills) : []

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC', paddingTop: 64, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: 'linear-gradient(135deg, #0F172A, #1D4ED8)', padding: '36px 24px 30px', color: '#FFF' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><p style={{ opacity: .65, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 8px' }}>{tr("Phase 2 Feature")}</p><h1 style={{ fontSize: 30, margin: '0 0 6px' }}>{tr("AI Resume Screening")}</h1><p style={{ opacity: .7, margin: 0 }}>{tr("Rank candidates by skills, experience, and keyword relevance.")}</p></div>
          <a href="/employer" style={{ alignSelf: 'center', color: '#FFF', textDecoration: 'none', padding: '10px 18px', border: '1px solid rgba(255,255,255,.25)', borderRadius: 10 }}>{tr("Back to Dashboard")}</a>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>{trError(error)}</div>}

        <section style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>{tr("Step 1: Select a Job to Screen")}</h2>
          {loadingJobs ? <p>{tr("Loading your jobs...")}</p> : jobs.length === 0 ? <p>{tr("No jobs found. ")}<a href="/post-job">{tr("Post a job first")}</a>.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {jobs.map(job => {
              const skills = toArray(job.requiredSkills || job.skills)
              const selected = selectedJobId === String(job.id)
              return <button key={job.id} type="button" onClick={() => screen(String(job.id))} style={{ textAlign: 'left', padding: 15, borderRadius: 12, cursor: 'pointer', border: selected ? '2px solid #7C3AED' : '1px solid #E5E7EB', background: selected ? '#F5F3FF' : '#FFF' }}><div style={{ fontWeight: 700 }}>{job.title}</div><div style={{ color: '#6B7280', fontSize: 12, marginTop: 5 }}>{tr(skills.length ? skills.slice(0, 3).join(', ') : 'No skills listed')}</div></button>
            })}
          </div>}
        </section>

        {loading && <section style={{ background: '#FFF', borderRadius: 16, padding: 48, textAlign: 'center' }}>{tr("Screening candidates...")}</section>}

        {!loading && summary && <section style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)', color: '#FFF', borderRadius: 16, padding: 24, marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}><div><small style={{ opacity: .6 }}>{tr("Results for")}</small><h2 style={{ margin: '5px 0' }}>{tr(summary.jobTitle)}</h2><small style={{ opacity: .6 }}>{tr("Min exp: ")}{summary.jobExpMin}{tr(" years · Required skills: ")}{jobSkills.length}</small></div><div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>{[[summary.total, 'Total', '#94A3B8'], [summary.excellent, 'Excellent', '#10B981'], [summary.good, 'Good', '#60A5FA'], [summary.partial, 'Partial', '#FBBF24'], [summary.avgScore, 'Avg Score', '#F59E0B']].map(([value, label, color]) => <div key={String(label)} style={{ textAlign: 'center' }}><div style={{ color: String(color), fontWeight: 800, fontSize: 23 }}>{tr(value)}</div><small style={{ opacity: .65 }}>{tr(label)}</small></div>)}</div></div></section>}

        {!loading && results.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>{[['all', 'All'], ['green', 'Excellent'], ['blue', 'Good'], ['yellow', 'Partial'], ['red', 'Low']].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} style={{ border: filter === key ? '2px solid #7C3AED' : '1px solid #E5E7EB', background: filter === key ? '#7C3AED' : '#FFF', color: filter === key ? '#FFF' : '#374151', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}>{tr(label)} {key === 'all' ? results.length : results.filter(item => item.labelColor === key).length}</button>)}</div>}

        {!loading && filteredResults.map((candidate, index) => {
          const palette = LABELS[candidate.labelColor]
          const isOpen = expanded === candidate.applicationId
          const fileUrl = resumeUrl(candidate.resumeUrl)
          const status = normalizeStatus(candidate.applicationStatus)

          return <article key={candidate.applicationId} style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 16, marginBottom: 10, overflow: 'hidden' }}><div style={{ height: 4, background: scoreColor(candidate.scores.overall) }} /><div style={{ padding: '16px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}><strong style={{ color: '#9CA3AF' }}>#{index + 1}</strong><div style={{ width: 42, height: 42, borderRadius: '50%', background: '#2563EB', color: '#FFF', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{tr(candidate.name[0]?.toUpperCase())}</div><div style={{ minWidth: 190, flex: 1 }}><div style={{ fontWeight: 800 }}>{candidate.name}</div><small style={{ color: '#6B7280' }}>{candidate.headline || candidate.email || tr('Candidate')}</small></div><ScoreRing value={candidate.scores.overall} /><span style={{ padding: '3px 10px', borderRadius: 20, background: palette.bg, color: palette.text, border: `1px solid ${palette.border}`, fontSize: 12, fontWeight: 700 }}>{tr(candidate.label)}</span><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><select value={status} disabled={statusUpdatingId === candidate.applicationId} onChange={event => updateStatus(candidate.applicationId, event.target.value)} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid #E5E7EB', color: STATUS_COLORS[status] || '#374151', fontWeight: 700 }}><option value="applied">{tr("Applied")}</option><option value="shortlisted">{tr("Shortlisted")}</option><option value="interview">{tr("Interview")}</option><option value="hired">{tr("Hired")}</option><option value="rejected">{tr("Rejected")}</option></select><button type="button" onClick={() => setExpanded(isOpen ? null : candidate.applicationId)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E5E7EB', background: isOpen ? '#F5F3FF' : '#FFF', cursor: 'pointer' }}>{tr(isOpen ? 'Less' : 'Details')}</button></div></div>{isOpen && <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 18, paddingTop: 18 }}>{candidate.screeningComment && <div style={{ background: '#F5F3FF', color: '#4C1D95', padding: 14, borderRadius: 12, marginBottom: 18 }}><strong>{tr("Why this candidate matches")}</strong><p style={{ margin: '7px 0 0' }}>{tr(candidate.screeningComment)}</p></div>}<div className="screening-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}><div><h4>{tr("Score Breakdown")}</h4><ScoreBar label="Skill Match" value={candidate.scores.skillMatch} color="#10B981" /><ScoreBar label="Experience Match" value={candidate.scores.experienceMatch} color="#3B82F6" /><ScoreBar label="Keyword Relevance" value={candidate.scores.keywordRelevance} color="#8B5CF6" /><ScoreBar label="Overall" value={candidate.scores.overall} color={scoreColor(candidate.scores.overall)} /></div><div><h4>{tr("Matched Skills")}</h4>{candidate.matchedSkills.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{candidate.matchedSkills.map((skill, skillIndex) => <span key={`${skill}-${skillIndex}`} style={{ background: '#D1FAE5', color: '#065F46', padding: '4px 9px', borderRadius: 20, fontSize: 12 }}>{skill}</span>)}</div> : <small>{tr("No skill matches found.")}</small>}</div><div><h4>{tr("Skill Gaps")}</h4>{candidate.missingSkills.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{candidate.missingSkills.map((skill, skillIndex) => <span key={`${skill}-${skillIndex}`} style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 9px', borderRadius: 20, fontSize: 12 }}>{skill}</span>)}</div> : <small style={{ color: '#059669' }}>{tr("All skills matched.")}</small>}</div></div><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, color: '#6B7280', fontSize: 13 }}><span>{tr(candidate.currentLocation || 'Location unavailable')}</span><span>{candidate.yearsOfExperience}{tr(" years experience")}</span>{fileUrl ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontWeight: 700 }}>{tr("View Uploaded Resume")}</a> : <span>{tr("No resume uploaded")}</span>}{candidate.resumeFilename && <span>{tr(candidate.resumeFilename)}</span>}{candidate.appliedAt && <span>{tr("Applied: ")}{tr(new Date(candidate.appliedAt).toLocaleDateString(locale()))}</span>}</div></div>}</div></article>
        })}

        {!loading && selectedJobId && results.length === 0 && !error && <section style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 48, textAlign: 'center' }}>{tr("No applications yet for this job.")}</section>}
      </div>
      <style jsx global>{`@media (max-width: 800px) { .screening-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  )
}

export default function AIScreeningPage() {
  useLocale()

  return <Suspense fallback={<main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>{tr("Loading...")}</main>}><AIScreeningContent /></Suspense>
}