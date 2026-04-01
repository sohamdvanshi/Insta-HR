const fs = require('fs');
const path = require('path');

// Create directory first
const dir = 'src/app/ai-screening';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('✅ Directory created: ' + dir);
}

const page = `'use client'
import { useState, useEffect } from 'react'

interface ScoreBreakdown {
  skillMatch: number
  experienceMatch: number
  keywordRelevance: number
  overall: number
}

interface Candidate {
  applicationId: number
  applicationStatus: string
  userId: number
  name: string
  email: string
  photoUrl: string | null
  headline: string
  currentLocation: string
  yearsOfExperience: number
  resumeUrl: string | null
  scores: ScoreBreakdown
  matchedSkills: string[]
  missingSkills: string[]
  label: string
  labelColor: string
  appliedAt: string
}

interface Summary {
  total: number
  excellent: number
  good: number
  partial: number
  low: number
  avgScore: number
  jobTitle: string
  jobSkills: string[]
  jobExpMin: number
}

interface Job {
  id: number
  title: string
  skills: string[]
  experienceMin: number
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  shortlisted: '#10B981',
  interview: '#3B82F6',
  hired: '#8B5CF6',
  rejected: '#EF4444',
  applied: '#6B7280',
  pending: '#6B7280',
}

const LABEL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  yellow: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  red: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
}

function ScoreRing({ value, size = 56, color }: { value: number; size?: number; color: string }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={\`\${dash} \${circ}\`} strokeLinecap="round" />
      <text x={size/2} y={size/2 + 5} textAnchor="middle"
        transform={\`rotate(90, \${size/2}, \${size/2})\`}
        style={{ fontSize: 13, fontWeight: 700, fill: '#111827' }}>
        {value}
      </text>
    </svg>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: '#F3F4F6', borderRadius: 999 }}>
        <div style={{ height: 6, borderRadius: 999, background: color, width: value + '%', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function AIScreeningPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<number | null>(null)
  const [results, setResults] = useState<Candidate[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [filter, setFilter] = useState<'all' | 'green' | 'blue' | 'yellow' | 'red'>('all')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    fetchJobs(token)
  }, [])

  const fetchJobs = async (token: string) => {
    setLoadingJobs(true)
    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs/employer/mine', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) setJobs(data.data || [])
    } catch { setError('Could not load jobs') }
    setLoadingJobs(false)
  }

  const runScreening = async (jobId: number) => {
    setLoading(true)
    setResults([])
    setSummary(null)
    setError('')
    setExpanded(null)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(\`http://localhost:5000/api/v1/ai/screen/\${jobId}\`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        setResults(data.data || [])
        setSummary(data.summary || null)
      } else {
        setError(data.message || 'Screening failed')
      }
    } catch {
      setError('Could not connect to server')
    }
    setLoading(false)
  }

  const updateStatus = async (applicationId: number, status: string) => {
    setUpdating(applicationId)
    const token = localStorage.getItem('token')
    try {
      await fetch(\`http://localhost:5000/api/v1/ai/application/\${applicationId}/status\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status })
      })
      setResults(prev => prev.map(r => r.applicationId === applicationId ? { ...r, applicationStatus: status } : r))
    } catch { setError('Status update failed') }
    setUpdating(null)
  }

  const filtered = filter === 'all' ? results : results.filter(r => r.labelColor === filter)
  const scoreColor = (v: number) => v >= 80 ? '#10B981' : v >= 60 ? '#3B82F6' : v >= 40 ? '#F59E0B' : '#EF4444'

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif", paddingTop: 64 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1D4ED8 100%)', padding: '40px 0 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase' }}>Phase 2 Feature</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", margin: 0, marginBottom: 6 }}>
            AI Resume Screening
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, margin: 0 }}>
            Automatically rank candidates by skill match, experience, and keyword relevance
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {/* Job Selector */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #E5E7EB', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Select a Job to Screen</h2>
          {loadingJobs ? (
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>Loading your jobs...</p>
          ) : jobs.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>No jobs posted yet. <a href="/post-job" style={{ color: '#2563EB' }}>Post a job first →</a></p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {jobs.map(job => (
                <button key={job.id} onClick={() => { setSelectedJob(job.id); runScreening(job.id); }}
                  style={{
                    padding: '14px 16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                    border: selectedJob === job.id ? '2px solid #2563EB' : '1.5px solid #E5E7EB',
                    background: selectedJob === job.id ? '#EFF6FF' : '#FAFAFA',
                    transition: 'all 0.15s'
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>{job.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {(job.skills || []).slice(0, 3).join(', ')}{(job.skills?.length || 0) > 3 ? \` +\${job.skills.length - 3} more\` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#DC2626', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 48, border: '1px solid #E5E7EB', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <p style={{ color: '#374151', fontWeight: 600, fontSize: 16 }}>Screening candidates...</p>
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>Analyzing skills, experience, and keyword relevance</p>
          </div>
        )}

        {/* Summary Bar */}
        {summary && !loading && (
          <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)', borderRadius: 16, padding: 24, marginBottom: 20, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Screening results for</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{summary.jobTitle}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  Required: {summary.jobExpMin}+ yrs exp • {summary.jobSkills.length} skills
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  { label: 'Total', value: summary.total, color: '#94A3B8' },
                  { label: 'Excellent', value: summary.excellent, color: '#10B981' },
                  { label: 'Good', value: summary.good, color: '#3B82F6' },
                  { label: 'Avg Score', value: summary.avgScore + '%', color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {results.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { key: 'all', label: \`All (\${results.length})\` },
              { key: 'green', label: \`Excellent (\${results.filter(r => r.labelColor === 'green').length})\` },
              { key: 'blue', label: \`Good (\${results.filter(r => r.labelColor === 'blue').length})\` },
              { key: 'yellow', label: \`Partial (\${results.filter(r => r.labelColor === 'yellow').length})\` },
              { key: 'red', label: \`Low (\${results.filter(r => r.labelColor === 'red').length})\` },
            ] as { key: typeof filter; label: string }[]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: filter === f.key ? '2px solid #2563EB' : '1.5px solid #E5E7EB',
                  background: filter === f.key ? '#2563EB' : '#fff',
                  color: filter === f.key ? '#fff' : '#374151',
                  transition: 'all 0.15s'
                }}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {filtered.length > 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((c, idx) => {
              const ls = LABEL_STYLES[c.labelColor]
              const isExpanded = expanded === c.applicationId
              return (
                <div key={c.applicationId}
                  style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #E5E7EB', overflow: 'hidden',
                    boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s' }}>

                  <div style={{ height: 3, background: scoreColor(c.scores.overall) }} />

                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>

                      {/* Rank + Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 180 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%',
                          background: idx < 3 ? ['#FFD700','#C0C0C0','#CD7F32'][idx] : '#E5E7EB',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: idx < 3 ? '#000' : '#9CA3AF', flexShrink: 0 }}>
                          #{idx + 1}
                        </div>
                        <div style={{ width: 42, height: 42, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {c.photoUrl
                            ? <img src={c.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{c.name[0]?.toUpperCase()}</span>
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{c.headline || c.email}</div>
                        </div>
                      </div>

                      {/* Score ring */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ScoreRing value={c.scores.overall} size={56} color={scoreColor(c.scores.overall)} />
                        <div>
                          <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: ls.bg, color: ls.text, border: \`1px solid \${ls.border}\` }}>
                            {c.label}
                          </div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{c.yearsOfExperience} yrs exp</div>
                        </div>
                      </div>

                      {/* Mini scores */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', gap: 20 }}>
                          {[
                            { label: 'Skills', v: c.scores.skillMatch },
                            { label: 'Exp', v: c.scores.experienceMatch },
                            { label: 'Keywords', v: c.scores.keywordRelevance },
                          ].map(s => (
                            <div key={s.label} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor(s.v) }}>{s.v}%</div>
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <select value={c.applicationStatus} disabled={updating === c.applicationId}
                          onChange={e => updateStatus(c.applicationId, e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 12,
                            fontWeight: 600, color: STATUS_COLORS[c.applicationStatus] || '#6B7280',
                            background: '#fff', cursor: 'pointer', outline: 'none' }}>
                          <option value="pending">Pending</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="interview">Interview</option>
                          <option value="hired">Hired</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <button onClick={() => setExpanded(isExpanded ? null : c.applicationId)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB',
                            background: isExpanded ? '#EFF6FF' : '#fff',
                            color: isExpanded ? '#2563EB' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {isExpanded ? 'Less ▲' : 'Details ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Score Breakdown</div>
                            <ScoreBar label="Skill Match" value={c.scores.skillMatch} color="#10B981" />
                            <ScoreBar label="Experience Match" value={c.scores.experienceMatch} color="#3B82F6" />
                            <ScoreBar label="Keyword Relevance" value={c.scores.keywordRelevance} color="#8B5CF6" />
                            <ScoreBar label="Overall Score" value={c.scores.overall} color={scoreColor(c.scores.overall)} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Matched Skills ✅</div>
                            {c.matchedSkills.length === 0
                              ? <p style={{ fontSize: 12, color: '#9CA3AF' }}>No matching skills found</p>
                              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {c.matchedSkills.map(s => (
                                    <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 600 }}>{s}</span>
                                  ))}
                                </div>
                            }
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Skill Gaps ❌</div>
                            {c.missingSkills.length === 0
                              ? <p style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>All skills matched! 🎉</p>
                              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {c.missingSkills.map(s => (
                                    <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: '#FEE2E2', color: '#991B1B', fontSize: 11, fontWeight: 600 }}>{s}</span>
                                  ))}
                                </div>
                            }
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                          {c.currentLocation && <span style={{ fontSize: 12, color: '#6B7280' }}>📍 {c.currentLocation}</span>}
                          {c.resumeUrl && (
                            <a href={c.resumeUrl} target="_blank" rel="noreferrer"
                              style={{ padding: '6px 14px', borderRadius: 8, background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid #BFDBFE' }}>
                              📄 View Resume
                            </a>
                          )}
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            Applied {new Date(c.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {results.length === 0 && selectedJob && !loading && !error && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 48, border: '1px solid #E5E7EB', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ color: '#374151', fontWeight: 600 }}>No applications yet for this job</p>
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>Share your job posting to get more applicants</p>
          </div>
        )}

      </div>
    </main>
  )
}
`;

fs.writeFileSync('src/app/ai-screening/page.tsx', page);
console.log('✅ AI Screening page created: src/app/ai-screening/page.tsx');

// Add navbar link
try {
  let navbar = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
  if (!navbar.includes('ai-screening')) {
    navbar = navbar.replace(
      /(<Link[^>]*href="\/employer\/profile"[^>]*>[\s\S]*?<\/Link>)/,
      '$1\n            {user?.role === \'employer\' && <Link href="/ai-screening" className={linkClass(\'/ai-screening\')}>AI Screening</Link>}'
    );
    fs.writeFileSync('src/components/Navbar.tsx', navbar);
    console.log('✅ AI Screening link added to Navbar');
  } else {
    console.log('ℹ️  Navbar already has AI Screening link');
  }
} catch(e) {
  console.log('⚠️  Could not update Navbar automatically — add link manually if needed');
}

console.log('\n✅ Done! Run: npm run dev');
console.log('Visit: http://localhost:3000/ai-screening');