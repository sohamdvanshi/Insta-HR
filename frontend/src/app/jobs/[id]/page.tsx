'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsed = JSON.parse(userData)
      setUserRole(parsed.role)
    }

    fetch(`http://localhost:5000/api/v1/jobs/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setJob(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const handleApply = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    setApplying(true)
    try {
      const res = await fetch(`http://localhost:5000/api/v1/applications/apply/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ coverLetter })
      })

      const data = await res.json()
      if (data.success) {
        setMessage('🎉 Application submitted successfully!')
        setMessageType('success')
        setShowApplyBox(false)
      } else {
        setMessage(data.message || 'Failed to apply')
        setMessageType('error')
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

        {/* Back */}
        <Link href="/jobs" className="text-blue-600 hover:underline text-sm mb-6 inline-block">
          ← Back to Jobs
        </Link>

        {/* Message */}
        {message && (
          <div className={`px-4 py-3 rounded-xl mb-6 font-medium ${
            messageType === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Job Header */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
              <p className="text-gray-500">{job.location} {job.isRemote && '• Remote'}</p>
            </div>
            <div className="text-right">
              <p className="text-green-600 font-bold text-lg">
                ₹{Number(job.salaryMin).toLocaleString()} – ₹{Number(job.salaryMax).toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">per month</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">{job.industry}</span>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 text-sm font-medium rounded-full">{job.jobType}</span>
            <span className="px-3 py-1 bg-orange-50 text-orange-700 text-sm font-medium rounded-full">{job.experienceLevel}</span>
            {job.applicationDeadline && (
              <span className="px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-full">
                Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Apply Button */}
          {userRole === 'candidate' && !message && (
            <div>
              {!showApplyBox ? (
                <button
                  onClick={() => setShowApplyBox(true)}
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Apply Now
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={coverLetter}
                    onChange={e => setCoverLetter(e.target.value)}
                    placeholder="Write a short cover letter (optional)..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {applying ? 'Submitting...' : 'Submit Application'}
                    </button>
                    <button
                      onClick={() => setShowApplyBox(false)}
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

        {/* Skills */}
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

        {/* Description */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Job Description</h2>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
        </div>

      </div>
    </main>
  )
}