'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import { API_BASE } from '@/lib/resume'
import ResumePreview from '@/components/resume/ResumePreview'

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



  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading shared resume...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100 pt-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Resume unavailable</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
            >
              Go Home
            </Link>
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
            <p className="text-sm text-gray-500">Shared Resume</p>
            <h1 className="text-2xl font-bold text-gray-900">
              {resume.title || 'Shared Resume'}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium capitalize">
              {resume.template || 'classic'} template
            </span>

            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium">
              Link Shared
            </span>
          </div>
        </div>

        <div className="overflow-x-auto"><ResumePreview resume={resume} /></div>
      </div>


    </main>
  )
}