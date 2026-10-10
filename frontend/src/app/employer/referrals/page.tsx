'use client'
import { tr, trError, useLocale, locale } from '@/lib/localization'


import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = 'http://localhost:5000/api/v1'

type ReferralRecord = {
  id: string
  status?: string
  applicationStatus?: string
  rewardPoints?: number
  rewardStatus?: string
  rewardedAt?: string | null
  createdAt?: string
  referralCode?: string | null
  candidate?: {
    id?: string
    email?: string
    name?: string
  } | null
  referrer?: {
    id?: string
    email?: string
    name?: string
    referralCode?: string | null
  } | null
  job?: {
    id?: string
    title?: string
  } | null
}

type ReferralResponse = {
  success: boolean
  message?: string
  count?: number
  data?: ReferralRecord[]
}

const getToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token') || localStorage.getItem('authToken')
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'

  return date.toLocaleDateString(locale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const getStatus = (item: ReferralRecord) => {
  return item.applicationStatus || item.status || 'pending'
}

const getRewardStatus = (item: ReferralRecord) => {
  if (item.rewardStatus) return item.rewardStatus

  const status = getStatus(item).toLowerCase()
  if (status === 'hired') return 'Eligible'
  if (status === 'rejected') return 'Not eligible'
  return 'Pending'
}

const statusClass = (status: string) => {
  const value = status.toLowerCase()

  if (value === 'hired' || value === 'paid') {
    return 'bg-green-100 text-green-700'
  }

  if (value === 'rejected' || value === 'not eligible') {
    return 'bg-red-100 text-red-700'
  }

  if (value === 'eligible') {
    return 'bg-yellow-100 text-yellow-700'
  }

  return 'bg-blue-100 text-blue-700'
}

export default function EmployerReferralsPage() {
  useLocale()

  const [records, setRecords] = useState<ReferralRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReferrals = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const token = getToken()

      if (!token) {
        setError('Please login as an employer to view referral tracking.')
        return
      }

      const response = await fetch(
        `${API_BASE}/referrals/employer/tracking`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          cache: 'no-store'
        }
      )

      const result: ReferralResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load referral tracking.')
      }

      setRecords(Array.isArray(result.data) ? result.data : [])
    } catch (requestError) {
      console.error('Employer referral tracking error:', requestError)
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load referral tracking.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReferrals()
  }, [loadReferrals])

  const summary = useMemo(() => {
    const hired = records.filter(
      (item) => getStatus(item).toLowerCase() === 'hired'
    ).length

    const pendingRewards = records.filter(
      (item) => getRewardStatus(item).toLowerCase() === 'pending'
    ).length

    const paidRewards = records.filter(
      (item) => getRewardStatus(item).toLowerCase() === 'paid'
    ).length

    const points = records.reduce(
      (total, item) => total + Number(item.rewardPoints || 0),
      0
    )

    return {
      total: records.length,
      hired,
      pendingRewards,
      paidRewards,
      points
    }
  }, [records])

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/employer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >{tr("← Back to Dashboard")}</Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">{tr("Referral Tracking")}</h1>
            <p className="mt-2 text-gray-600">{tr("Track referred candidates who applied to your job postings.")}</p>
          </div>

          <button
            type="button"
            onClick={loadReferrals}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {tr(loading ? 'Refreshing...' : 'Refresh')}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {trError(error)}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Total referrals" value={summary.total} />
          <SummaryCard label="Hired candidates" value={summary.hired} />
          <SummaryCard label="Pending rewards" value={summary.pendingRewards} />
          <SummaryCard label="Paid rewards" value={summary.paidRewards} />
          <SummaryCard label="Reward points" value={summary.points} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">{tr("Referred applications")}</h2>
            <p className="mt-1 text-sm text-gray-500">{tr("Referrals connected to your jobs are shown here.")}</p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500">{tr("Loading referral tracking...")}</div>
          ) : records.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-gray-700">{tr("No referred applications found.")}</p>
              <p className="mt-2 text-sm text-gray-500">{tr("Referred candidates will appear here after they apply to your jobs.")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <TableHeading>{tr("Candidate")}</TableHeading>
                    <TableHeading>{tr("Referrer")}</TableHeading>
                    <TableHeading>{tr("Job")}</TableHeading>
                    <TableHeading>{tr("Application")}</TableHeading>
                    <TableHeading>{tr("Reward")}</TableHeading>
                    <TableHeading>{tr("Applied")}</TableHeading>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {records.map((item) => {
                    const applicationStatus = getStatus(item)
                    const rewardStatus = getRewardStatus(item)

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-5">
                          <p className="font-medium text-gray-900">
                            {tr(item.candidate?.name || item.candidate?.email || 'Unknown candidate')}
                          </p>
                          {item.candidate?.name && item.candidate?.email && (
                            <p className="mt-1 text-xs text-gray-500">
                              {item.candidate.email}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-6 py-5">
                          <p className="text-sm text-gray-800">
                            {tr(item.referrer?.name || item.referrer?.email || 'Unknown referrer')}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {tr(item.referralCode || item.referrer?.referralCode || 'No code')}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-sm text-gray-700">
                          {item.job?.title || tr('Unknown job')}
                        </td>

                        <td className="whitespace-nowrap px-6 py-5">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(applicationStatus)}`}>
                            {tr(applicationStatus)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-6 py-5">
                          <p className="font-semibold text-gray-900">
                            {Number(item.rewardPoints || 0)}{tr(" points")}</p>
                          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusClass(rewardStatus)}`}>
                            {tr(rewardStatus)}
                          </span>
                          {item.rewardedAt && (
                            <p className="mt-1 text-xs text-gray-500">
                              {tr(formatDate(item.rewardedAt))}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-6 py-5 text-sm text-gray-600">
                          {tr(formatDate(item.createdAt))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  useLocale()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{tr(label)}</p>
      <p className="mt-2 text-3xl font-bold text-blue-600">{value}</p>
    </div>
  )
}

function TableHeading({ children }: { children: React.ReactNode }) {
  useLocale()

  return (
    <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  )
}