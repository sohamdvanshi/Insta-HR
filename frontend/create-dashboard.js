const fs = require('fs');
const content = `'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface User {
  email: string
  role: 'candidate' | 'employer' | 'admin'
}

interface CandidateStats {
  totalApplied: number
  interviews: number
  shortlisted: number
  hired: number
}

interface EmployerStats {
  totalJobs: number
  totalApplications: number
  shortlisted: number
  hired: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [candidateStats, setCandidateStats] = useState<CandidateStats | null>(null)
  const [employerStats, setEmployerStats] = useState<EmployerStats | null>(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('token')

    if (!userData || !token) {
      router.replace('/login')
      return
    }

    const parsedUser: User = JSON.parse(userData)

    if (parsedUser.role === 'admin') {
      router.replace('/admin')
      return
    }

    setUser(parsedUser)
    fetchStats(parsedUser.role, token)
  }, [router])

  const fetchStats = async (role: string, token: string) => {
    try {
      if (role === 'candidate') {
        const res = await fetch('http://localhost:5000/api/v1/applications/my', {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await res.json()
        if (data.success) {
          const apps = data.data
          setCandidateStats({
            totalApplied: apps.length,
            interviews: apps.filter((a: any) => a.status === 'interview_scheduled').length,
            shortlisted: apps.filter((a: any) => a.status === 'shortlisted').length,
            hired: apps.filter((a: any) => a.status === 'hired').length,
          })
        }
      } else if (role === 'employer') {
        const [jobsRes, appsRes] = await Promise.all([
          fetch('http://localhost:5000/api/v1/employer/jobs', {
            headers: { Authorization: 'Bearer ' + token }
          }),
          fetch('http://localhost:5000/api/v1/employer/jobs', {
            headers: { Authorization: 'Bearer ' + token }
          })
        ])
        const jobsData = await jobsRes.json()
        if (jobsData.success) {
          const jobs = jobsData.data
          const totalApplications = jobs.reduce((sum: number, j: any) => sum + (j.totalApplications || 0), 0)
          setEmployerStats({
            totalJobs: jobs.length,
            totalApplications,
            shortlisted: 0,
            hired: 0,
          })
        }
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.replace('/')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading dashboard...</p>
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back! 👋</h1>
          <p className="text-blue-100">
            {user.email} — {user.role === 'candidate' ? 'Job Seeker' : 'Employer'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {user.role === 'candidate' ? (
            <>
              <StatCard value={String(candidateStats?.totalApplied ?? 0)} label="Jobs Applied" />
              <StatCard value={String(candidateStats?.shortlisted ?? 0)} label="Shortlisted" />
              <StatCard value={String(candidateStats?.interviews ?? 0)} label="Interviews" />
              <StatCard value={String(candidateStats?.hired ?? 0)} label="Hired" />
            </>
          ) : (
            <>
              <StatCard value={String(employerStats?.totalJobs ?? 0)} label="Jobs Posted" />
              <StatCard value={String(employerStats?.totalApplications ?? 0)} label="Applications" />
              <StatCard value={String(employerStats?.shortlisted ?? 0)} label="Shortlisted" />
              <StatCard value={String(employerStats?.hired ?? 0)} label="Hired" />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {user.role === 'candidate' ? (
              <>
                <ActionLink href="/jobs" emoji="🔍" label="Find Jobs" />
                <ActionLink href="/profile" emoji="👤" label="My Profile" />
                <ActionLink href="/applications" emoji="📋" label="Applications" />
                <ActionLink href="/training" emoji="📚" label="Training" />
              </>
            ) : (
              <>
                <ActionLink href="/post-job" emoji="➕" label="Post a Job" />
                <ActionLink href="/employer" emoji="📋" label="View Applications" />
                <ActionLink href="/subscription" emoji="⭐" label="Upgrade Plan" />
                <ActionLink href="/profile" emoji="🏢" label="Company Profile" />
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {user.role === 'candidate' ? 'Your Application Status' : 'Hiring Overview'}
          </h2>
          {user.role === 'candidate' && candidateStats && (
            <div className="space-y-3">
              {[
                { label: 'Applied', value: candidateStats.totalApplied, color: 'bg-blue-500', total: candidateStats.totalApplied },
                { label: 'Shortlisted', value: candidateStats.shortlisted, color: 'bg-yellow-500', total: candidateStats.totalApplied },
                { label: 'Interview Scheduled', value: candidateStats.interviews, color: 'bg-purple-500', total: candidateStats.totalApplied },
                { label: 'Hired', value: candidateStats.hired, color: 'bg-green-500', total: candidateStats.totalApplied },
              ].map(({ label, value, color, total }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={"h-2 rounded-full " + color}
                      style={{ width: total > 0 ? (value / total * 100) + "%" : "0%" }}
                    />
                  </div>
                </div>
              ))}
              {candidateStats.totalApplied === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-400 mb-3">You have not applied to any jobs yet</p>
                  <Link href="/jobs" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                    Browse Jobs
                  </Link>
                </div>
              )}
            </div>
          )}
          {user.role === 'employer' && employerStats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-blue-800 font-medium mb-1">Active Jobs</p>
                <p className="text-2xl font-bold text-blue-600">{employerStats.totalJobs}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-purple-800 font-medium mb-1">Total Applications</p>
                <p className="text-2xl font-bold text-purple-600">{employerStats.totalApplications}</p>
              </div>
              {employerStats.totalJobs === 0 && (
                <div className="col-span-2 text-center py-4">
                  <p className="text-gray-400 mb-3">You have not posted any jobs yet</p>
                  <Link href="/post-job" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                    Post Your First Job
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
        >
          Logout
        </button>

      </div>
    </main>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="text-3xl font-bold text-blue-600 mb-1">{value}</div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  )
}

function ActionLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
    >
      <span className="text-3xl mb-2">{emoji}</span>
      <span className="text-sm font-medium text-gray-700 text-center">{label}</span>
    </Link>
  )
}
`;
fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('Dashboard page created successfully!');