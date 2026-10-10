'use client'
import { API_BASE } from '@/lib/api'
import { tr, useLocale } from '@/lib/localization'


import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface User {
  id?: string
  email: string
  role: 'candidate' | 'employer' | 'admin'
  referralCode?: string | null
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
  useLocale()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [candidateStats, setCandidateStats] =
    useState<CandidateStats | null>(null)
  const [employerStats, setEmployerStats] =
    useState<EmployerStats | null>(null)

  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('token')

    if (!userData || !token) {
      router.replace('/login')
      return
    }

    try {
      const parsedUser: User = JSON.parse(userData)

      if (parsedUser.role === 'admin') {
        router.replace('/admin')
        return
      }

      setUser(parsedUser)
      fetchStats(parsedUser.role, token)
    } catch (error) {
      console.error('Failed to read user data:', error)
      router.replace('/login')
    }
  }, [router])

  const fetchStats = async (
    role: string,
    token: string
  ) => {
    try {
      if (role === 'candidate') {
        const response = await fetch(
          `${API_BASE}/applications/my`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

        const data = await response.json()

        if (response.ok && data.success) {
          const applications = data.data || []

          setCandidateStats({
            totalApplied: applications.length,
            interviews: applications.filter(
              (application: any) =>
                application.status === 'interview'
            ).length,
            shortlisted: applications.filter(
              (application: any) =>
                application.status === 'shortlisted'
            ).length,
            hired: applications.filter(
              (application: any) =>
                application.status === 'hired'
            ).length
          })
        }
      } else if (role === 'employer') {
        const response = await fetch(
          `${API_BASE}/employer/jobs`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )

        const data = await response.json()

        if (response.ok && data.success) {
          const jobs = data.data || []

          const totalApplications = jobs.reduce(
            (sum: number, job: any) =>
              sum + Number(job.totalApplications || 0),
            0
          )

          setEmployerStats({
            totalJobs: jobs.length,
            totalApplications,
            shortlisted: 0,
            hired: 0
          })
        }
      }
    } catch (error) {
      console.error(
        'Failed to fetch dashboard statistics:',
        error
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCopyReferralCode = async () => {
    if (!user?.referralCode) return

    try {
      await navigator.clipboard.writeText(
        user.referralCode
      )
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error(
        'Failed to copy referral code:',
        error
      )
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.replace('/')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">{tr("Loading dashboard...")}</p>
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">{tr("Welcome back! 👋")}</h1>
          <p className="text-blue-100">
            {user.email} —{tr(' ')}
            {tr(user.role === 'candidate'
              ? 'Job Seeker'
              : 'Employer')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {user.role === 'candidate' ? (
            <>
              <StatCard
                value={String(
                  candidateStats?.totalApplied ?? 0
                )}
                label="Jobs Applied"
              />
              <StatCard
                value={String(
                  candidateStats?.shortlisted ?? 0
                )}
                label="Shortlisted"
              />
              <StatCard
                value={String(
                  candidateStats?.interviews ?? 0
                )}
                label="Interviews"
              />
              <StatCard
                value={String(
                  candidateStats?.hired ?? 0
                )}
                label="Hired"
              />
            </>
          ) : (
            <>
              <StatCard
                value={String(
                  employerStats?.totalJobs ?? 0
                )}
                label="Jobs Posted"
              />
              <StatCard
                value={String(
                  employerStats?.totalApplications ?? 0
                )}
                label="Applications"
              />
              <StatCard
                value={String(
                  employerStats?.shortlisted ?? 0
                )}
                label="Shortlisted"
              />
              <StatCard
                value={String(
                  employerStats?.hired ?? 0
                )}
                label="Hired"
              />
            </>
          )}
        </div>

        {user.role === 'candidate' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-violet-100 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">{tr("Invite and earn")}</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{tr("Your Referral Code")}</h2>
                <p className="mt-2 text-sm text-gray-500">{tr("Share this unique code with another candidate.")}</p>
              </div>

              <div className="flex items-center gap-3">
                <code className="px-4 py-3 bg-gray-100 rounded-xl font-bold tracking-wider text-gray-900">
                  {tr(user.referralCode || 'Not available')}
                </code>

                <button
                  type="button"
                  onClick={handleCopyReferralCode}
                  disabled={!user.referralCode}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {tr(copied ? 'Copied!' : 'Copy')}
                </button>
              </div>
            </div>

            {!user.referralCode && (
              <p className="mt-4 text-sm text-amber-600">{tr("Your referral code is not available yet. Please log out and log in again after the backend update.")}</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{tr("Quick Actions")}</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {user.role === 'candidate' ? (
              <>
                <ActionLink
                  href="/jobs"
                  emoji="🔍"
                  label="Find Jobs"
                />
                <ActionLink
                  href="/profile"
                  emoji="👤"
                  label="My Profile"
                />
                <ActionLink
                  href="/applications"
                  emoji="📋"
                  label="Applications"
                />
                <ActionLink
                  href="/referrals"
                  emoji="🎁"
                  label="Referrals & Loyalty"
                  highlight
                />
                <ActionLink
                  href="/training"
                  emoji="📚"
                  label="Training"
                />
              </>
            ) : (
              <>
                <ActionLink
                  href="/post-job"
                  emoji="➕"
                  label="Post a Job"
                />
                <ActionLink
                  href="/employer"
                  emoji="📋"
                  label="View Applications"
                />
                <ActionLink
                  href="/subscription"
                  emoji="⭐"
                  label="Upgrade Plan"
                />
                <ActionLink
                  href="/profile"
                  emoji="🏢"
                  label="Company Profile"
                />
                <ActionLink
                  href="/employer/referrals"
                  emoji="🤝"
                  label="Referral Tracking"
                  highlight
                />
              </>
            )}
          </div>
        </div>

        {user.role === 'candidate' && (
          <Link
            href="/referrals"
            className="block rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md mb-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">{tr("Earn rewards")}</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{tr("Referrals & Loyalty")}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{tr("Refer candidates, track referral progress, and view your loyalty points.")}</p>
              </div>

              <div className="rounded-xl bg-violet-600 px-3 py-2 text-2xl">
                🎁
              </div>
            </div>

            <div className="mt-5 text-sm font-semibold text-violet-700">{tr("Open referrals →")}</div>
          </Link>
        )}

        {user.role === 'employer' && (
          <Link
            href="/employer/referrals"
            className="block rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md mb-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{tr("Hiring insights")}</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{tr("Referral Tracking")}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{tr("Review referred candidates and monitor referral statuses for your jobs.")}</p>
              </div>

              <div className="rounded-xl bg-blue-600 px-3 py-2 text-2xl">
                🤝
              </div>
            </div>

            <div className="mt-5 text-sm font-semibold text-blue-700">{tr("View referrals →")}</div>
          </Link>
        )}

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {tr(user.role === 'candidate'
              ? 'Your Application Status'
              : 'Hiring Overview')}
          </h2>

          {user.role === 'candidate' &&
            candidateStats && (
              <div className="space-y-3">
                {[
                  {
                    label: 'Applied',
                    value: candidateStats.totalApplied,
                    color: 'bg-blue-500',
                    total: candidateStats.totalApplied
                  },
                  {
                    label: 'Shortlisted',
                    value: candidateStats.shortlisted,
                    color: 'bg-yellow-500',
                    total: candidateStats.totalApplied
                  },
                  {
                    label: 'Interview Scheduled',
                    value: candidateStats.interviews,
                    color: 'bg-purple-500',
                    total: candidateStats.totalApplied
                  },
                  {
                    label: 'Hired',
                    value: candidateStats.hired,
                    color: 'bg-green-500',
                    total: candidateStats.totalApplied
                  }
                ].map(({ label, value, color, total }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        {tr(label)}
                      </span>
                      <span className="font-medium text-gray-900">
                        {value}
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${color}`}
                        style={{
                          width:
                            total > 0
                              ? `${(value / total) * 100}%`
                              : '0%'
                        }}
                      />
                    </div>
                  </div>
                ))}

                {candidateStats.totalApplied === 0 && (
                  <div className="text-center py-6">
                    <p className="text-gray-400 mb-3">{tr("You have not applied to any jobs yet")}</p>
                    <Link
                      href="/jobs"
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                    >{tr("Browse Jobs")}</Link>
                  </div>
                )}
              </div>
            )}

          {user.role === 'employer' &&
            employerStats && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-blue-800 font-medium mb-1">{tr("Active Jobs")}</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {employerStats.totalJobs}
                  </p>
                </div>

                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-purple-800 font-medium mb-1">{tr("Total Applications")}</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {employerStats.totalApplications}
                  </p>
                </div>

                {employerStats.totalJobs === 0 && (
                  <div className="col-span-2 text-center py-4">
                    <p className="text-gray-400 mb-3">{tr("You have not posted any jobs yet")}</p>
                    <Link
                      href="/post-job"
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                    >{tr("Post Your First Job")}</Link>
                  </div>
                )}
              </div>
            )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-6 py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
        >{tr("Logout")}</button>
      </div>
    </main>
  )
}

function StatCard({
  value,
  label
}: {
  value: string
  label: string
}) {
  useLocale()

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="text-3xl font-bold text-blue-600 mb-1">
        {tr(value)}
      </div>
      <div className="text-gray-500 text-sm">
        {tr(label)}
      </div>
    </div>
  )
}

function ActionLink({
  href,
  emoji,
  label,
  highlight = false
}: {
  href: string
  emoji: string
  label: string
  highlight?: boolean
}) {
  useLocale()

  return (
    <Link
      href={href}
      className={
        highlight
          ? 'flex flex-col items-center p-4 bg-violet-50 border border-violet-100 rounded-xl hover:bg-violet-100 transition-colors'
          : 'flex flex-col items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors'
      }
    >
      <span className="text-3xl mb-2">{tr(emoji)}</span>
      <span
        className={
          highlight
            ? 'text-sm font-medium text-violet-800 text-center'
            : 'text-sm font-medium text-gray-700 text-center'
        }
      >
        {tr(label)}
      </span>
    </Link>
  )
}