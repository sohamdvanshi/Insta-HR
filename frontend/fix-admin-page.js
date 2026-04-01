const fs = require('fs');
const content = `'use client'
import { useState, useEffect } from 'react'
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

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    if (!user || !token) { window.location.href = '/login'; return }
    const parsed = JSON.parse(user)
    if (parsed.role !== 'admin') { window.location.href = '/dashboard'; return }
    fetchAll(token)
  }, [])

  const fetchAll = async (token: string) => {
    try {
      const [statsRes, jobsRes, usersRes] = await Promise.all([
        fetch('http://localhost:5000/api/v1/admin/stats', { headers: { Authorization: 'Bearer ' + token } }),
        fetch('http://localhost:5000/api/v1/admin/jobs', { headers: { Authorization: 'Bearer ' + token } }),
        fetch('http://localhost:5000/api/v1/admin/users', { headers: { Authorization: 'Bearer ' + token } }),
      ])
      const [statsData, jobsData, usersData] = await Promise.all([
        statsRes.json(), jobsRes.json(), usersRes.json()
      ])
      if (statsData.success) setStats(statsData.data)
      if (jobsData.success) setJobs(jobsData.data)
      if (usersData.success) setUsers(usersData.data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const updateJobStatus = async (jobId: string, status: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch('http://localhost:5000/api/v1/admin/jobs/' + jobId + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status })
    })
    const data = await res.json()
    if (data.success) {
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status } : j))
      showMsg('Job status updated!')
    }
  }

  const updateUserRole = async (userId: string, role: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch('http://localhost:5000/api/v1/admin/users/' + userId + '/role', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ role })
    })
    const data = await res.json()
    if (data.success) {
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u))
      showMsg('User role updated!')
    }
  }

  const toggleUserActive = async (userId: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch('http://localhost:5000/api/v1/admin/users/' + userId + '/toggle', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token }
    })
    const data = await res.json()
    if (data.success) {
      setUsers(users.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u))
      showMsg('User status updated!')
    }
  }

  const showMsg = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <p className="text-gray-400">Loading admin panel...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage your InstaHire platform</p>
          </div>
          <span className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-xl text-sm">Super Admin</span>
        </div>

        {message && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium">✓ {message}</div>}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Jobs', value: stats.totalJobs },
              { label: 'Total Users', value: stats.totalUsers },
              { label: 'Applications', value: stats.totalApplications },
              { label: 'Revenue', value: 'Rs.' + stats.revenue },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-blue-600 mb-1">{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['dashboard', 'jobs', 'users'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={"px-4 py-2 rounded-xl font-medium text-sm capitalize transition-colors " + (activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200')}>
              {tab === 'dashboard' ? 'Dashboard' : tab === 'jobs' ? 'Jobs (' + jobs.length + ')' : 'Users (' + users.length + ')'}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Link href="/admin/courses" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                  📚 Manage Courses
                </Link>
                <Link href="/post-job" className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700">
                  ➕ Post Job
                </Link>
                <Link href="/subscription" className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700">
                  💳 Pricing Plans
                </Link>
                <Link href="/jobs" className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-xl hover:bg-gray-700">
                  🔍 Browse Jobs
                </Link>
              </div>
            </div>

            {/* Overview */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4 text-lg">Platform Overview</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="font-medium text-blue-800 mb-1">Active Jobs</p>
                  <p className="text-2xl font-bold text-blue-600">{jobs.filter(j => j.status === 'active').length}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="font-medium text-yellow-800 mb-1">Pending Approval</p>
                  <p className="text-2xl font-bold text-yellow-600">{jobs.filter(j => j.status === 'pending').length}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="font-medium text-green-800 mb-1">Employers</p>
                  <p className="text-2xl font-bold text-green-600">{users.filter(u => u.role === 'employer').length}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="font-medium text-purple-800 mb-1">Candidates</p>
                  <p className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'candidate').length}</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">All Jobs ({jobs.length})</h2>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">{jobs.filter(j => j.status === 'pending').length} pending</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">{jobs.filter(j => j.status === 'active').length} active</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {jobs.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No jobs found</div>
              ) : jobs.map(job => (
                <div key={job.id} className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-500">{job.location} - {job.industry} - {job.jobType}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(job.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={"px-2 py-1 rounded-full text-xs font-medium " + (job.status === 'active' ? 'bg-green-100 text-green-700' : job.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                      {job.status}
                    </span>
                    {job.status === 'pending' && (
                      <button onClick={() => updateJobStatus(job.id, 'active')}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                        Approve
                      </button>
                    )}
                    {job.status === 'active' && (
                      <button onClick={() => updateJobStatus(job.id, 'closed')}
                        className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700">
                        Close
                      </button>
                    )}
                    {(job.status === 'pending' || job.status === 'active') && (
                      <button onClick={() => updateJobStatus(job.id, 'rejected')}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">All Users ({users.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No users found</div>
              ) : users.map(user => (
                <div key={user.id} className="p-6 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{user.email}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (user.role === 'employer' ? 'bg-blue-100 text-blue-700' : user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>
                        {user.role}
                      </span>
                      <span className={"px-2 py-0.5 rounded-full text-xs " + (user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {user.isEmailVerified && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">Verified</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={user.role} onChange={e => updateUserRole(user.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500">
                      <option value="candidate">Candidate</option>
                      <option value="employer">Employer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => toggleUserActive(user.id)}
                      className={"px-3 py-1.5 text-xs rounded-lg " + (user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100')}>
                      {user.isActive ? 'Deactivate' : 'Activate'}
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
`;
fs.writeFileSync('src/app/admin/page.tsx', content);
console.log('Admin page fixed!');