'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ShareJobButton from '@/components/jobs/ShareJobButton'

interface Job {
  id: string
  title: string
  description: string
  location: string
  industry: string
  jobType: string
  experienceLevel: string
  salaryMin: number
  salaryMax: number
  requiredSkills: string[]
  isRemote: boolean
  applicationDeadline: string
  createdAt: string
}

interface MyApplication {
  id: string
  jobId?: string
  job?: {
    id: string
  }
}

export default function JobDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [coverLetter, setCoverLetter] = useState('')
  const [showApplyBox, setShowApplyBox] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [alreadyApplied, setAlreadyApplied] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsed = JSON.parse(userData)
      setUserRole(parsed.role)
    }

    fetchJob()
    checkAlreadyApplied()
  }, [id])

  const fetchJob = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/v1/jobs/${id}`)
      const data = await res.json()
      if (data.success) setJob(data.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const checkAlreadyApplied = async () => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) return

    const parsed = JSON.parse(userData)
    if (parsed.role !== 'candidate') return

    try {
      const res = await fetch('http://localhost:5000/api/v1/applications/my', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await res.json()

      if (data.success && Array.isArray(data.data)) {
        const hasApplied = data.data.some((application: MyApplication) => {
          return application.jobId === id || application.job?.id === id
        })
        setAlreadyApplied(hasApplied)
      }
    } catch (error) {
      console.error('Failed to check application status:', error)
    }
  }

  const handleApply = async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/login')
      return
    }

    if (alreadyApplied) {
      setMessage('You have already applied for this job.')
      setMessageType('error')
      return
    }

    if (!resumeFile) {
      setMessage('Please upload your resume before applying.')
      setMessageType('error')
      return
    }

    setApplying(true)

    try {
      const formData = new FormData()
      formData.append('coverLetter', coverLetter)
      formData.append('resume', resumeFile)

      const res = await fetch(`http://localhost:5000/api/v1/applications/apply/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const data = await res.json()

      if (data.success) {
        setMessage('🎉 Application submitted successfully!')
        setMessageType('success')
        setShowApplyBox(false)
        setCoverLetter('')
        setResumeFile(null)
        setAlreadyApplied(true)
      } else {
        setMessage(data.message || 'Failed to apply')
        setMessageType('error')

        if (data.message?.toLowerCase().includes('already applied')) {
          setAlreadyApplied(true)
          setShowApplyBox(false)
        }
      }
    } catch {
      setMessage('Something went wrong. Please try again.')
      setMessageType('error')
    }

    setApplying(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading job details...</p>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Job not found</p>
          <Link href="/jobs" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            Back to Jobs
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/jobs" className="text-blue-600 hover:underline text-sm mb-6 inline-block">
          ← Back to Jobs
        </Link>

        {message && (
          <div
            className={`px-4 py-3 rounded-xl mb-6 font-medium ${
              messageType === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
              <p className="text-gray-500">
                {job.location} {job.isRemote && '• Remote'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-green-600 font-bold text-lg">
                ₹{Number(job.salaryMin).toLocaleString()} – ₹{Number(job.salaryMax).toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">per month</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">
              {job.industry}
            </span>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 text-sm font-medium rounded-full">
              {job.jobType}
            </span>
            <span className="px-3 py-1 bg-orange-50 text-orange-700 text-sm font-medium rounded-full">
              {job.experienceLevel}
            </span>
            {job.applicationDeadline && (
              <span className="px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-full">
                Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <ShareJobButton job={job} />
          </div>

          {userRole === 'candidate' && !message && (
            <div>
              {alreadyApplied ? (
                <div className="inline-flex items-center px-6 py-3 bg-green-50 text-green-700 font-semibold rounded-xl border border-green-200">
                  Already Applied
                </div>
              ) : !showApplyBox ? (
                <button
                  onClick={() => setShowApplyBox(true)}
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Apply Now
                </button>
              ) : (
                <div className="mt-4 space-y-4">
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Write a short cover letter (optional)..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Resume <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setResumeFile(file)
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {resumeFile && (
                      <p className="text-sm text-green-600 mt-2">
                        Selected: {resumeFile.name}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {applying ? 'Submitting...' : 'Submit Application'}
                    </button>

                    <button
                      onClick={() => {
                        setShowApplyBox(false)
                        setResumeFile(null)
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!userRole && (
            <Link
              href="/login"
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors inline-block"
            >
              Login to Apply
            </Link>
          )}
        </div>

        {job.requiredSkills?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Job Description</h2>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
        </div>
      </div>
    </main>
  )
}