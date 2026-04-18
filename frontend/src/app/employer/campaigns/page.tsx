'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type Job = {
  id: string;
  title: string;
  companyName?: string;
};

type CandidateApplication = {
  id: string;
  candidate?: {
    id: string;
    email: string;
    fullName?: string;
  };
};

type Campaign = {
  id: string;
  subject: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  sentAt?: string | null;
  createdAt?: string;
  job?: {
    id: string;
    title: string;
    companyName?: string;
  };
};

export default function EmployerCampaignsPage() {
  const [token, setToken] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [shortlistedCount, setShortlistedCount] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingShortlisted, setLoadingShortlisted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchEmployerJobs();
    fetchCampaigns();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedJobId) {
      setShortlistedCount(0);
      return;
    }
    fetchShortlistedCandidates(selectedJobId);
  }, [token, selectedJobId]);

  const selectedJob = useMemo(
    () => jobs.find(job => job.id === selectedJobId),
    [jobs, selectedJobId]
  );

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchEmployerJobs = async () => {
    try {
      setLoadingJobs(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/jobs`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch jobs');
      }

      const jobList = data.data || data.jobs || [];
      setJobs(jobList);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch jobs');
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/campaigns`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch campaigns');
      }

      setCampaigns(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchShortlistedCandidates = async (jobId: string) => {
    try {
      setLoadingShortlisted(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/campaigns/jobs/${jobId}/shortlisted-candidates`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch shortlisted candidates');
      }

      const applications: CandidateApplication[] = data.data || [];
      setShortlistedCount(applications.length);
    } catch (err: any) {
      setShortlistedCount(0);
      setError(err.message || 'Failed to fetch shortlisted candidates');
    } finally {
      setLoadingShortlisted(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedJobId || !subject.trim() || !message.trim()) {
      setError('Please select a job and fill in subject and message.');
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/campaigns`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          jobId: selectedJobId,
          subject,
          message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create campaign');
      }

      setSuccess('Campaign created successfully.');
      setSubject('');
      setMessage('');
      await fetchCampaigns();
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleSendCampaign = async (campaignId: string, recipientCount: number) => {
    if (recipientCount === 0) {
      setError('This campaign has no shortlisted candidates to send to.');
      return;
    }

    const confirmSend = window.confirm('Send this campaign to shortlisted candidates now?');
    if (!confirmSend) return;

    try {
      setSendingCampaignId(campaignId);
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send campaign');
      }

      const totalRecipients = data?.data?.recipientCount ?? recipientCount ?? 0;
      const sentCount = data?.data?.sentCount ?? 0;
      const failedCount = data?.data?.failedCount ?? 0;

      setSuccess(
        `Campaign completed successfully. Recipients: ${totalRecipients}, Sent: ${sentCount}, Failed: ${failedCount}`
      );

      await fetchCampaigns();
    } catch (err: any) {
      setError(err.message || 'Failed to send campaign');
    } finally {
      setSendingCampaignId('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="mt-2 text-sm text-gray-600">
            Send email campaigns to shortlisted candidates for a specific job.
          </p>
        </div>

        {!token && (
          <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            JWT token not found in localStorage. Please login again as employer.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create Campaign</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select a job, write a subject and message, then create the campaign.
              </p>

              <form onSubmit={handleCreateCampaign} className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Select Job
                  </label>
                  <select
                    value={selectedJobId}
                    onChange={e => setSelectedJobId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">Choose a job</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} {job.companyName ? `- ${job.companyName}` : ''}
                      </option>
                    ))}
                  </select>
                  {loadingJobs && (
                    <p className="mt-2 text-xs text-gray-500">Loading jobs...</p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-700">Shortlisted Candidates</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {loadingShortlisted ? '...' : shortlistedCount}
                  </p>
                  {selectedJob && (
                    <p className="mt-1 text-xs text-gray-500">
                      For job: {selectedJob.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Message
                  </label>
                  <textarea
                    rows={8}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Write your campaign message here..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {creating ? 'Creating...' : 'Create Campaign'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Campaign History</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Review, track, and send your drafted campaigns.
                  </p>
                </div>
                <button
                  onClick={fetchCampaigns}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Recipients</th>
                      <th className="px-3 py-2">Sent</th>
                      <th className="px-3 py-2">Failed</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCampaigns ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                          Loading campaigns...
                        </td>
                      </tr>
                    ) : campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                          No campaigns created yet.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map(campaign => (
                        <tr key={campaign.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">
                            {campaign.job?.title || '—'}
                          </td>
                          <td className="px-3 py-4">{campaign.subject}</td>
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
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-3 py-4">{campaign.recipientCount}</td>
                          <td className="px-3 py-4">{campaign.sentCount}</td>
                          <td className="px-3 py-4">{campaign.failedCount}</td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <button
                              onClick={() => handleSendCampaign(campaign.id, campaign.recipientCount)}
                              disabled={
                                sendingCampaignId === campaign.id ||
                                campaign.status === 'sent' ||
                                campaign.recipientCount === 0
                              }
                              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                              {sendingCampaignId === campaign.id
                                ? 'Sending...'
                                : campaign.status === 'sent'
                                ? 'Sent'
                                : campaign.recipientCount === 0
                                ? 'No Recipients'
                                : 'Send Now'}
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
  );
}