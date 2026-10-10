'use client'
import { tr, trError, useLocale } from '@/lib/localization'


import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'

type RecipientStatus = 'applied' | 'shortlisted' | 'hired' | 'rejected'

type Job = {
  id: string
  title: string
  companyName?: string
}

type CandidateApplication = {
  id: string
  candidate?: {
    id: string
    email: string
    fullName?: string
    candidateName?: string
  }
}

type Campaign = {
  id: string
  subject: string
  message: string
  recipientStatus?: RecipientStatus
  recipientCount: number
  sentCount: number
  failedCount: number
  status: 'draft' | 'sending' | 'sent' | 'failed'
  sentAt?: string | null
  createdAt?: string
  job?: {
    id: string
    title: string
    companyName?: string
  }
}

const RECIPIENT_OPTIONS: Array<{
  value: RecipientStatus
  label: string
}> = [
  { value: 'applied', label: 'Applied Candidates' },
  { value: 'shortlisted', label: 'Shortlisted Candidates' },
  { value: 'hired', label: 'Hired Candidates' },
  { value: 'rejected', label: 'Rejected Candidates' }
]

const getRecipientLabel = (status?: RecipientStatus) => {
  return RECIPIENT_OPTIONS.find((option) => option.value === status)?.label || 'Shortlisted Candidates'
}

