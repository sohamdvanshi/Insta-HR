'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type PayrollRecord = {
  id: string;
  payPeriodMonth: string;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalHalfDays: number;
  grossSalary: string;
  deductions: string;
  bonus: string;
  netSalary: string;
  status: 'draft' | 'processed' | 'paid';
  remarks?: string | null;
  deployment?: {
    id: string;
    siteName: string;
    location?: string;
    candidate?: {
      id: string;
      email: string;
    };
  };
  candidate?: {
    id: string;
    email: string;
  };
};

type DeploymentOption = {
  id: string;
  siteName: string;
  location?: string;
  candidate?: {
    id: string;
    email: string;
  };
};

export default function EmployerPayrollsPage() {
  const [token, setToken] = useState('');
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    deploymentId: '',
    payPeriodMonth: '',
    grossSalary: '',
    deductions: '',
    bonus: '',
    remarks: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchPayrolls();
      fetchDeployments();
    }
  }, [token]);

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/payrolls`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch payrolls');

      setPayrolls(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payrolls');
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

  const getDeploymentLabel = (deployment: DeploymentOption) => {
    return deployment.candidate?.email
      ? `${deployment.siteName} - ${deployment.candidate.email}`
      : deployment.siteName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.deploymentId || !form.payPeriodMonth || !form.grossSalary) {
      setError('Deployment, payroll month, and gross salary are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        deploymentId: form.deploymentId,
        payPeriodMonth: form.payPeriodMonth,
        grossSalary: Number(form.grossSalary),
        deductions: Number(form.deductions || 0),
        bonus: Number(form.bonus || 0),
        remarks: form.remarks || null,
      };

      const res = await fetch(`${API_BASE}/employer/payrolls`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to create payroll');

      setSuccess('Payroll created successfully.');
      setForm({
        deploymentId: '',
        payPeriodMonth: '',
        grossSalary: '',
        deductions: '',
        bonus: '',
        remarks: '',
      });

      await fetchPayrolls();
    } catch (err: any) {
      setError(err.message || 'Failed to create payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/payrolls/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to update payroll status');

      setSuccess('Payroll status updated successfully.');
      await fetchPayrolls();
    } catch (err: any) {
      setError(err.message || 'Failed to update payroll status');
    }
  };

  const formatCurrency = (value?: string | number) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Generate monthly payroll records from deployment and attendance data.
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
              <h2 className="text-xl font-semibold text-gray-900">Create Payroll</h2>
              <p className="mt-1 text-sm text-gray-500">
                Create a monthly payroll record for a deployment.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="deploymentId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Deployment
                  </label>
                  <select
                    id="deploymentId"
                    name="deploymentId"
                    value={form.deploymentId}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">Select Deployment</option>
                    {deployments.map(deployment => (
                      <option key={deployment.id} value={deployment.id}>
                        {getDeploymentLabel(deployment)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payPeriodMonth"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Payroll Month
                  </label>
                  <input
                    id="payPeriodMonth"
                    name="payPeriodMonth"
                    type="month"
                    value={form.payPeriodMonth}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grossSalary"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Gross Salary
                  </label>
                  <input
                    id="grossSalary"
                    name="grossSalary"
                    type="number"
                    step="0.01"
                    value={form.grossSalary}
                    onChange={handleChange}
                    placeholder="Enter gross salary"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="deductions"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Deductions
                  </label>
                  <input
                    id="deductions"
                    name="deductions"
                    type="number"
                    step="0.01"
                    value={form.deductions}
                    onChange={handleChange}
                    placeholder="Enter deductions"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="bonus"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Bonus
                  </label>
                  <input
                    id="bonus"
                    name="bonus"
                    type="number"
                    step="0.01"
                    value={form.bonus}
                    onChange={handleChange}
                    placeholder="Enter bonus"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="remarks"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Remarks
                  </label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Optional payroll notes"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submitting ? 'Submitting...' : 'Create Payroll'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Payroll History</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Review attendance summary, payroll values, and payout status.
                  </p>
                </div>

                <button
                  onClick={fetchPayrolls}
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
                      <th className="px-3 py-2">Deployment</th>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Attendance</th>
                      <th className="px-3 py-2">Gross</th>
                      <th className="px-3 py-2">Deductions</th>
                      <th className="px-3 py-2">Bonus</th>
                      <th className="px-3 py-2">Net</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">
                          Loading payrolls...
                        </td>
                      </tr>
                    ) : payrolls.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">
                          No payroll records found.
                        </td>
                      </tr>
                    ) : (
                      payrolls.map(item => (
                        <tr key={item.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">
                            {item.candidate?.email || item.deployment?.candidate?.email || '—'}
                          </td>
                          <td className="px-3 py-4">{item.deployment?.siteName || '—'}</td>
                          <td className="px-3 py-4">{item.payPeriodMonth}</td>
                          <td className="px-3 py-4">
                            P: {item.totalPresentDays}, A: {item.totalAbsentDays}, H: {item.totalHalfDays}
                          </td>
                          <td className="px-3 py-4">{formatCurrency(item.grossSalary)}</td>
                          <td className="px-3 py-4">{formatCurrency(item.deductions)}</td>
                          <td className="px-3 py-4">{formatCurrency(item.bonus)}</td>
                          <td className="px-3 py-4 font-semibold">{formatCurrency(item.netSalary)}</td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <select
                              value={item.status}
                              onChange={e => handleStatusChange(item.id, e.target.value)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-black"
                            >
                              <option value="draft">Draft</option>
                              <option value="processed">Processed</option>
                              <option value="paid">Paid</option>
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