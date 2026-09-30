'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Job {
  id: string
  title: string
  location: string
  industry: string
  jobType: string
  status: string
  createdAt: string
}

interface User {
  id: string
  email: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
}

interface Stats {
  totalJobs: number
  totalUsers: number
  totalApplications: number
  revenue: number
}

type StoredUser = {
  id: string
  email: string
  role: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'

const getStoredAuth = () => {
  const token = (
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('authToken') ||
    ''
  )
  const userRaw = localStorage.getItem('user')

  if (!token || !userRaw) return { token: '', user: null as StoredUser | null }

  try {
    const user = JSON.parse(userRaw) as StoredUser
    return { token, user }
  } catch {
    return { token: '', user: null as StoredUser | null }
  }
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const { token, user } = getStoredAuth()

    if (!token || !user) {
      window.location.href = '/login'
      return
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      window.location.href = '/dashboard'
      return
    }

    fetchAll(token)
  }, [])

  const fetchAll = async (token: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` }

      const [statsRes, jobsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers }),
        fetch(`${API_BASE}/admin/jobs`, { headers }),
        fetch(`${API_BASE}/admin/users`, { headers })
      ])

      if ([statsRes, jobsRes, usersRes].some((response) => response.status === 401)) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }

      const [statsData, jobsData, usersData] = await Promise.all([
        statsRes.json(),
        jobsRes.json(),
        usersRes.json()
      ])

      if (statsData.success) setStats(statsData.data)
      if (jobsData.success) setJobs(jobsData.data || [])
      if (usersData.success) setUsers(usersData.data || [])
    } catch (error) {
      console.error('Admin fetch error:', error)
      showMsg('Unable to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const updateJobStatus = async (jobId: string, status: string) => {
    const token = getStoredAuth().token

    try {
      const res = await fetch(`${API_BASE}/admin/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Update failed')

      setJobs((current) => current.map((job) => (
        job.id === jobId ? { ...job, status } : job
      )))
      showMsg('Job status updated!')
    } catch (error) {
      showMsg(error instanceof Error ? error.message : 'Unable to update job')
    }
  }

  const updateUserRole = async (userId: string, role: string) => {
    const currentAuth = getStoredAuth()

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuth.token}`
        },
        body: JSON.stringify({ role })
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Role update failed')

      setUsers((current) => current.map((user) => (
        user.id === userId ? { ...user, role } : user
      )))
      showMsg('User role updated!')
    } catch (error) {
      showMsg(error instanceof Error ? error.message : 'Unable to update role')
    }
  }

  const toggleUserActive = async (userId: string) => {
    const currentAuth = getStoredAuth()

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${currentAuth.token}` }
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Status update failed')

      setUsers((current) => current.map((user) => (
        user.id === userId
          ? { ...user, isActive: !user.isActive }
          : user
      )))
      showMsg('User status updated!')
    } catch (error) {
      showMsg(error instanceof Error ? error.message : 'Unable to update user')
    }
  }

  const showMsg = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 3000)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 pt-24">
        <p className="text-gray-400">Loading admin panel...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage your InstaHire platform</p>
          </div>
          <span className="rounded-xl bg-red-100 px-4 py-2 text-sm font-medium text-red-700">
            Admin Access
          </span>
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-green-50 px-4 py-3 font-medium text-green-700">
            ✓ {message}
          </div>
        )}

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { label: 'Total Jobs', value: stats.totalJobs },
              { label: 'Total Users', value: stats.totalUsers },
              { label: 'Applications', value: stats.totalApplications },
              { label: 'Revenue', value: `Rs.${stats.revenue}` }
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-1 text-2xl font-bold text-blue-600">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {['dashboard', 'jobs', 'users'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                'rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ' +
                (activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
              }
            >
              {tab === 'dashboard'
                ? 'Dashboard'
                : tab === 'jobs'
                  ? `Jobs (${jobs.length})`
                  : `Users (${users.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-bold text-gray-900">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Link href="/admin/courses" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  📚 Manage Courses
                </Link>
                <Link href="/admin/communication" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  💬 Internal Communication
                </Link>
                <Link href="/post-job" className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                  ➕ Post Job
                </Link>
                <Link href="/subscription" className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                  💳 Pricing Plans
                </Link>
                <Link href="/jobs" className="rounded-xl bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                  🔍 Browse Jobs
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-gray-900">Platform Overview</h2>
              <div className="grid grid-cols-2 gap-4">
                <OverviewCard label="Active Jobs" value={jobs.filter((job) => job.status === 'active').length} className="bg-blue-50 text-blue-600" />
                <OverviewCard label="Pending Approval" value={jobs.filter((job) => job.status === 'pending').length} className="bg-yellow-50 text-yellow-600" />
                <OverviewCard label="Employers" value={users.filter((user) => user.role === 'employer').length} className="bg-green-50 text-green-600" />
                <OverviewCard label="Candidates" value={users.filter((user) => user.role === 'candidate').length} className="bg-purple-50 text-purple-600" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h2 className="font-bold text-gray-900">All Jobs ({jobs.length})</h2>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">
                  {jobs.filter((job) => job.status === 'pending').length} pending
                </span>
                <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">
                  {jobs.filter((job) => job.status === 'active').length} active
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {jobs.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No jobs found</div>
              ) : jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-6">
                  <div>
                    <h3 className="font-medium text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-500">{job.location} - {job.industry} - {job.jobType}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(job.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={
                      'rounded-full px-2 py-1 text-xs font-medium ' +
                      (job.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : job.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700')
                    }>
                      {job.status}
                    </span>
                    {job.status === 'pending' && (
                      <button type="button" onClick={() => updateJobStatus(job.id, 'active')} className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">
                        Approve
                      </button>
                    )}
                    {job.status === 'active' && (
                      <button type="button" onClick={() => updateJobStatus(job.id, 'closed')} className="rounded-lg bg-gray-600 px-3 py-1 text-xs text-white hover:bg-gray-700">
                        Close
                      </button>
                    )}
                    {(job.status === 'pending' || job.status === 'active') && (
                      <button type="button" onClick={() => updateJobStatus(job.id, 'rejected')} className="rounded-lg bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-700">
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-6">
              <h2 className="font-bold text-gray-900">All Users ({users.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No users found</div>
              ) : users.map((platformUser) => (
                <div key={platformUser.id} className="flex items-center justify-between p-6">
                  <div>
                    <p className="font-medium text-gray-900">{platformUser.email}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className={
                        'rounded-full px-2 py-0.5 text-xs font-medium ' +
                        (platformUser.role === 'employer'
                          ? 'bg-blue-100 text-blue-700'
                          : platformUser.role === 'admin' || platformUser.role === 'super_admin'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600')
                      }>
                        {platformUser.role}
                      </span>
                      <span className={
                        'rounded-full px-2 py-0.5 text-xs ' +
                        (platformUser.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                      }>
                        {platformUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {platformUser.isEmailVerified && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Verified</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Joined {new Date(platformUser.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Role management is super-admin only</span>
                    <button
                      type="button"
                      onClick={() => toggleUserActive(platformUser.id)}
                      className={
                        'rounded-lg px-3 py-1.5 text-xs ' +
                        (platformUser.isActive
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100')
                      }
                    >
                      {platformUser.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function OverviewCard({
  label,
  value,
  className
}: {
  label: string
  value: number
  className: string
}) {
  return (
    <div className={`rounded-xl p-4 ${className}`}>
      <p className="mb-1 font-medium">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
