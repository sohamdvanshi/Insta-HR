'use client';
import { tr, trError, useLocale } from '@/lib/localization'


import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type Contract = {
  id: string;
  contractTitle: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  billingType: 'monthly' | 'hourly' | 'per_resource' | 'fixed';
  billingRate?: string;
  status: 'draft' | 'active' | 'expired' | 'renewed' | 'terminated';
  documentUrl?: string;
  notes?: string;
  deployment?: {
    id: string;
    siteName: string;
    candidate?: {
      id: string;
      email: string;
    };
  };
};

type DeploymentOption = {
  id: string;
  siteName: string;
  candidate?: {
    email: string;
  };
};

export default function EmployerContractsPage() {
  useLocale()

  const [token, setToken] = useState('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [deployments, setDeployments] = useState<DeploymentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    deploymentId: '',
    contractTitle: '',
    contractType: 'staffing',
    startDate: '',
    endDate: '',
    renewalDate: '',
    billingType: 'monthly',
    billingRate: '',
    documentUrl: '',
    notes: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchContracts();
      fetchDeployments();
    }
  }, [token]);

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/contracts`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch contracts');

      setContracts(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      const res = await fetch(`${API_BASE}/employer/deployments`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch deployments');

      setDeployments(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deployments');
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

    if (!form.contractTitle.trim() || !form.startDate) {
      setError('Contract title and start date are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        ...form,
        deploymentId: form.deploymentId || null,
        endDate: form.endDate || null,
        renewalDate: form.renewalDate || null,
        documentUrl: form.documentUrl || null,
      };

      const res = await fetch(`${API_BASE}/employer/contracts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to create contract');

      setSuccess('Contract created successfully.');
      setForm({
        deploymentId: '',
        contractTitle: '',
        contractType: 'staffing',
        startDate: '',
        endDate: '',
        renewalDate: '',
        billingType: 'monthly',
        billingRate: '',
        documentUrl: '',
        notes: '',
      });

      await fetchContracts();
    } catch (err: any) {
      setError(err.message || 'Failed to create contract');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/contracts/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to update contract status');

      setSuccess('Contract status updated successfully.');
      await fetchContracts();
    } catch (err: any) {
      setError(err.message || 'Failed to update contract status');
    }
  };

  const getDeploymentLabel = (deployment: DeploymentOption) => {
    return deployment.candidate?.email
      ? `${deployment.siteName} - ${deployment.candidate.email}`
      : deployment.siteName;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tr("Contract Management")}</h1>
          <p className="mt-2 text-sm text-gray-600">{tr("Track staffing contracts, billing terms, renewal dates, and linked deployments.")}</p>
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
              <h2 className="text-xl font-semibold text-gray-900">{tr("Create Contract")}</h2>
              <p className="mt-1 text-sm text-gray-500">{tr("Add contract lifecycle details, billing terms, and optional deployment linkage.")}</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="deploymentId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Linked Deployment")}</label>
                  <select
                    id="deploymentId"
                    name="deploymentId"
                    value={form.deploymentId}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">{tr("Select Deployment (Optional)")}</option>
                    {deployments.map(deployment => (
                      <option key={deployment.id} value={deployment.id}>
                        {tr(getDeploymentLabel(deployment))}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{tr("Optional. Link this contract to a specific deployment.")}</p>
                </div>

                <div>
                  <label
                    htmlFor="contractTitle"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Contract Title")}</label>
                  <input
                    id="contractTitle"
                    name="contractTitle"
                    value={form.contractTitle}
                    onChange={handleChange}
                    placeholder={tr("Example: ABC Staffing Agreement")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contractType"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Contract Type")}</label>
                  <select
                    id="contractType"
                    name="contractType"
                    value={form.contractType}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="staffing">{tr("Staffing")}</option>
                    <option value="service">{tr("Service")}</option>
                    <option value="project">{tr("Project")}</option>
                    <option value="amc">{tr("AMC")}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="startDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Start Date")}</label>
                  <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                  <p className="mt-1 text-xs text-gray-500">{tr("The date the contract becomes active.")}</p>
                </div>

                <div>
                  <label
                    htmlFor="endDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("End Date")}</label>
                  <input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                  <p className="mt-1 text-xs text-gray-500">{tr("Optional. The date the current contract term ends.")}</p>
                </div>

                <div>
                  <label
                    htmlFor="renewalDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Renewal Date")}</label>
                  <input
                    id="renewalDate"
                    name="renewalDate"
                    type="date"
                    value={form.renewalDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                  <p className="mt-1 text-xs text-gray-500">{tr("Optional. Use this to track when the contract should be reviewed or renewed.")}</p>
                </div>

                <div>
                  <label
                    htmlFor="billingType"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Billing Type")}</label>
                  <select
                    id="billingType"
                    name="billingType"
                    value={form.billingType}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="monthly">{tr("Monthly")}</option>
                    <option value="hourly">{tr("Hourly")}</option>
                    <option value="per_resource">{tr("Per Resource")}</option>
                    <option value="fixed">{tr("Fixed")}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="billingRate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Billing Rate")}</label>
                  <input
                    id="billingRate"
                    name="billingRate"
                    value={form.billingRate}
                    onChange={handleChange}
                    placeholder={tr("Example: ₹30,000 / month")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="documentUrl"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Document URL")}</label>
                  <input
                    id="documentUrl"
                    name="documentUrl"
                    value={form.documentUrl}
                    onChange={handleChange}
                    placeholder={tr("Paste contract document link")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Notes")}</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder={tr("Add internal notes")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {tr(submitting ? 'Submitting...' : 'Create Contract')}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{tr("Contract History")}</h2>
                  <p className="mt-1 text-sm text-gray-500">{tr("View lifecycle status, linked deployment, and core billing details.")}</p>
                </div>

                <button
                  onClick={fetchContracts}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >{tr("Refresh")}</button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">{tr("Title")}</th>
                      <th className="px-3 py-2">{tr("Deployment")}</th>
                      <th className="px-3 py-2">{tr("Start")}</th>
                      <th className="px-3 py-2">{tr("Renewal")}</th>
                      <th className="px-3 py-2">{tr("Billing")}</th>
                      <th className="px-3 py-2">{tr("Status")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">{tr("Loading contracts...")}</td>
                      </tr>
                    ) : contracts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">{tr("No contracts created yet.")}</td>
                      </tr>
                    ) : (
                      contracts.map(item => (
                        <tr key={item.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">
                            {tr(item.contractTitle)}
                          </td>
                          <td className="px-3 py-4">
                            {tr(item.deployment
                              ? `${item.deployment.siteName}${item.deployment.candidate?.email ? ` - ${item.deployment.candidate.email}` : ''}`
                              : '—')}
                          </td>
                          <td className="px-3 py-4">{tr(item.startDate)}</td>
                          <td className="px-3 py-4">{tr(item.renewalDate || '—')}</td>
                          <td className="px-3 py-4">
                            {tr(item.billingType)}
                            {tr(item.billingRate ? ` - ${item.billingRate}` : '')}
                          </td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <select
                              value={item.status}
                              onChange={e => handleStatusChange(item.id, e.target.value)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-black"
                            >
                              <option value="draft">{tr("Draft")}</option>
                              <option value="active">{tr("Active")}</option>
                              <option value="expired">{tr("Expired")}</option>
                              <option value="renewed">{tr("Renewed")}</option>
                              <option value="terminated">{tr("Terminated")}</option>
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