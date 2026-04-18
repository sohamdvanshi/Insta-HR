'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type ManpowerRequest = {
  id: string;
  jobTitle: string;
  department?: string;
  headcountRequired: number;
  location: string;
  shiftType: string;
  employmentType: string;
  contractDuration?: string;
  salaryBudget?: string;
  billingType: string;
  startDate?: string;
  skillsRequired?: string;
  experienceRequired?: string;
  notes?: string;
  status: 'open' | 'in_progress' | 'fulfilled' | 'closed' | 'cancelled';
  createdAt?: string;
};

export default function EmployerManpowerRequestsPage() {
  const [token, setToken] = useState('');
  const [requests, setRequests] = useState<ManpowerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    jobTitle: '',
    department: '',
    headcountRequired: 1,
    location: '',
    shiftType: 'general',
    employmentType: 'contract',
    contractDuration: '',
    salaryBudget: '',
    billingType: 'monthly',
    startDate: '',
    skillsRequired: '',
    experienceRequired: '',
    notes: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchRequests();
    }
  }, [token]);

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/manpower-requests`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch manpower requests');
      }

      setRequests(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch manpower requests');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.name === 'headcountRequired' ? Number(e.target.value) : e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.jobTitle.trim() || !form.location.trim() || !form.headcountRequired) {
      setError('Job title, headcount, and location are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/manpower-requests`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create manpower request');
      }

      setSuccess('Manpower request created successfully.');
      setForm({
        jobTitle: '',
        department: '',
        headcountRequired: 1,
        location: '',
        shiftType: 'general',
        employmentType: 'contract',
        contractDuration: '',
        salaryBudget: '',
        billingType: 'monthly',
        startDate: '',
        skillsRequired: '',
        experienceRequired: '',
        notes: '',
      });

      await fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to create manpower request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/manpower-requests/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update status');
      }

      setSuccess('Request status updated successfully.');
      await fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Client Manpower Requests</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create and manage outsourcing manpower requirements for your company.
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
              <h2 className="text-xl font-semibold text-gray-900">Create Request</h2>
              <p className="mt-1 text-sm text-gray-500">
                Submit your manpower requirement with role, headcount, timing, and budget details.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <input name="jobTitle" value={form.jobTitle} onChange={handleChange} placeholder="Job Title" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />
                <input name="department" value={form.department} onChange={handleChange} placeholder="Department" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />
                <input name="headcountRequired" type="number" min="1" value={form.headcountRequired} onChange={handleChange} placeholder="Headcount Required" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />
                <input name="location" value={form.location} onChange={handleChange} placeholder="Location" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />

                <select name="shiftType" value={form.shiftType} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black">
                  <option value="general">General</option>
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                  <option value="rotational">Rotational</option>
                </select>

                <select name="employmentType" value={form.employmentType} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black">
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                  <option value="permanent">Permanent</option>
                  <option value="project">Project</option>
                </select>

                <input name="contractDuration" value={form.contractDuration} onChange={handleChange} placeholder="Contract Duration (e.g. 6 months)" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />
                <input name="salaryBudget" value={form.salaryBudget} onChange={handleChange} placeholder="Salary Budget" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />

                <select name="billingType" value={form.billingType} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black">
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                </select>

                <input name="startDate" type="date" value={form.startDate} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />
                <input name="experienceRequired" value={form.experienceRequired} onChange={handleChange} placeholder="Experience Required (e.g. 2-4 years)" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />

                <textarea name="skillsRequired" value={form.skillsRequired} onChange={handleChange} rows={3} placeholder="Skills Required" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} placeholder="Additional Notes / Justification" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black" />

                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submitting ? 'Submitting...' : 'Create Manpower Request'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Request History</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Track all manpower requests and update their statuses.
                  </p>
                </div>
                <button
                  onClick={fetchRequests}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Headcount</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Start Date</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                          Loading requests...
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                          No manpower requests created yet.
                        </td>
                      </tr>
                    ) : (
                      requests.map(request => (
                        <tr key={request.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">{request.jobTitle}</td>
                          <td className="px-3 py-4">{request.headcountRequired}</td>
                          <td className="px-3 py-4">{request.location}</td>
                          <td className="px-3 py-4">{request.employmentType}</td>
                          <td className="px-3 py-4">{request.startDate || '—'}</td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <select
                              value={request.status}
                              onChange={e => handleStatusChange(request.id, e.target.value)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-black"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="fulfilled">Fulfilled</option>
                              <option value="closed">Closed</option>
                              <option value="cancelled">Cancelled</option>
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