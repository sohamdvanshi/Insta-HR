'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ResumePreview from '@/components/resume/ResumePreview'
import { API_BASE, candidateSession, getSector, resumeCatalog, resumeRequest } from '@/lib/resume'
import { downloadResume } from '@/lib/resumeExport'


const emptyResume = {
  title: 'My Resume',
  template: 'classic',
  sector: 'general',
  visibility: 'private',
  isDefault: false,
  targetJobTitle: '',
  targetJobDescription: '',
  personalInfo: {
    fullName: '',
    email: '',
    phone: '',
    location: '',
    jobTitle: '',
    linkedin: '',
    github: '',
    website: ''
  },
  summary: '',
  experience: [
    {
      company: '',
      jobTitle: '',
      location: '',
      startDate: '',
      endDate: '',
      currentlyWorking: false,
      description: '',
      bullets: ['']
    }
  ],
  education: [
    {
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      description: ''
    }
  ],
  projects: [
    {
      name: '',
      link: '',
      description: ''
    }
  ],
  skills: [''],
  certifications: [''],
  languages: [''],
  status: 'draft'
}

export default function ResumeEditorPage() {
  const params = useParams()
  const router = useRouter()
  const resumeId = params?.id as string
  const pdfRef = useRef<HTMLDivElement>(null)

  const [resume, setResume] = useState<any>(emptyResume)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [generatingBulletsIndex, setGeneratingBulletsIndex] = useState<number | null>(null)
  const [optimizingATS, setOptimizingATS] = useState(false)
  const [atsData, setAtsData] = useState<any>({
    topKeywords: [],
    missingKeywords: [],
    recommendedSkills: [],
    summarySuggestions: [],
    bulletSuggestions: []
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!candidateSession(window.location.pathname)) {
      setError('Please sign in with a candidate account to edit resumes.'); setLoading(false); return
    }

    if (resumeId) {
      fetchResume()
    }
  }, [resumeId, router])

  const fetchResume = async () => {
    try {
      setLoading(true)
      setError('')

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/resumes/${resumeId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Resume not found')
      }

      const loaded = data.data || {}

      setResume({
        ...emptyResume,
        ...loaded,
        personalInfo: {
          ...emptyResume.personalInfo,
          ...(loaded.personalInfo || {})
        },
        experience:
          loaded.experience?.length > 0
            ? loaded.experience.map((exp: any) => ({
                ...exp,
                bullets: exp.bullets?.length ? exp.bullets : ['']
              }))
            : emptyResume.experience,
        education: loaded.education?.length ? loaded.education : emptyResume.education,
        projects: loaded.projects?.length ? loaded.projects : emptyResume.projects,
        skills: loaded.skills?.length ? loaded.skills : emptyResume.skills,
        certifications: loaded.certifications?.length
          ? loaded.certifications
          : emptyResume.certifications,
        languages: loaded.languages?.length ? loaded.languages : emptyResume.languages,
        template: loaded.template || 'classic',
        sector: loaded.sector || 'general',
        visibility: loaded.visibility || 'private',
        isDefault: typeof loaded.isDefault === 'boolean' ? loaded.isDefault : false,
        targetJobTitle: loaded.targetJobTitle || '',
        targetJobDescription: loaded.targetJobDescription || ''
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load resume')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      setMessage('')

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/resumes/${resumeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(resume)
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save resume')
      }

      setMessage('Resume saved successfully')
      setTimeout(() => setMessage(''), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to save resume')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleCopyShareLink = async () => {
    try {
      setError('')
      setMessage('')

      if (!resumeId) {
        throw new Error('Please save the resume first')
      }

      if (resume.visibility !== 'link') {
        throw new Error('Set visibility to "link" before copying the share URL')
      }

      await handleSave()
      const shareUrl = `${window.location.origin}/resume/share/${resumeId}`

      await navigator.clipboard.writeText(shareUrl)

      setMessage('Share link copied to clipboard')
      setTimeout(() => setMessage(''), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to copy share link')
    }
  }

  const handleGenerateSummary = async () => {
    try {
      setGeneratingSummary(true)
      setError('')
      setMessage('')

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/ai/resume-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          personalInfo: resume.personalInfo,
          experience: resume.experience,
          education: resume.education,
          projects: resume.projects,
          skills: resume.skills,
          certifications: resume.certifications,
          languages: resume.languages,
          targetJobTitle: resume.targetJobTitle,
          targetJobDescription: resume.targetJobDescription
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate summary')
      }

      setResume((prev: any) => ({
        ...prev,
        summary: data.data.summary || ''
      }))

      setMessage('AI summary generated')
      setTimeout(() => setMessage(''), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to generate summary')
      throw err
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleGenerateSummaryAndSave = async () => {
    try {
      await handleGenerateSummary()
      setTimeout(() => {
        handleSave()
      }, 500)
    } catch {}
  }

  const handleGenerateExperienceBullets = async (index: number) => {
    try {
      setGeneratingBulletsIndex(index)
      setError('')
      setMessage('')

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/ai/experience-bullets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          experienceItem: resume.experience[index],
          skills: resume.skills,
          targetJobTitle: resume.targetJobTitle,
          targetJobDescription: resume.targetJobDescription
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate bullets')
      }

      const bullets = (data.data.bullets || []).filter((b: string) => b.trim())

      setResume((prev: any) => ({
        ...prev,
        experience: prev.experience.map((exp: any, i: number) =>
          i === index
            ? {
                ...exp,
                bullets: bullets.length ? bullets : ['']
              }
            : exp
        )
      }))

      setMessage(`AI bullets generated for experience ${index + 1}`)
      setTimeout(() => setMessage(''), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to generate bullets')
    } finally {
      setGeneratingBulletsIndex(null)
    }
  }

  const handleATSOptimize = async () => {
    try {
      setOptimizingATS(true)
      setError('')
      setMessage('')

      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/ai/ats-optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          personalInfo: resume.personalInfo,
          experience: resume.experience,
          education: resume.education,
          projects: resume.projects,
          skills: resume.skills,
          certifications: resume.certifications,
          languages: resume.languages,
          targetJobTitle: resume.targetJobTitle,
          targetJobDescription: resume.targetJobDescription
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to optimize for ATS')
      }

      setAtsData({
        topKeywords: data.data.topKeywords || [],
        missingKeywords: data.data.missingKeywords || [],
        recommendedSkills: data.data.recommendedSkills || [],
        summarySuggestions: data.data.summarySuggestions || [],
        bulletSuggestions: data.data.bulletSuggestions || []
      })

      setMessage('ATS suggestions generated')
      setTimeout(() => setMessage(''), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to optimize for ATS')
    } finally {
      setOptimizingATS(false)
    }
  }

  const addSkillIfMissing = (skill: string) => {
    const clean = skill.trim()
    if (!clean) return

    setResume((prev: any) => {
      const exists = prev.skills.some(
        (s: string) => s.trim().toLowerCase() === clean.toLowerCase()
      )
      if (exists) return prev

      return {
        ...prev,
        skills: [...prev.skills.filter((s: string) => s.trim()), clean]
      }
    })

    setMessage(`Added "${clean}" to skills`)
    setTimeout(() => setMessage(''), 2000)
  }

  const applySummarySuggestion = (text: string) => {
    const clean = text.trim()
    if (!clean) return

    setResume((prev: any) => ({
      ...prev,
      summary: clean
    }))

    setMessage('Summary suggestion applied')
    setTimeout(() => setMessage(''), 2000)
  }

  const appendSummarySuggestion = (text: string) => {
    const clean = text.trim()
    if (!clean) return

    setResume((prev: any) => {
      const current = (prev.summary || '').trim()
      if (!current) {
        return { ...prev, summary: clean }
      }

      if (current.toLowerCase().includes(clean.toLowerCase())) {
        return prev
      }

      return {
        ...prev,
        summary: `${current} ${clean}`
      }
    })

    setMessage('Summary suggestion added')
    setTimeout(() => setMessage(''), 2000)
  }

  const applyBulletSuggestionToExperience = (bullet: string, experienceIndex?: number) => {
    const clean = bullet.trim()
    if (!clean) return

    setResume((prev: any) => {
      const experience = [...prev.experience]
      let targetIndex = typeof experienceIndex === 'number' ? experienceIndex : -1

      if (targetIndex < 0) {
        targetIndex = experience.findIndex(
          (exp: any) => exp.jobTitle?.trim() || exp.company?.trim()
        )
        if (targetIndex < 0) targetIndex = 0
      }

      if (!experience[targetIndex]) return prev

      const currentBullets = (experience[targetIndex].bullets || []).filter((b: string) =>
        b.trim()
      )

      const exists = currentBullets.some(
        (b: string) => b.trim().toLowerCase() === clean.toLowerCase()
      )

      if (exists) return prev

      experience[targetIndex] = {
        ...experience[targetIndex],
        bullets: [...currentBullets, clean]
      }

      return {
        ...prev,
        experience
      }
    })

    setMessage('Achievement bullet applied')
    setTimeout(() => setMessage(''), 2000)
  }

  const applyRecommendedSkills = () => {
    setResume((prev: any) => {
      const merged = [...prev.skills.filter((s: string) => s.trim())]

      ;(atsData.recommendedSkills || []).forEach((skill: string) => {
        const clean = skill.trim()
        if (!clean) return

        const exists = merged.some(
          (s: string) => s.trim().toLowerCase() === clean.toLowerCase()
        )

        if (!exists) merged.push(clean)
      })

      return {
        ...prev,
        skills: merged
      }
    })

    setMessage('Recommended skills added')
    setTimeout(() => setMessage(''), 2000)
  }

  const applyATSSuggestionsSmartly = () => {
    setResume((prev: any) => {
      const next = { ...prev }

      const mergedSkills = [...(next.skills || []).filter((s: string) => s.trim())]

      ;[...(atsData.missingKeywords || []), ...(atsData.recommendedSkills || [])].forEach(
        (skill: string) => {
          const clean = skill.trim()
          if (!clean) return

          const exists = mergedSkills.some(
            (s: string) => s.trim().toLowerCase() === clean.toLowerCase()
          )

          if (!exists) mergedSkills.push(clean)
        }
      )

      next.skills = mergedSkills

      const firstSummarySuggestion = atsData.summarySuggestions?.[0]?.trim()
      if (firstSummarySuggestion) {
        next.summary = firstSummarySuggestion
      }

      if (atsData.bulletSuggestions?.length && next.experience?.length) {
        let targetIndex = next.experience.findIndex(
          (exp: any) => exp.jobTitle?.trim() || exp.company?.trim()
        )
        if (targetIndex < 0) targetIndex = 0

        if (next.experience[targetIndex]) {
          const currentBullets = (next.experience[targetIndex].bullets || []).filter((b: string) =>
            b.trim()
          )

          const mergedBullets = [...currentBullets]

          atsData.bulletSuggestions.forEach((bullet: string) => {
            const clean = bullet.trim()
            if (!clean) return

            const exists = mergedBullets.some(
              (b: string) => b.trim().toLowerCase() === clean.toLowerCase()
            )

            if (!exists) mergedBullets.push(clean)
          })

          next.experience[targetIndex] = {
            ...next.experience[targetIndex],
            bullets: mergedBullets.length ? mergedBullets : ['']
          }
        }
      }

      return next
    })

    setMessage('ATS suggestions applied to summary, skills, and achievements')
    setTimeout(() => setMessage(''), 2500)
  }

  const handleDownload = async (format: 'pdf' | 'jpg') => {
    if (downloading) return
    try {
      setDownloading(true); setError('')
      if (!pdfRef.current) throw new Error('Resume preview unavailable')
      await downloadResume(pdfRef.current, resume.title || 'resume', format)
      setMessage(`${format.toUpperCase()} downloaded successfully`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Export failed') }
    finally { setDownloading(false) }
  }

  const importProfile = async () => {
    if (!window.confirm('Replace personal details, summary, skills, education, and experience with your current profile? Other resume sections will stay unchanged.')) return
    try {
      const data = await resumeRequest('/profile-defaults')
      setResume((previous: any) => ({ ...previous, ...data.data, personalInfo: { ...previous.personalInfo, ...data.data.personalInfo } }))
      setMessage('Profile imported. Review and save your resume.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Profile import failed') }
  }

  const updatePersonalInfo = (field: string, value: string) => {
    setResume((prev: any) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value
      }
    }))
  }

  const updateArrayItem = (section: string, index: number, field: string, value: any) => {
    setResume((prev: any) => ({
      ...prev,
      [section]: prev[section].map((item: any, i: number) =>
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const addArrayItem = (section: string, item: any) => {
    setResume((prev: any) => ({
      ...prev,
      [section]: [...prev[section], item]
    }))
  }

  const removeArrayItem = (section: string, index: number) => {
    setResume((prev: any) => ({
      ...prev,
      [section]: prev[section].filter((_: any, i: number) => i !== index)
    }))
  }

  const updateSimpleList = (section: string, index: number, value: string) => {
    setResume((prev: any) => ({
      ...prev,
      [section]: prev[section].map((item: string, i: number) =>
        i === index ? value : item
      )
    }))
  }

  const addSimpleListItem = (section: string) => {
    setResume((prev: any) => ({
      ...prev,
      [section]: [...prev[section], '']
    }))
  }

  const removeSimpleListItem = (section: string, index: number) => {
    setResume((prev: any) => ({
      ...prev,
      [section]: prev[section].filter((_: string, i: number) => i !== index)
    }))
  }

  const updateBullet = (experienceIndex: number, bulletIndex: number, value: string) => {
    setResume((prev: any) => ({
      ...prev,
      experience: prev.experience.map((exp: any, i: number) =>
        i === experienceIndex
          ? {
              ...exp,
              bullets: exp.bullets.map((bullet: string, j: number) =>
                j === bulletIndex ? value : bullet
              )
            }
          : exp
      )
    }))
  }

  const addBullet = (experienceIndex: number) => {
    setResume((prev: any) => ({
      ...prev,
      experience: prev.experience.map((exp: any, i: number) =>
        i === experienceIndex
          ? {
              ...exp,
              bullets: [...(exp.bullets || []), '']
            }
          : exp
      )
    }))
  }

  const removeBullet = (experienceIndex: number, bulletIndex: number) => {
    setResume((prev: any) => ({
      ...prev,
      experience: prev.experience.map((exp: any, i: number) =>
        i === experienceIndex
          ? {
              ...exp,
              bullets:
                exp.bullets.length > 1
                  ? exp.bullets.filter((_: string, j: number) => j !== bulletIndex)
                  : ['']
            }
          : exp
      )
    }))
  }


  const hasATSData =
    atsData.topKeywords.length > 0 ||
    atsData.missingKeywords.length > 0 ||
    atsData.recommendedSkills.length > 0 ||
    atsData.summarySuggestions.length > 0 ||
    atsData.bulletSuggestions.length > 0


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading resume editor...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 pt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <Link href="/resume" className="text-sm text-blue-600 hover:underline">
              ← Back to My Resumes
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Resume Builder</h1>
            <p className="text-gray-500">
              Build, tailor, and download your resume as PDF or JPG
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateSummaryAndSave}
              disabled={generatingSummary}
              className="px-5 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50"
            >
              {generatingSummary ? 'Generating...' : 'AI Summary + Save'}
            </button>

            <button
              onClick={() => { void handleSave().catch(() => {}) }}
              disabled={saving}
              className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Resume'}
            </button>
            
            <button
              onClick={handleCopyShareLink}
              disabled={saving || !resumeId || resume.visibility !== 'link'}
              className="px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              Save & Copy Share Link
            </button>

            <button onClick={importProfile} className="px-5 py-3 rounded-xl border bg-white">Import profile</button>
            <button onClick={() => handleDownload('jpg')} disabled={downloading} className="px-5 py-3 rounded-xl bg-blue-700 text-white disabled:opacity-50">Download JPG</button>
            <button
              onClick={() => handleDownload('pdf')}
              disabled={downloading}
              className="px-5 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {message ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-6 no-pdf">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Resume Settings</h2>

              <div className="space-y-4">
                <input
                  value={resume.title}
                  onChange={(e) => setResume({ ...resume, title: e.target.value })}
                  placeholder="Resume title"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template
                  </label>

                  <select aria-label="Resume template" value={resume.template} onChange={event => setResume({ ...resume, template: event.target.value })} className="w-full rounded-xl border p-3">
                    <option value="classic">Classic</option><option value="modern">Modern</option>
                    {resumeCatalog.sectors.map(sector => <option key={sector.id} value={sector.template}>{sector.templateName}</option>)}
                  </select>
                  <p className="mt-2 text-sm text-gray-600">Sector layouts prioritise relevant sections. All templates are available for your first free resume.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sector
                  </label>
                  <select
                    value={resume.sector || 'general'}
                    onChange={(e) => setResume({ ...resume, sector: e.target.value, template: getSector(e.target.value).template })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="general">General</option>
                    <option value="information_technology">Information Technology</option>
                    <option value="sales_marketing">Sales & Marketing</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="retail">Retail</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="logistics">Logistics</option>
                    <option value="human_resources">Human Resources</option>
                  </select>
                </div>

                <aside className="rounded-xl bg-blue-50 p-4 text-sm">
                  <h3 className="font-semibold">{getSector(resume.sector).label} guidance</h3>
                  {getSector(resume.sector).hints.map(hint => <p className="mt-2" key={hint}>{hint}</p>)}
                  <details className="mt-3"><summary className="cursor-pointer font-medium">Example sections — adapt to your own background</summary>
                    <p className="mt-2"><strong>Summary:</strong> {getSector(resume.sector).examples.summary}</p>
                    <p className="mt-2"><strong>Skills:</strong> {getSector(resume.sector).examples.skills.join(', ')}</p>
                    <p className="mt-2"><strong>Experience:</strong> {getSector(resume.sector).examples.experience[0].description}</p>
                    <p className="mt-2"><strong>Education:</strong> {getSector(resume.sector).examples.education[0].degree}</p>
                  </details>
                  <Link className="mt-3 block text-blue-700 underline" href={`/resume/samples/${resume.sector || 'general'}-fresher`}>View sample</Link>
                </aside>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility
                  </label>
                  <select
                    value={resume.visibility || 'private'}
                    onChange={(e) => setResume({ ...resume, visibility: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="private">Private</option>
                    <option value="link">Anyone with the link</option>
                  </select>
                </div>

                <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!resume.isDefault}
                    onChange={(e) => setResume({ ...resume, isDefault: e.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Use as default resume</p>
                    <p className="text-xs text-gray-500 mt-1">
                      This resume will be used as your primary default resume in the system.
                    </p>
                  </div>
                </label>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="text-lg font-bold text-gray-900">Target Role</h2>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleATSOptimize}
                    disabled={optimizingATS}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {optimizingATS ? 'Analyzing...' : 'ATS Optimize'}
                  </button>

                  {hasATSData ? (
                    <button
                      type="button"
                      onClick={applyATSSuggestionsSmartly}
                      className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700"
                    >
                      Apply Suggestions
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <input
                  value={resume.targetJobTitle || ''}
                  onChange={(e) => setResume({ ...resume, targetJobTitle: e.target.value })}
                  placeholder="Target job title, e.g. Frontend Developer"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />

                <textarea
                  value={resume.targetJobDescription || ''}
                  onChange={(e) =>
                    setResume({ ...resume, targetJobDescription: e.target.value })
                  }
                  rows={7}
                  placeholder="Paste the job description here for ATS optimization and tailored AI writing"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </section>

            {hasATSData ? (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h2 className="text-lg font-bold text-gray-900">ATS Suggestions</h2>

                  {atsData.recommendedSkills.length > 0 ? (
                    <button
                      type="button"
                      onClick={applyRecommendedSkills}
                      className="px-3 py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-100"
                    >
                      Add Recommended Skills
                    </button>
                  ) : null}
                </div>

                <div className="space-y-5">
                  {atsData.topKeywords.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Top Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {atsData.topKeywords.map((item: string, index: number) => (
                          <span
                            key={index}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {atsData.missingKeywords.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">
                        Missing Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {atsData.missingKeywords.map((item: string, index: number) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => addSkillIfMissing(item)}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium hover:bg-amber-100"
                          >
                            + {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {atsData.recommendedSkills.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">
                        Recommended Skills
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {atsData.recommendedSkills.map((item: string, index: number) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => addSkillIfMissing(item)}
                            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium hover:bg-green-100"
                          >
                            + {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {atsData.summarySuggestions.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">
                        Summary Suggestions
                      </h3>

                      <div className="space-y-3">
                        {atsData.summarySuggestions.map((item: string, index: number) => (
                          <div key={index} className="border border-gray-200 rounded-xl p-3">
                            <p className="text-sm text-gray-700">{item}</p>

                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => applySummarySuggestion(item)}
                                className="px-3 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700"
                              >
                                Replace Summary
                              </button>

                              <button
                                type="button"
                                onClick={() => appendSummarySuggestion(item)}
                                className="px-3 py-2 bg-violet-50 text-violet-700 text-sm font-semibold rounded-lg hover:bg-violet-100"
                              >
                                Append to Summary
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {atsData.bulletSuggestions.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">
                        Bullet Suggestions
                      </h3>

                      <div className="space-y-3">
                        {atsData.bulletSuggestions.map((item: string, index: number) => (
                          <div key={index} className="border border-gray-200 rounded-xl p-3">
                            <p className="text-sm text-gray-700">{item}</p>

                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => applyBulletSuggestionToExperience(item)}
                                className="px-3 py-2 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-lg hover:bg-indigo-100"
                              >
                                Add to Achievements
                              </button>

                              {resume.experience.map((exp: any, expIndex: number) => (
                                <button
                                  key={expIndex}
                                  type="button"
                                  onClick={() =>
                                    applyBulletSuggestionToExperience(item, expIndex)
                                  }
                                  className="px-3 py-2 bg-gray-50 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100"
                                >
                                  Add to Exp {expIndex + 1}
                                  {exp.jobTitle ? `: ${exp.jobTitle}` : ''}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Basic Details</h2>

              <div className="space-y-4">
                <input
                  value={resume.personalInfo.fullName}
                  onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />

                <input
                  value={resume.personalInfo.jobTitle}
                  onChange={(e) => updatePersonalInfo('jobTitle', e.target.value)}
                  placeholder="Job title"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    value={resume.personalInfo.email}
                    onChange={(e) => updatePersonalInfo('email', e.target.value)}
                    placeholder="Email"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />

                  <input
                    value={resume.personalInfo.phone}
                    onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                    placeholder="Phone"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>

                <input
                  value={resume.personalInfo.location}
                  onChange={(e) => updatePersonalInfo('location', e.target.value)}
                  placeholder="Location"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    value={resume.personalInfo.linkedin}
                    onChange={(e) => updatePersonalInfo('linkedin', e.target.value)}
                    placeholder="LinkedIn URL"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />

                  <input
                    value={resume.personalInfo.github}
                    onChange={(e) => updatePersonalInfo('github', e.target.value)}
                    placeholder="GitHub URL"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />

                  <input
                    value={resume.personalInfo.website}
                    onChange={(e) => updatePersonalInfo('website', e.target.value)}
                    placeholder="Portfolio / Website"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Professional Summary
                    </label>

                    <button
                      type="button"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                      className="text-sm text-violet-600 font-semibold hover:underline disabled:opacity-50"
                    >
                      {generatingSummary ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>

                  <textarea
                    value={resume.summary}
                    onChange={(e) => setResume({ ...resume, summary: e.target.value })}
                    rows={5}
                    placeholder="Write a short professional summary"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Experience</h2>

                <button
                  type="button"
                  onClick={() =>
                    addArrayItem('experience', {
                      company: '',
                      jobTitle: '',
                      location: '',
                      startDate: '',
                      endDate: '',
                      currentlyWorking: false,
                      description: '',
                      bullets: ['']
                    })
                  }
                  className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-5">
                {resume.experience.map((item: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center gap-3">
                      <p className="font-medium text-gray-800">Experience {index + 1}</p>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleGenerateExperienceBullets(index)}
                          disabled={generatingBulletsIndex === index}
                          className="text-sm text-violet-600 font-semibold hover:underline disabled:opacity-50"
                        >
                          {generatingBulletsIndex === index ? 'Generating...' : 'Generate with AI'}
                        </button>

                        {resume.experience.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeArrayItem('experience', index)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <input
                      value={item.jobTitle}
                      onChange={(e) =>
                        updateArrayItem('experience', index, 'jobTitle', e.target.value)
                      }
                      placeholder="Job title"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <input
                      value={item.company}
                      onChange={(e) =>
                        updateArrayItem('experience', index, 'company', e.target.value)
                      }
                      placeholder="Company"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <input
                      value={item.location}
                      onChange={(e) =>
                        updateArrayItem('experience', index, 'location', e.target.value)
                      }
                      placeholder="Location"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={item.startDate}
                        onChange={(e) =>
                          updateArrayItem('experience', index, 'startDate', e.target.value)
                        }
                        placeholder="Start date"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                      />

                      <input
                        value={item.endDate}
                        onChange={(e) =>
                          updateArrayItem('experience', index, 'endDate', e.target.value)
                        }
                        placeholder="End date"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                      />
                    </div>

                    <textarea
                      value={item.description}
                      onChange={(e) =>
                        updateArrayItem('experience', index, 'description', e.target.value)
                      }
                      rows={3}
                      placeholder="Describe the role, work, tools, outcomes, or responsibilities"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <label className="text-sm font-medium text-gray-700">
                        Achievement Bullets
                      </label>

                      <button
                        type="button"
                        onClick={() => addBullet(index)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                      >
                        + Add Bullet
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(item.bullets || ['']).map((bullet: string, bulletIndex: number) => (
                        <div key={bulletIndex} className="flex gap-3">
                          <textarea
                            value={bullet}
                            onChange={(e) => updateBullet(index, bulletIndex, e.target.value)}
                            rows={2}
                            placeholder="Achievement bullet"
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                          />

                          <button
                            type="button"
                            onClick={() => removeBullet(index, bulletIndex)}
                            className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Education</h2>

                <button
                  type="button"
                  onClick={() =>
                    addArrayItem('education', {
                      institution: '',
                      degree: '',
                      fieldOfStudy: '',
                      startDate: '',
                      endDate: '',
                      description: ''
                    })
                  }
                  className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-5">
                {resume.education.map((item: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-gray-800">Education {index + 1}</p>

                      {resume.education.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeArrayItem('education', index)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <input
                      value={item.institution}
                      onChange={(e) =>
                        updateArrayItem('education', index, 'institution', e.target.value)
                      }
                      placeholder="Institution"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <input
                      value={item.degree}
                      onChange={(e) =>
                        updateArrayItem('education', index, 'degree', e.target.value)
                      }
                      placeholder="Degree"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <input
                      value={item.fieldOfStudy}
                      onChange={(e) =>
                        updateArrayItem('education', index, 'fieldOfStudy', e.target.value)
                      }
                      placeholder="Field of study"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={item.startDate}
                        onChange={(e) =>
                          updateArrayItem('education', index, 'startDate', e.target.value)
                        }
                        placeholder="Start date"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                      />

                      <input
                        value={item.endDate}
                        onChange={(e) =>
                          updateArrayItem('education', index, 'endDate', e.target.value)
                        }
                        placeholder="End date"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                      />
                    </div>

                    <textarea
                      value={item.description}
                      onChange={(e) =>
                        updateArrayItem('education', index, 'description', e.target.value)
                      }
                      rows={3}
                      placeholder="Additional details"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Projects</h2>

                <button
                  type="button"
                  onClick={() =>
                    addArrayItem('projects', {
                      name: '',
                      link: '',
                      description: ''
                    })
                  }
                  className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-5">
                {resume.projects.map((item: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-gray-800">Project {index + 1}</p>

                      {resume.projects.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeArrayItem('projects', index)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <input
                      value={item.name}
                      onChange={(e) => updateArrayItem('projects', index, 'name', e.target.value)}
                      placeholder="Project name"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <input
                      value={item.link}
                      onChange={(e) => updateArrayItem('projects', index, 'link', e.target.value)}
                      placeholder="Project link"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    <textarea
                      value={item.description}
                      onChange={(e) =>
                        updateArrayItem('projects', index, 'description', e.target.value)
                      }
                      rows={3}
                      placeholder="Project description"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Skills</h2>

              <div className="space-y-3">
                {resume.skills.map((skill: string, index: number) => (
                  <div key={index} className="flex gap-3">
                    <input
                      value={skill}
                      onChange={(e) => updateSimpleList('skills', index, e.target.value)}
                      placeholder="e.g. React"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    {resume.skills.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSimpleListItem('skills', index)}
                        className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addSimpleListItem('skills')}
                  className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                >
                  + Add Skill
                </button>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Certifications</h2>

              <div className="space-y-3">
                {resume.certifications.map((item: string, index: number) => (
                  <div key={index} className="flex gap-3">
                    <input
                      value={item}
                      onChange={(e) =>
                        updateSimpleList('certifications', index, e.target.value)
                      }
                      placeholder="Certification name"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    {resume.certifications.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSimpleListItem('certifications', index)}
                        className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addSimpleListItem('certifications')}
                  className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                >
                  + Add Certification
                </button>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Languages</h2>

              <div className="space-y-3">
                {resume.languages.map((item: string, index: number) => (
                  <div key={index} className="flex gap-3">
                    <input
                      value={item}
                      onChange={(e) => updateSimpleList('languages', index, e.target.value)}
                      placeholder="Language"
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />

                    {resume.languages.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSimpleListItem('languages', index)}
                        className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addSimpleListItem('languages')}
                  className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100"
                >
                  + Add Language
                </button>
              </div>
            </section>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <div ref={pdfRef} id="resume-sheet" style={{ width: 794 }}><ResumePreview resume={resume} /></div>
          </div>
        </div>
      </div>


    </main>
  )
}