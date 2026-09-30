'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Stats {
  totalJobs: number
  totalUsers: number
  totalApplications: number
  revenue: number
}

interface PlatformUser {
  id: string
  email: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'

const getAuth = () => {
  const token = (
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('authToken') ||
    ''
  )
  const rawUser = localStorage.getItem('user')

  try {
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null
    }
  } catch {
    return { token, user: null }
  }
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    const { token, user } = getAuth()

    if (!token || !user) {
      router.replace('/login')
      return
    }

    if (user.role !== 'super_admin') {
      router.replace('/admin')
      return
    }

    loadSuperAdminData(token)
  }, [router])

  const loadSuperAdminData = async (token: string) => {
    try {
      setLoading(true)
      setError('')

      const headers = {
        Authorization: `Bearer ${token}`
      }

      const [statsResponse, usersResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers }),
        fetch(`${API_BASE}/admin/users`, { headers })
      ])

      if (statsResponse.status === 401 || usersResponse.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.replace('/login')
        return
      }

      if (statsResponse.status === 403 || usersResponse.status === 403) {
        router.replace('/admin')
        return
      }

      const statsData = await statsResponse.json()
      const usersData = await usersResponse.json()

      if (!statsResponse.ok || !statsData.success) {
        throw new Error(statsData.message || 'Unable to load statistics')
      }

      if (!usersResponse.ok || !usersData.success) {
        throw new Error(usersData.message || 'Unable to load users')
      }

      setStats(statsData.data)
      setUsers(usersData.data || [])
    } catch (requestError) {
      console.error('Super admin data error:', requestError)
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load super admin data'
      )
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 3000)
  }

  const updateUserRole = async (userId: string, role: string) => {
    const { token } = getAuth()

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to update role')
      }

      setUsers((current) => current.map((user) => (
        user.id === userId ? { ...user, role } : user
      )))
      showMessage('Role updated successfully')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update role'
      )
    }
  }

  const toggleUserActive = async (userId: string) => {
    const { token } = getAuth()

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/toggle`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to update user status')
      }

      setUsers((current) => current.map((user) => (
        user.id === userId
          ? { ...user, isActive: !user.isActive }
          : user
      )))
      showMessage('User status updated successfully')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update user status'
      )
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 pt-24">
        <p className="text-gray-500">Loading super admin panel...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-purple-600">System Control</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Super Admin Panel</h1>
            <p className="mt-2 text-gray-600">
              Manage roles, platform access, plans, audits, and internal communication.
            </p>
          </div>
          <span className="rounded-xl bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700">
            Super Admin
          </span>
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-green-50 px-4 py-3 font-medium text-green-700">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Jobs" value={stats.totalJobs} />
            <StatCard label="Total Users" value={stats.totalUsers} />
            <StatCard label="Applications" value={stats.totalApplications} />
            <StatCard label="Revenue" value={`Rs.${stats.revenue}`} />
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {['overview', 'roles', 'tools'].map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={
                'rounded-xl px-4 py-2 text-sm font-medium capitalize ' +
                (activeSection === section
                  ? 'bg-purple-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
              }
            >
              {section}
            </button>
          ))}
        </div>

        {activeSection === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ToolCard
              title="Staff & Roles"
              description="Promote users to admin or super admin, with protection for the last active super admin."
              href="#roles"
              onClick={() => setActiveSection('roles')}
            />
            <ToolCard
              title="Plans & Perks"
              description="Review subscription plans and connect future plan controls here."
              href="/subscription"
            />
            <ToolCard
              title="Audit Logs"
              description="Review platform activity and administrative actions."
              href="/admin/audit"
            />
            <ToolCard
              title="Internal Communication"
              description="Open the internal communication workspace when its backend is connected."
              href="/super-admin/communication"
            />
            <ToolCard
              title="Feature Flags"
              description="Create controlled switches for future platform features."
              href="/super-admin/feature-flags"
            />
            <ToolCard
              title="Admin Dashboard"
              description="Open the normal operational admin dashboard."
              href="/admin"
            />
          </div>
        )}

        {activeSection === 'roles' && (
          <section id="roles" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-xl font-semibold text-gray-900">Staff & Role Management</h2>
              <p className="mt-1 text-sm text-gray-500">
                Only a super admin can change roles. The backend also protects the last active super admin.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-purple-100 px-3 py-1 font-semibold capitalize text-purple-700">
                        {user.role}
                      </span>
                      <span className={
                        `rounded-full px-3 py-1 ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`
                      }>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {user.isEmailVerified && (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Verified</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(event) => updateUserRole(user.id, event.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="candidate">Candidate</option>
                      <option value="employer">Employer</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => toggleUserActive(user.id)}
                      className={
                        `rounded-lg px-3 py-2 text-sm ${user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`
                      }
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'tools' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ToolCard title="Users" description="View all users and subscription information." href="/admin" />
            <ToolCard title="Plans & Perks" description="Manage plans after the plan-management API is connected." href="/subscription" />
            <ToolCard title="Audit Logs" description="Review audit and fraud activity." href="/admin/audit" />
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-purple-600">{value}</p>
    </div>
  )
}

function ToolCard({
  title,
  description,
  href,
  onClick
}: {
  title: string
  description: string
  href: string
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <span className="mt-5 inline-block text-sm font-semibold text-purple-600">Open →</span>
      </button>
    )
  }

  return (
    <Link href={href} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      <span className="mt-5 inline-block text-sm font-semibold text-purple-600">Open →</span>
    </Link>
  )
}
