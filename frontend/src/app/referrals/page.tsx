'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const API_BASE = 'http://localhost:5000/api/v1'

interface StoredUser {
  id?: string
  email?: string
  role?: 'candidate' | 'employer' | 'admin'
  referralCode?: string | null
}

interface PointTransaction {
  id: string
  points: number
  type?: string
  reason?: string
  createdAt: string
  applicationId?: string | null
}

interface ReferredApplication {
  id: string
  status: string
  referralCodeUsed?: string | null
  referralRewarded?: boolean
  referralRewardedAt?: string | null
  referralRewardPoints?: number | null
  createdAt: string
  candidate?: {
    id: string
    email: string
    phone?: string | null
  } | null
  job?: {
    id: string
    title: string
  } | null
}

const statusClasses: Record<string, string> = {
  applied:
    'bg-amber-50 text-amber-700 border-amber-200',
  shortlisted:
    'bg-blue-50 text-blue-700 border-blue-200',
  interview:
    'bg-violet-50 text-violet-700 border-violet-200',
  hired:
    'bg-green-50 text-green-700 border-green-200',
  rejected:
    'bg-red-50 text-red-700 border-red-200',
  rewarded:
    'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_eligible:
    'bg-gray-100 text-gray-600 border-gray-200',
  eligible:
    'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid:
    'bg-emerald-50 text-emerald-700 border-emerald-200'
}

function formatLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
}

function getStatusClass(value?: string | null) {
  if (!value) {
    return 'bg-gray-100 text-gray-600 border-gray-200'
  }

  return (
    statusClasses[value] ||
    'bg-gray-100 text-gray-600 border-gray-200'
  )
}

