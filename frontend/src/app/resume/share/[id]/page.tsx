'use client'
import { tr, trError, useLocale } from '@/lib/localization'


import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

const API_BASE = 'http://localhost:5000/api/v1'

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

export default function PublicResumePage() {
  useLocale()

  const params = useParams()
  const resumeId = params?.id as string

  const [resume, setResume] = useState<any>(emptyResume)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (resumeId) {
      fetchResume()
    }
  }, [resumeId])

  const fetchResume = async () => {
    try {
      setLoading(true)
      setError('')

      const res = await fetch(`${API_BASE}/resumes/public/${resumeId}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Resume not found')
      }

      const loaded = data.data || {}

      if (loaded.visibility !== 'link') {
        throw new Error('This resume is not publicly shared')
      }

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
      setError(err.message || 'Failed to load shared resume')
    } finally {
      setLoading(false)
    }
  }

  const cleanSkills = useMemo(
    () => resume.skills.filter((item: string) => item.trim()),
    [resume.skills]
  )

  const isModern = resume.template === 'modern'

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 pt-24 flex items-center justify-center">
        <p className="text-gray-400">{tr("Loading shared resume...")}</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 pt-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{tr("Resume unavailable")}</h1>
            <p className="text-gray-600 mb-6">{trError(error)}</p>
            <Link
              href="/"
              className="inline-block px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
            >{tr("Go Home")}</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">{tr("Shared Resume")}</p>
            <h1 className="text-2xl font-bold text-gray-900">
              {resume.title || 'Shared Resume'}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium capitalize">
              {resume.template || 'classic'}{tr(" template")}</span>

            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium">{tr("Link Shared")}</span>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            id="resume-sheet"
            className={isModern ? 'resume-sheet modern-template' : 'resume-sheet classic-template'}
          >
            {isModern ? (
              <div className="modern-layout">
                <aside className="modern-sidebar">
                  <div className="mb-8 avoid-break">
                    <h1 className="text-3xl font-bold leading-tight">
                      {resume.personalInfo.fullName || 'Your Name'}
                    </h1>
                    <p className="mt-2 text-base opacity-90">
                      {resume.personalInfo.jobTitle || 'Professional Title'}
                    </p>
                  </div>

                  <div className="resume-section avoid-break">
                    <h2 className="section-title sidebar-title">{tr("Contact")}</h2>
                    <div className="space-y-2 text-sm">
                      {resume.personalInfo.email ? <p>{resume.personalInfo.email}</p> : null}
                      {resume.personalInfo.phone ? <p>{resume.personalInfo.phone}</p> : null}
                      {resume.personalInfo.location ? <p>{resume.personalInfo.location}</p> : null}
                      {resume.personalInfo.linkedin ? <p>{resume.personalInfo.linkedin}</p> : null}
                      {resume.personalInfo.github ? <p>{resume.personalInfo.github}</p> : null}
                      {resume.personalInfo.website ? <p>{resume.personalInfo.website}</p> : null}
                    </div>
                  </div>

                  {cleanSkills.length > 0 ? (
                    <div className="resume-section avoid-break">
                      <h2 className="section-title sidebar-title">{tr("Skills")}</h2>
                      <div className="flex flex-wrap gap-2">
                        {cleanSkills.map((item: string, index: number) => (
                          <span key={index} className="modern-pill">
                            {tr(item)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {resume.languages.some((item: string) => item.trim()) ? (
                    <div className="resume-section avoid-break">
                      <h2 className="section-title sidebar-title">{tr("Languages")}</h2>
                      <div className="space-y-1 text-sm">
                        {resume.languages
                          .filter((item: string) => item.trim())
                          .map((item: string, index: number) => (
                            <p key={index}>{tr(item)}</p>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {resume.certifications.some((item: string) => item.trim()) ? (
                    <div className="resume-section avoid-break">
                      <h2 className="section-title sidebar-title">{tr("Certifications")}</h2>
                      <div className="space-y-1 text-sm">
                        {resume.certifications
                          .filter((item: string) => item.trim())
                          .map((item: string, index: number) => (
                            <p key={index}>{tr(item)}</p>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </aside>

                <section className="modern-main">
                  {resume.summary ? (
                    <div className="resume-section avoid-break">
                      <h2 className="section-title">{tr("Professional Summary")}</h2>
                      <p className="resume-paragraph">{resume.summary}</p>
                    </div>
                  ) : null}

                  {resume.experience.some((item: any) => item.jobTitle || item.company) ? (
                    <div className="resume-section">
                      <h2 className="section-title">{tr("Experience")}</h2>
                      <div className="space-y-5">
                        {resume.experience.map((item: any, index: number) => {
                          if (!item.jobTitle && !item.company) return null

                          const cleanBullets = (item.bullets || []).filter((b: string) =>
                            b.trim()
                          )

                          return (
                            <div key={index} className="exp-item avoid-break">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="resume-item-title">
                                    {item.jobTitle || 'Job Title'}
                                  </h3>
                                  <p className="resume-subtitle">
                                    {item.company}
                                    {tr(item.location ? ` • ${item.location}` : '')}
                                  </p>
                                </div>

                                <p className="resume-date">
                                  {item.startDate}
                                  {tr(item.startDate || item.endDate ? ' - ' : '')}
                                  {item.endDate || 'Present'}
                                </p>
                              </div>

                              {cleanBullets.length > 0 ? (
                                <ul className="resume-bullets">
                                  {cleanBullets.map((bullet: string, bulletIndex: number) => (
                                    <li key={bulletIndex}>{bullet}</li>
                                  ))}
                                </ul>
                              ) : item.description ? (
                                <p className="resume-paragraph mt-2">{item.description}</p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {resume.projects.some((item: any) => item.name) ? (
                    <div className="resume-section">
                      <h2 className="section-title">{tr("Projects")}</h2>
                      <div className="space-y-4">
                        {resume.projects.map((item: any, index: number) => {
                          if (!item.name) return null

                          return (
                            <div key={index} className="project-item avoid-break">
                              <h3 className="resume-item-title">{item.name}</h3>
                              {item.link ? <p className="resume-link">{item.link}</p> : null}
                              {item.description ? (
                                <p className="resume-paragraph mt-1">{item.description}</p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {resume.education.some((item: any) => item.institution || item.degree) ? (
                    <div className="resume-section">
                      <h2 className="section-title">{tr("Education")}</h2>
                      <div className="space-y-4">
                        {resume.education.map((item: any, index: number) => {
                          if (!item.institution && !item.degree) return null

                          return (
                            <div key={index} className="edu-item avoid-break">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="resume-item-title">
                                    {item.degree || 'Degree'}
                                    {tr(item.fieldOfStudy ? ` - ${item.fieldOfStudy}` : '')}
                                  </h3>
                                  <p className="resume-subtitle">{item.institution}</p>
                                </div>

                                <p className="resume-date">
                                  {item.startDate}
                                  {tr(item.startDate || item.endDate ? ' - ' : '')}
                                  {item.endDate}
                                </p>
                              </div>

                              {item.description ? (
                                <p className="resume-paragraph mt-1">{item.description}</p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            ) : (
              <div className="classic-layout">
                <header className="classic-header avoid-break">
                  <h1 className="classic-name">
                    {resume.personalInfo.fullName || 'Your Name'}
                  </h1>
                  <p className="classic-role">
                    {resume.personalInfo.jobTitle || 'Professional Title'}
                  </p>

                  <div className="classic-contact">
                    {resume.personalInfo.email ? <span>{resume.personalInfo.email}</span> : null}
                    {resume.personalInfo.phone ? <span>{resume.personalInfo.phone}</span> : null}
                    {resume.personalInfo.location ? (
                      <span>{resume.personalInfo.location}</span>
                    ) : null}
                    {resume.personalInfo.linkedin ? (
                      <span>{resume.personalInfo.linkedin}</span>
                    ) : null}
                    {resume.personalInfo.github ? <span>{resume.personalInfo.github}</span> : null}
                    {resume.personalInfo.website ? (
                      <span>{resume.personalInfo.website}</span>
                    ) : null}
                  </div>
                </header>

                {resume.summary ? (
                  <section className="resume-section avoid-break">
                    <h2 className="section-title">{tr("Professional Summary")}</h2>
                    <p className="resume-paragraph">{resume.summary}</p>
                  </section>
                ) : null}

                {resume.experience.some((item: any) => item.jobTitle || item.company) ? (
                  <section className="resume-section">
                    <h2 className="section-title">{tr("Experience")}</h2>
                    <div className="space-y-5">
                      {resume.experience.map((item: any, index: number) => {
                        if (!item.jobTitle && !item.company) return null

                        const cleanBullets = (item.bullets || []).filter((b: string) =>
                          b.trim()
                        )

                        return (
                          <div key={index} className="exp-item avoid-break">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="resume-item-title">
                                  {item.jobTitle || 'Job Title'}
                                </h3>
                                <p className="resume-subtitle">
                                  {item.company}
                                  {tr(item.location ? ` • ${item.location}` : '')}
                                </p>
                              </div>

                              <p className="resume-date">
                                {item.startDate}
                                {tr(item.startDate || item.endDate ? ' - ' : '')}
                                {item.endDate || 'Present'}
                              </p>
                            </div>

                            {cleanBullets.length > 0 ? (
                              <ul className="resume-bullets">
                                {cleanBullets.map((bullet: string, bulletIndex: number) => (
                                  <li key={bulletIndex}>{bullet}</li>
                                ))}
                              </ul>
                            ) : item.description ? (
                              <p className="resume-paragraph mt-2">{item.description}</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ) : null}

                {resume.projects.some((item: any) => item.name) ? (
                  <section className="resume-section">
                    <h2 className="section-title">{tr("Projects")}</h2>
                    <div className="space-y-4">
                      {resume.projects.map((item: any, index: number) => {
                        if (!item.name) return null

                        return (
                          <div key={index} className="project-item avoid-break">
                            <h3 className="resume-item-title">{item.name}</h3>
                            {item.link ? <p className="resume-link">{item.link}</p> : null}
                            {item.description ? (
                              <p className="resume-paragraph mt-1">{item.description}</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ) : null}

                {resume.education.some((item: any) => item.institution || item.degree) ? (
                  <section className="resume-section">
                    <h2 className="section-title">{tr("Education")}</h2>
                    <div className="space-y-4">
                      {resume.education.map((item: any, index: number) => {
                        if (!item.institution && !item.degree) return null

                        return (
                          <div key={index} className="edu-item avoid-break">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="resume-item-title">
                                  {item.degree || 'Degree'}
                                  {tr(item.fieldOfStudy ? ` - ${item.fieldOfStudy}` : '')}
                                </h3>
                                <p className="resume-subtitle">{item.institution}</p>
                              </div>

                              <p className="resume-date">
                                {item.startDate}
                                {tr(item.startDate || item.endDate ? ' - ' : '')}
                                {item.endDate}
                              </p>
                            </div>

                            {item.description ? (
                              <p className="resume-paragraph mt-1">{item.description}</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ) : null}

                {cleanSkills.length > 0 ? (
                  <section className="resume-section avoid-break">
                    <h2 className="section-title">{tr("Skills")}</h2>
                    <div className="classic-skills">
                      {cleanSkills.map((item: string, index: number) => (
                        <span key={index} className="classic-skill">
                          {tr(item)}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {resume.certifications.some((item: string) => item.trim()) ? (
                  <section className="resume-section avoid-break">
                    <h2 className="section-title">{tr("Certifications")}</h2>
                    <ul className="classic-list">
                      {resume.certifications
                        .filter((item: string) => item.trim())
                        .map((item: string, index: number) => (
                          <li key={index}>{tr(item)}</li>
                        ))}
                    </ul>
                  </section>
                ) : null}

                {resume.languages.some((item: string) => item.trim()) ? (
                  <section className="resume-section avoid-break">
                    <h2 className="section-title">{tr("Languages")}</h2>
                    <div className="classic-contact">
                      {resume.languages
                        .filter((item: string) => item.trim())
                        .map((item: string, index: number) => (
                          <span key={index}>{tr(item)}</span>
                        ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .resume-sheet {
          width: 210mm;
          min-height: 297mm;
          background: white;
          color: #111827;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }

        .classic-template {
          padding: 16mm 14mm;
        }

        .modern-template {
          padding: 0;
        }

        .classic-layout {
          display: block;
        }

        .classic-header {
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }

        .classic-name {
          font-size: 26px;
          font-weight: 800;
          line-height: 1.1;
        }

        .classic-role {
          font-size: 14px;
          color: #111827;
          margin-top: 4px;
          font-weight: 600;
        }

        .classic-contact {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          margin-top: 12px;
          font-size: 12px;
          color: #4b5563;
        }

        .classic-skills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .classic-skill {
          border: 1px solid #d1d5db;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
        }

        .classic-list {
          padding-left: 18px;
          font-size: 12px;
          line-height: 1.7;
          color: #111827;
        }

        .modern-layout {
          display: grid;
          grid-template-columns: 68mm 1fr;
          min-height: 297mm;
        }

        .modern-sidebar {
          background: #0f172a;
          color: white;
          padding: 18mm 12mm;
        }

        .modern-main {
          padding: 18mm 14mm;
        }

        .modern-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          font-size: 11px;
          line-height: 1.4;
        }

        .resume-section {
          margin-bottom: 14px;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .section-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 4px;
        }

        .sidebar-title {
          border-bottom-color: rgba(255, 255, 255, 0.25);
        }

        .resume-item-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
        }

        .resume-subtitle {
          font-size: 11.5px;
          color: #374151;
          margin-top: 2px;
        }

        .modern-sidebar .resume-subtitle {
          color: rgba(255, 255, 255, 0.75);
        }

        .resume-date {
          font-size: 10.5px;
          color: #4b5563;
          white-space: nowrap;
        }

        .resume-link {
          font-size: 12px;
          color: #2563eb;
          margin-top: 2px;
          word-break: break-word;
        }

        .resume-paragraph {
          font-size: 11.5px;
          line-height: 1.65;
          color: #111827;
          white-space: pre-line;
        }

        .resume-bullets {
          margin-top: 6px;
          padding-left: 16px;
          font-size: 11.5px;
          line-height: 1.6;
          color: #111827;
        }

        .resume-bullets li {
          margin-bottom: 4px;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .avoid-break,
        .exp-item,
        .edu-item,
        .project-item {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @media (max-width: 1280px) {
          .resume-sheet {
            width: 100%;
            min-height: auto;
          }

          .modern-layout {
            grid-template-columns: 1fr;
          }

          .modern-sidebar,
          .modern-main,
          .classic-template {
            padding: 24px;
          }
        }
      `}</style>
    </main>
  )
}