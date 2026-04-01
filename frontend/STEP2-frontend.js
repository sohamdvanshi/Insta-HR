const fs = require('fs');

// Create folder first
const dir = 'src/app/ai-screening';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('✅ Folder created: ' + dir);
}

const page = `'use client'
import { useState, useEffect } from 'react'

interface Candidate {
  applicationId: number
  applicationStatus: string
  name: string
  email: string
  photoUrl: string | null
  headline: string
  currentLocation: string
  yearsOfExperience: number
  resumeUrl: string | null
  scores: { skillMatch: number; experienceMatch: number; keywordRelevance: number; overall: number }
  matchedSkills: string[]
  missingSkills: string[]
  label: string
  labelColor: string
  appliedAt: string
}

interface Summary {
  total: number; excellent: number; good: number; partial: number; low: number
  avgScore: number; jobTitle: string; jobSkills: string[]; jobExpMin: number
}

interface Job { id: number; title: string; skills: string[] }

const LABEL: Record<string, { bg: string; text: string; border: string }> = {
  green:  { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  blue:   { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  yellow: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  red:    { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
}

function Ring({ v, size = 54 }: { v: number; size?: number }) {
  const c = v >= 80 ? '#10B981' : v >= 60 ? '#3B82F6' : v >= 40 ? '#F59E0B' : '#EF4444'
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, dash = (v / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={5}
        strokeDasharray={\`\${dash} \${circ - dash}\`} strokeLinecap="round" />
      <text x={size/2} y={size/2+5} textAnchor="middle"
        transform={\`rotate(90,\${size/2},\${size/2})\`}
        style={{ fontSize: 13, fontWeight: 700, fill: '#111827' }}>{v}</text>
    </svg>
  )
}

function Bar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{v}%</span>
      </div>
      <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99 }}>
        <div style={{ height: 6, borderRadius: 99, background: color, width: v + '%', transition: 'width 1s' }} />
      </div>
    </div>
  )
}

const sc = (v: number) => v >= 80 ? '#10B981' : v >= 60 ? '#3B82F6' : v >= 40 ? '#F59E0B' : '#EF4444'

export default function AIScreeningPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selJob, setSelJob] = useState<number | null>(null)
  const [results, setResults] = useState<Candidate[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    fetch('http://localhost:5000/api/v1/jobs/employer/mine', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json()).then(d => {
      if (d.success) setJobs(d.data || [])
      else setError('Could not load jobs: ' + (d.message || ''))
    }).catch(() => setError('Cannot connect to backend')).finally(() => setLoadingJobs(false))
  }, [])

  const screen = async (jobId: number) => {
    setSelJob(jobId); setLoading(true); setResults([]); setSummary(null); setError(''); setExpanded(null)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(\`http://localhost:5000/api/v1/ai/screen/\${jobId}\`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const d = await res.json()
      if (d.success) { setResults(d.data || []); setSummary(d.summary) }
      else setError(d.message || 'Screening failed')
    } catch { setError('Cannot connect to backend. Is it running on port 5000?') }
    setLoading(false)
  }

  const updateStatus = async (appId: number, status: string) => {
    const token = localStorage.getItem('token')
    await fetch(\`http://localhost:5000/api/v1/ai/application/\${appId}/status\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status })
    })
    setResults(prev => prev.map(r => r.applicationId === appId ? { ...r, applicationStatus: status } : r))
  }

  const filtered = filter === 'all' ? results : results.filter(r => r.labelColor === filter)

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC', paddingTop: 64, fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F, #1D4ED8)', padding: '36px 0 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 8px' }}>🤖 Phase 2 Feature</p>
          <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, margin: '0 0 6px' }}>AI Resume Screening</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: 14 }}>Rank candidates by skill match, experience & keyword relevance</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#DC2626', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Job picker */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E5E7EB', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Step 1 — Select a Job to Screen</h2>
          {loadingJobs && <p style={{ color: '#9CA3AF', fontSize: 14 }}>Loading your jobs...</p>}
          {!loadingJobs && jobs.length === 0 && (
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>No jobs found. <a href="/post-job" style={{ color: '#2563EB' }}>Post a job first →</a></p>
          )}
          {!loadingJobs && jobs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {jobs.map(job => (
                <button key={job.id} onClick={() => screen(job.id)}
                  style={{ padding: '14px 16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                    border: selJob === job.id ? '2px solid #2563EB' : '1.5px solid #E5E7EB',
                    background: selJob === job.id ? '#EFF6FF' : '#FAFAFA', transition: 'all 0.15s' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>{job.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {(job.skills || []).length > 0
                      ? (job.skills || []).slice(0,3).join(', ') + ((job.skills?.length || 0) > 3 ? \` +\${(job.skills?.length||0)-3} more\` : '')
                      : 'No skills listed'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 600, color: '#374151', margin: 0 }}>Screening candidates...</p>
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: '4px 0 0' }}>Analyzing skills, experience & keywords</p>
          </div>
        )}

        {/* Summary */}
        {summary && !loading && (
          <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)', borderRadius: 16, padding: 24, marginBottom: 16, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Results for</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{summary.jobTitle}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  Min exp: {summary.jobExpMin}yrs &nbsp;•&nbsp; Required skills: {summary.jobSkills.length}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                {[['Total', summary.total, '#94A3B8'], ['Excellent', summary.excellent, '#10B981'], ['Good', summary.good, '#3B82F6'], ['Avg Score', summary.avgScore + '%', '#F59E0B']].map(([l,v,c]) => (
                  <div key={String(l)} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: String(c) }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {results.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              ['all', \`All (\${results.length})\`],
              ['green', \`Excellent (\${results.filter(r=>r.labelColor==='green').length})\`],
              ['blue', \`Good (\${results.filter(r=>r.labelColor==='blue').length})\`],
              ['yellow', \`Partial (\${results.filter(r=>r.labelColor==='yellow').length})\`],
              ['red', \`Low (\${results.filter(r=>r.labelColor==='red').length})\`],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: filter === key ? '2px solid #2563EB' : '1.5px solid #E5E7EB',
                  background: filter === key ? '#2563EB' : '#fff',
                  color: filter === key ? '#fff' : '#374151' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Results list */}
        {!loading && filtered.map((c, idx) => {
          const ls = LABEL[c.labelColor]
          const open = expanded === c.applicationId
          return (
            <div key={c.applicationId} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #E5E7EB', marginBottom: 10, overflow: 'hidden', boxShadow: open ? '0 4px 20px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ height: 3, background: sc(c.scores.overall) }} />
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

                  {/* Rank + avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#E5E7EB',
                      color: idx < 3 ? '#000' : '#9CA3AF' }}>#{idx+1}</div>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {c.photoUrl ? <img src={c.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{c.name[0]?.toUpperCase()}</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{c.headline || c.email}</div>
                    </div>
                  </div>

                  {/* Ring + label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Ring v={c.scores.overall} />
                    <div>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ls.bg, color: ls.text, border: \`1px solid \${ls.border}\` }}>{c.label}</span>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{c.yearsOfExperience} yrs exp</div>
                    </div>
                  </div>

                  {/* Mini scores */}
                  <div style={{ display: 'flex', gap: 18, flex: 1 }}>
                    {[['Skills', c.scores.skillMatch], ['Exp', c.scores.experienceMatch], ['Keywords', c.scores.keywordRelevance]].map(([l, v]) => (
                      <div key={String(l)} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: sc(Number(v)) }}>{v}%</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
                    <select value={c.applicationStatus} onChange={e => updateStatus(c.applicationId, e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
                        color: ({ shortlisted:'#10B981', interview:'#3B82F6', hired:'#8B5CF6', rejected:'#EF4444' } as any)[c.applicationStatus] || '#6B7280' }}>
                      <option value="pending">Pending</option>
                      <option value="shortlisted">Shortlisted ✓</option>
                      <option value="interview">Interview 📅</option>
                      <option value="hired">Hired 🎉</option>
                      <option value="rejected">Rejected ✗</option>
                    </select>
                    <button onClick={() => setExpanded(open ? null : c.applicationId)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: open ? '#EFF6FF' : '#fff', color: open ? '#2563EB' : '#374151' }}>
                      {open ? 'Less ▲' : 'Details ▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {open && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Score Breakdown</p>
                        <Bar label="Skill Match"        v={c.scores.skillMatch}        color="#10B981" />
                        <Bar label="Experience Match"   v={c.scores.experienceMatch}   color="#3B82F6" />
                        <Bar label="Keyword Relevance"  v={c.scores.keywordRelevance}  color="#8B5CF6" />
                        <Bar label="Overall Score"      v={c.scores.overall}           color={sc(c.scores.overall)} />
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Matched Skills ✅</p>
                        {c.matchedSkills.length === 0
                          ? <p style={{ fontSize: 12, color: '#9CA3AF' }}>No skill matches</p>
                          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {c.matchedSkills.map(s => <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 600 }}>{s}</span>)}
                            </div>
                        }
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Skill Gaps ❌</p>
                        {c.missingSkills.length === 0
                          ? <p style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>All skills matched! 🎉</p>
                          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {c.missingSkills.map(s => <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: '#FEE2E2', color: '#991B1B', fontSize: 11, fontWeight: 600 }}>{s}</span>)}
                            </div>
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid #F3F4F6', alignItems: 'center' }}>
                      {c.currentLocation && <span style={{ fontSize: 12, color: '#6B7280' }}>📍 {c.currentLocation}</span>}
                      {c.resumeUrl && <a href={c.resumeUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid #BFDBFE' }}>📄 View Resume</a>}
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>Applied: {new Date(c.appliedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* No applications */}
        {!loading && selJob && results.length === 0 && !error && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontWeight: 600, color: '#374151', margin: 0 }}>No applications yet for this job</p>
            <p style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>Share your job to get applicants</p>
          </div>
        )}

      </div>
    </main>
  )
}
`;

fs.writeFileSync('src/app/ai-screening/page.tsx', page);
console.log('✅ FILE 5 created: src/app/ai-screening/page.tsx');

console.log('\n========================================');
console.log('✅ FRONTEND DONE!');
console.log('Run: npm run dev');
console.log('Visit: http://localhost:3000/ai-screening');
console.log('========================================');