export default function EmployerCampaignsPage() {
  useLocale()

  const [token, setToken] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatus>('shortlisted')
  const [recipientCount, setRecipientCount] = useState(0)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sendingCampaignId, setSendingCampaignId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const storedToken = (
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('authToken') ||
      ''
    )

    setToken(storedToken)
  }, [])

  useEffect(() => {
    if (!token) return

    fetchEmployerJobs()
    fetchCampaigns()
  }, [token])

  useEffect(() => {
    if (!token || !selectedJobId) {
      setRecipientCount(0)
      return
    }

    fetchRecipients(selectedJobId, recipientStatus)
  }, [token, selectedJobId, recipientStatus])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId),
    [jobs, selectedJobId]
  )

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`
  })

  const fetchEmployerJobs = async () => {
    try {
      setLoadingJobs(true)
      setError('')

      const res = await fetch(`${API_BASE}/employer/jobs`, {
        headers: authHeaders(false)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch jobs')
      }

      const jobList = data.data || data.jobs || []
      setJobs(jobList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs')
    } finally {
      setLoadingJobs(false)
    }
  }

  const fetchCampaigns = async () => {
    try {
      setLoadingCampaigns(true)
      setError('')

      const res = await fetch(`${API_BASE}/employer/campaigns`, {
        headers: authHeaders(false)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch campaigns')
      }

      setCampaigns(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns')
    } finally {
      setLoadingCampaigns(false)
    }
  }

  const fetchRecipients = async (
    jobId: string,
    status: RecipientStatus
  ) => {
    try {
      setLoadingRecipients(true)
      setError('')

      const params = new URLSearchParams({ status })
      const res = await fetch(
        `${API_BASE}/employer/campaigns/jobs/${jobId}/candidates?${params.toString()}`,
        {
          headers: authHeaders(false)
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || `Failed to fetch ${status} candidates`)
      }

      const applications: CandidateApplication[] = data.data || []
      setRecipientCount(applications.length)
    } catch (err) {
      setRecipientCount(0)
      setError(err instanceof Error ? err.message : 'Failed to fetch candidates')
    } finally {
      setLoadingRecipients(false)
    }
  }

  const handleCreateCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedJobId || !subject.trim() || !message.trim()) {
      setError('Please select a job and fill in subject and message.')
      return
    }

    try {
      setCreating(true)
      setError('')
      setSuccess('')

      const res = await fetch(`${API_BASE}/employer/campaigns`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          jobId: selectedJobId,
          subject: subject.trim(),
          message: message.trim(),
          recipientStatus
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create campaign')
      }

      setSuccess(
        `Campaign created for ${getRecipientLabel(recipientStatus).toLowerCase()}.`
      )
      setSubject('')
      setMessage('')
      await fetchCampaigns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  const handleSendCampaign = async (
    campaignId: string,
    campaignRecipientCount: number,
    campaignRecipientStatus?: RecipientStatus
  ) => {
    if (campaignRecipientCount === 0) {
      setError('This campaign has no candidates in the selected category.')
      return
    }

    const targetLabel = getRecipientLabel(campaignRecipientStatus).toLowerCase()
    const confirmSend = window.confirm(
      `Send this campaign to ${targetLabel} now?`
    )

    if (!confirmSend) return

    try {
      setSendingCampaignId(campaignId)
      setError('')
      setSuccess('')

      const res = await fetch(`${API_BASE}/employer/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: authHeaders(false)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send campaign')
      }

      const totalRecipients = data?.data?.recipientCount ?? campaignRecipientCount
      const sentCount = data?.data?.sentCount ?? 0
      const failedCount = data?.data?.failedCount ?? 0

      setSuccess(
        `Campaign completed successfully. Recipients: ${totalRecipients}, Sent: ${sentCount}, Failed: ${failedCount}`
      )

      await fetchCampaigns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign')
    } finally {
      setSendingCampaignId('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tr("Email Campaigns")}</h1>
          <p className="mt-2 text-sm text-gray-600">{tr("Send email campaigns to candidates based on their application status.")}</p>
        </div>

        {!token && (
          <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">{tr("JWT token not found in localStorage. Please login again as employer.")}</div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {trError(error)}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {tr(success)}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{tr("Create Campaign")}</h2>
              <p className="mt-1 text-sm text-gray-500">{tr("Select a job, candidate category, subject and message.")}</p>

              <form onSubmit={handleCreateCampaign} className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{tr("Select Job")}</label>
                  <select
                    value={selectedJobId}
                    onChange={(event) => setSelectedJobId(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">{tr("Choose a job")}</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} {tr(job.companyName ? `- ${job.companyName}` : '')}
                      </option>
                    ))}
                  </select>
                  {loadingJobs && (
                    <p className="mt-2 text-xs text-gray-500">{tr("Loading jobs...")}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{tr("Send To")}</label>
                  <select
                    value={recipientStatus}
                    onChange={(event) => setRecipientStatus(event.target.value as RecipientStatus)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    {RECIPIENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {tr(option.label)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-700">
                    {tr(getRecipientLabel(recipientStatus))}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {tr(loadingRecipients ? '...' : recipientCount)}
                  </p>
                  {selectedJob && (
                    <p className="mt-1 text-xs text-gray-500">{tr("For job: ")}{selectedJob.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{tr("Subject")}</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder={tr("Enter email subject")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{tr("Message")}</label>
                  <textarea
                    rows={8}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={tr("Write your campaign message here...")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {tr(creating ? 'Creating...' : 'Create Campaign')}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{tr("Campaign History")}</h2>
                  <p className="mt-1 text-sm text-gray-500">{tr("Review, track, and send your drafted campaigns.")}</p>
                </div>
                <button
                  type="button"
                  onClick={fetchCampaigns}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >{tr("Refresh")}</button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">{tr("Job")}</th>
                      <th className="px-3 py-2">{tr("Send To")}</th>
                      <th className="px-3 py-2">{tr("Subject")}</th>
                      <th className="px-3 py-2">{tr("Status")}</th>
                      <th className="px-3 py-2">{tr("Recipients")}</th>
                      <th className="px-3 py-2">{tr("Sent")}</th>
                      <th className="px-3 py-2">{tr("Failed")}</th>
                      <th className="px-3 py-2">{tr("Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCampaigns ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">{tr("Loading campaigns...")}</td>
                      </tr>
                    ) : campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">{tr("No campaigns created yet.")}</td>
                      </tr>
                    ) : (
                      campaigns.map((campaign) => (
                        <tr key={campaign.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">
                            {campaign.job?.title || tr('—')}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                              {tr(campaign.recipientStatus || 'shortlisted')}
                            </span>
                          </td>
                          <td className="px-3 py-4">{tr(campaign.subject)}</td>
                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                campaign.status === 'sent'
                                  ? 'bg-green-100 text-green-700'
                                  : campaign.status === 'sending'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : campaign.status === 'failed'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {tr(campaign.status)}
                            </span>
                          </td>
                          <td className="px-3 py-4">{campaign.recipientCount}</td>
                          <td className="px-3 py-4">{campaign.sentCount}</td>
                          <td className="px-3 py-4">{campaign.failedCount}</td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <button
                              type="button"
                              onClick={() => handleSendCampaign(
                                campaign.id,
                                campaign.recipientCount,
                                campaign.recipientStatus || 'shortlisted'
                              )}
                              disabled={
                                sendingCampaignId === campaign.id ||
                                campaign.status === 'sent' ||
                                campaign.recipientCount === 0
                              }
                              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                              {tr(sendingCampaignId === campaign.id
                                ? 'Sending...'
                                : campaign.status === 'sent'
                                  ? 'Sent'
                                  : campaign.recipientCount === 0
                                    ? 'No Recipients'
                                    : 'Send Now')}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