export default function ReferralsPage() {
  const router = useRouter()

  const [user, setUser] = useState<StoredUser | null>(null)
  const [referralCode, setReferralCode] = useState('')
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] =
    useState<PointTransaction[]>([])
  const [referrals, setReferrals] =
    useState<ReferredApplication[]>([])

  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (!token || !storedUser) {
      router.replace('/login')
      return
    }

    try {
      const parsedUser: StoredUser =
        JSON.parse(storedUser)

      if (parsedUser.role !== 'candidate') {
        router.replace('/dashboard')
        return
      }

      setUser(parsedUser)
      loadReferralData(token)
    } catch (parseError) {
      console.error(
        'Failed to parse stored user:',
        parseError
      )

      router.replace('/login')
    }
  }, [router])

  const loadReferralData = async (token: string) => {
    try {
      setLoading(true)
      setError('')

      const headers = {
        Authorization: `Bearer ${token}`
      }

      const [
        codeResponse,
        pointsResponse,
        referralsResponse
      ] = await Promise.all([
        fetch(`${API_BASE}/referrals/code`, {
          headers
        }),
        fetch(`${API_BASE}/referrals/points`, {
          headers
        }),
        fetch(`${API_BASE}/referrals/my`, {
          headers
        })
      ])

      const codeData = await codeResponse.json()
      const pointsData = await pointsResponse.json()
      const referralsData =
        await referralsResponse.json()

      if (!codeResponse.ok || !codeData.success) {
        throw new Error(
          codeData.message ||
            'Unable to load referral code'
        )
      }

      setReferralCode(
        codeData.data?.referralCode
          ?.trim()
          .toUpperCase() || ''
      )

      if (
        pointsResponse.ok &&
        pointsData.success
      ) {
        setBalance(Number(pointsData.balance || 0))
        setTransactions(
          Array.isArray(pointsData.transactions)
            ? pointsData.transactions
            : []
        )
      }

      if (
        referralsResponse.ok &&
        referralsData.success
      ) {
        setReferrals(
          Array.isArray(referralsData.data)
            ? referralsData.data
            : []
        )
      }
    } catch (loadError: any) {
      console.error(
        'Failed to load referral data:',
        loadError
      )

      setError(
        loadError.message ||
          'Failed to load referral data'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!referralCode) {
      setError(
        'Referral code is not available yet.'
      )
      return
    }

    try {
      await navigator.clipboard.writeText(
        referralCode
      )

      setCopied(true)
      setMessage(
        'Referral code copied successfully!'
      )
      setError('')

      window.setTimeout(() => {
        setCopied(false)
        setMessage('')
      }, 2500)
    } catch (copyError) {
      console.error(
        'Failed to copy referral code:',
        copyError
      )

      setError(
        'Could not copy the referral code. Please copy it manually.'
      )
    }
  }

  const handleShareCode = async () => {
    if (!referralCode) {
      setError(
        'Referral code is not available yet.'
      )
      return
    }

    const shareText =
      `Use my Insta-HR referral code ${referralCode} when applying for a job.`

    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.share
      ) {
        await navigator.share({
          title: 'Insta-HR Referral Code',
          text: shareText
        })

        return
      }

      await navigator.clipboard.writeText(
        shareText
      )

      setMessage(
        'Referral message copied successfully!'
      )
      setError('')

      window.setTimeout(() => {
        setMessage('')
      }, 2500)
    } catch (shareError: any) {
      if (shareError?.name === 'AbortError') {
        return
      }

      console.error(
        'Failed to share referral code:',
        shareError
      )

      setError(
        'Could not share the referral code.'
      )
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">
          Loading referrals...
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <section className="bg-gradient-to-r from-blue-700 to-violet-700 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/dashboard"
            className="text-sm text-blue-100 hover:text-white"
          >
            ← Back to Dashboard
          </Link>

          <p className="text-sm font-semibold uppercase tracking-wider text-blue-200 mt-6">
            Invite and earn
          </p>

          <h1 className="text-3xl font-bold text-white mt-2">
            Referrals & Loyalty
          </h1>

          <p className="text-blue-100 mt-2 max-w-2xl">
            Share your unique referral code with another candidate. They can enter this code while applying for a job.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="Loyalty balance"
            value={String(balance)}
            subtitle="points"
            valueClass="text-violet-700"
          />

          <SummaryCard
            label="Total referrals"
            value={String(referrals.length)}
            subtitle="referred applications"
            valueClass="text-blue-700"
          />

          <SummaryCard
            label="Successful referrals"
            value={String(
              referrals.filter(
                (referral) =>
                  referral.status === 'hired' ||
                  referral.referralRewarded
              ).length
            )}
            subtitle="hired candidates"
            valueClass="text-green-700"
          />

          <SummaryCard
            label="Transactions"
            value={String(transactions.length)}
            subtitle="loyalty transactions"
            valueClass="text-orange-600"
          />
        </div>

        <section className="bg-white rounded-2xl border border-violet-100 shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">
                Your unique code
              </p>

              <h2 className="text-2xl font-bold text-gray-900 mt-2">
                Share your referral code
              </h2>

              <p className="text-sm text-gray-500 mt-2 max-w-xl">
                Your referral code is generated automatically by Insta-HR and is unique to your account.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="rounded-xl bg-gray-100 border border-gray-200 px-5 py-3 text-center text-lg font-bold tracking-widest text-gray-900">
                {referralCode || 'Not available'}
              </code>

              <button
                type="button"
                onClick={handleCopyCode}
                disabled={!referralCode}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>

              <button
                type="button"
                onClick={handleShareCode}
                disabled={!referralCode}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Share Code
              </button>
            </div>
          </div>

          {!referralCode && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Referral code is not available yet. Please log out and log in again after confirming the backend user model update.
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900">
            How referrals work
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <StepCard
              number="1"
              title="Copy your code"
              description="Copy the unique referral code shown above."
            />

            <StepCard
              number="2"
              title="Share it"
              description="Send the code to another candidate."
            />

            <StepCard
              number="3"
              title="Candidate applies"
              description="The candidate enters your code while applying for a job."
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Referred applications
            </h2>

            <Link
              href="/jobs"
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Find jobs
            </Link>
          </div>

          {referrals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
              <p className="text-gray-500">
                No referred applications yet.
              </p>

              <p className="text-sm text-gray-400 mt-2">
                When someone applies using your code, their application will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => (
                <article
                  key={referral.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {referral.job?.title ||
                          'Job application'}
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        Candidate:{' '}
                        {referral.candidate?.email ||
                          'Candidate'}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        Applied:{' '}
                        {new Date(
                          referral.createdAt
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        value={referral.status}
                      />

                      <StatusBadge
                        value={
                          referral.referralRewarded
                            ? 'paid'
                            : referral.status === 'hired'
                              ? 'eligible'
                              : 'not_eligible'
                        }
                        prefix="Reward:"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InfoBox
                      label="Referral code"
                      value={
                        referral.referralCodeUsed ||
                        referralCode
                      }
                    />

                    <InfoBox
                      label="Reward points"
                      value={String(
                        referral.referralRewardPoints ||
                          0
                      )}
                    />

                    <InfoBox
                      label="Rewarded at"
                      value={
                        referral.referralRewardedAt
                          ? new Date(
                              referral.referralRewardedAt
                            ).toLocaleDateString()
                          : 'Not rewarded'
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Loyalty transactions
            </h2>

            <span className="text-sm text-gray-500">
              Balance: {balance} points
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
              <p className="text-gray-500">
                No loyalty transactions yet.
              </p>

              <p className="text-sm text-gray-400 mt-2">
                Your rewards will appear here when they are credited.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {transaction.reason ||
                        transaction.type ||
                        'Loyalty transaction'}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(
                        transaction.createdAt
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <span
                    className={`text-sm font-bold ${
                      transaction.points >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {transaction.points >= 0 ? '+' : ''}
                    {transaction.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  subtitle,
  valueClass
}: {
  label: string
  value: string
  subtitle: string
  valueClass: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p
        className={`text-3xl font-bold mt-2 ${valueClass}`}
      >
        {value}
      </p>

      <p className="text-xs text-gray-400 mt-1">
        {subtitle}
      </p>
    </div>
  )
}

function StatusBadge({
  value,
  prefix
}: {
  value: string
  prefix?: string
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
        value
      )}`}
    >
      {prefix ? `${prefix} ` : ''}
      {formatLabel(value)}
    </span>
  )
}

function InfoBox({
  label,
  value
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="text-sm font-semibold text-gray-800 mt-1 truncate">
        {value}
      </p>
    </div>
  )
}

function StepCard({
  number,
  title,
  description
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          {number}
        </span>

        <h3 className="font-semibold text-gray-900">
          {title}
        </h3>
      </div>

      <p className="mt-3 text-sm leading-6 text-gray-500">
        {description}
      </p>
    </div>
  )
}