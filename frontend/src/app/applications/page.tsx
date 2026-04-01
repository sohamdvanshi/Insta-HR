'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Job {
  title: string
  location: string
  industry: string
  jobType: string
}

interface Application {
  id: string
  jobId: string
  status: string
  createdAt: string
  interviewDate?: string
  Job?: Job
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  applied: {
    label: '📩 Applied',
    color: 'bg-blue-100 text-blue-700'
  },
  shortlisted: {
    label: '⭐ Shortlisted',
    color: 'bg-yellow-100 text-yellow-700'
  },
  interview_scheduled: {
    label: '📅 Interview Scheduled',
    color: 'bg-purple-100 text-purple-700'
  },
  hired: {
    label: '🎉 Hired',
    color: 'bg-green-100 text-green-700'
  },
  rejected: {
    label: '❌ Rejected',
    color: 'bg-red-100 text-red-700'
  }
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.replace('/login')
      return
    }

    fetchApplications(token)
  }, [])

  const fetchApplications = async (token: string) => {
    try {
      const res = await fetch(
        'http://localhost:5000/api/v1/applications/my',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const data = await res.json()

      if (data.success) {
        setApplications(data.data)
      } else {
        console.error(data.message)
      }
    } catch (err) {
      console.error('Failed to fetch applications', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading applications...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">
            My Applications
          </h1>
          <p className="text-blue-100">
            Track all your job applications
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: applications.length },
            {
              label: 'Shortlisted',
              value: applications.filter(a => a.status === 'shortlisted').length
            },
            {
              label: 'Interviews',
              value: applications.filter(a => a.status === 'interview_scheduled').length
            },
            {
              label: 'Hired',
              value: applications.filter(a => a.status === 'hired').length
            }
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center"
            >
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {stat.value}
              </div>
              <div className="text-gray-500 text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Applications */}
        {applications.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-4">
              No applications yet
            </p>

            <Link
              href="/jobs"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Browse Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map(app => {
              const status = STATUS_CONFIG[app.status] || {
                label: app.status,
                color: 'bg-gray-100 text-gray-700'
              }

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {app.Job?.title ?? 'Job Title'}
                      </h3>

                      <p className="text-gray-500 text-sm">
                        {app.Job?.location ?? 'Location'} •
                        {app.Job?.industry ?? 'Industry'} •
                        {app.Job?.jobType ?? 'Type'}
                      </p>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Applied on {new Date(app.createdAt).toLocaleDateString()}
                    </p>

                    <Link
                      href={`/jobs/${app.jobId}`}
                      className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      View Job
                    </Link>
                  </div>

                  {app.interviewDate && (
                    <div className="mt-3 bg-purple-50 rounded-xl p-3">
                      <p className="text-purple-700 text-sm font-medium">
                        📅 Interview: {new Date(app.interviewDate).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}