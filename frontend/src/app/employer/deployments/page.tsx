'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type Deployment = {
  id: string;
  siteName: string;
  location: string;
  reportingManager?: string;
  startDate: string;
  endDate?: string;
  shiftType: string;
  status: 'assigned' | 'active' | 'completed' | 'cancelled' | 'on_hold';
  salaryOffered?: string;
  billingRate?: string;
  notes?: string;
  candidate?: {
    id: string;
    email: string;
  };
  manpowerRequest?: {
    id: string;
    jobTitle: string;
    location: string;
    status: string;
  };
};

type CandidateOption = {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

type ManpowerRequestOption = {
  id: string;
  jobTitle: string;
};

export default function EmployerDeploymentsPage() {
  const [token, setToken] = useState('');
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [requests, setRequests] = useState<ManpowerRequestOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    manpowerRequestId: '',
    candidateId: '',
    siteName: '',
    location: '',
    reportingManager: '',
    startDate: '',
    endDate: '',
    shiftType: 'general',
    salaryOffered: '',
    billingRate: '',
    notes: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchDeployments();
      fetchCandidates();
      fetchRequests();
    }
  }, [token]);

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/deployments`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch deployments');

      setDeployments(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deployments');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API_BASE}/employer/candidates`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch candidates');

      setCandidates(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch candidates');
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/employer/manpower-requests`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch requests');

      setRequests(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch manpower requests');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.candidateId || !form.siteName.trim() || !form.location.trim() || !form.startDate) {
      setError('Candidate, site name, location, and start date are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        ...form,
        manpowerRequestId: form.manpowerRequestId || null,
        endDate: form.endDate || null,
      };

      const res = await fetch(`${API_BASE}/employer/deployments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to create deployment');

      setSuccess('Deployment created successfully.');
      setForm({
        manpowerRequestId: '',
        candidateId: '',
        siteName: '',
        location: '',
        reportingManager: '',
        startDate: '',
        endDate: '',
        shiftType: 'general',
        salaryOffered: '',
        billingRate: '',
        notes: '',
      });

      await fetchDeployments();
    } catch (err: any) {
      setError(err.message || 'Failed to create deployment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/deployments/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to update deployment status');

      setSuccess('Deployment status updated successfully.');
      await fetchDeployments();
    } catch (err: any) {
      setError(err.message || 'Failed to update deployment status');
    }
  };

  const getCandidateLabel = (candidate: CandidateOption) => {
    const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    return fullName ? `${fullName} - ${candidate.email}` : candidate.email;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Candidate Deployments</h1>
          <p className="mt-2 text-sm text-gray-600">
            Assign selected candidates to sites and manage post-selection deployment tracking.
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
              <h2 className="text-xl font-semibold text-gray-900">Create Deployment</h2>
              <p className="mt-1 text-sm text-gray-500">
                Map a candidate to a manpower request, site, shift, and assignment period.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <select
                  name="manpowerRequestId"
                  value={form.manpowerRequestId}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">Select Manpower Request (Optional)</option>
                  {requests.map(request => (
                    <option key={request.id} value={request.id}>
                      {request.jobTitle}
                    </option>
                  ))}
                </select>

                <select
                  name="candidateId"
                  value={form.candidateId}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">Select Candidate</option>
                  {candidates.map(candidate => (
                    <option key={candidate.userId} value={candidate.userId}>
                      {getCandidateLabel(candidate)}
                    </option>
                  ))}
                </select>

                <input
                  name="siteName"
                  value={form.siteName}
                  onChange={handleChange}
                  placeholder="Site Name"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Location"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <input
                  name="reportingManager"
                  value={form.reportingManager}
                  onChange={handleChange}
                  placeholder="Reporting Manager"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <input
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <input
                  name="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <select
                  name="shiftType"
                  value={form.shiftType}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="general">General</option>
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                  <option value="rotational">Rotational</option>
                </select>

                <input
                  name="salaryOffered"
                  value={form.salaryOffered}
                  onChange={handleChange}
                  placeholder="Salary Offered"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <input
                  name="billingRate"
                  value={form.billingRate}
                  onChange={handleChange}
                  placeholder="Billing Rate"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Notes"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submitting ? 'Submitting...' : 'Create Deployment'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Deployment History</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Track site assignments, worker status, and deployment progression.
                  </p>
                </div>

                <button
                  onClick={fetchDeployments}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Candidate</th>
                      <th className="px-3 py-2">Site</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Start Date</th>
                      <th className="px-3 py-2">Shift</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                          Loading deployments...
                        </td>
                      </tr>
                    ) : deployments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                          No deployments created yet.
                        </td>
                      </tr>
                    ) : (
                      deployments.map(item => (
                        <tr key={item.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">
                            {item.candidate?.email || '—'}
                          </td>
                          <td className="px-3 py-4">{item.siteName}</td>
                          <td className="px-3 py-4">{item.location}</td>
                          <td className="px-3 py-4">{item.startDate}</td>
                          <td className="px-3 py-4">{item.shiftType}</td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <select
                              value={item.status}
                              onChange={e => handleStatusChange(item.id, e.target.value)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-black"
                            >
                              <option value="assigned">Assigned</option>
                              <option value="active">Active</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="on_hold">On Hold</option>
                            </select>
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