'use client';
import { tr, trError, useLocale } from '@/lib/localization'


import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type PayrollOption = {
  id: string;
  payPeriodMonth: string;
  netSalary: string;
  deploymentId?: string;
};

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  billingPeriodMonth: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paymentTerms?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
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
  payroll?: {
    id: string;
    payPeriodMonth: string;
    netSalary: string;
    status: string;
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

export default function EmployerInvoicesPage() {
  useLocale()

  const [token, setToken] = useState('');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentOption[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    deploymentId: '',
    payrollId: '',
    billingPeriodMonth: '',
    invoiceDate: '',
    dueDate: '',
    subtotal: '',
    taxAmount: '',
    paymentTerms: 'Net 30',
    remarks: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchInvoices();
      fetchDeployments();
      fetchPayrolls();
    }
  }, [token]);

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/invoices`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch invoices');

      setInvoices(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch invoices');
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

  const fetchPayrolls = async () => {
    try {
      const res = await fetch(`${API_BASE}/employer/payrolls`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch payrolls');

      setPayrolls(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payrolls');
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

  const formatCurrency = (value?: string | number) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totalPreview = Number(form.subtotal || 0) + Number(form.taxAmount || 0);

  const filteredPayrolls = form.deploymentId
    ? payrolls.filter(item => item.deploymentId === form.deploymentId)
    : payrolls;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.deploymentId ||
      !form.billingPeriodMonth ||
      !form.invoiceDate ||
      !form.dueDate ||
      !form.subtotal
    ) {
      setError('Deployment, billing month, invoice date, due date, and subtotal are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        deploymentId: form.deploymentId,
        payrollId: form.payrollId || null,
        billingPeriodMonth: form.billingPeriodMonth,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        subtotal: Number(form.subtotal),
        taxAmount: Number(form.taxAmount || 0),
        paymentTerms: form.paymentTerms || 'Net 30',
        remarks: form.remarks || null,
      };

      const res = await fetch(`${API_BASE}/employer/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to create invoice');

      setSuccess('Invoice created successfully.');
      setForm({
        deploymentId: '',
        payrollId: '',
        billingPeriodMonth: '',
        invoiceDate: '',
        dueDate: '',
        subtotal: '',
        taxAmount: '',
        paymentTerms: 'Net 30',
        remarks: '',
      });

      await fetchInvoices();
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/employer/invoices/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to update invoice status');

      setSuccess('Invoice status updated successfully.');
      await fetchInvoices();
    } catch (err: any) {
      setError(err.message || 'Failed to update invoice status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tr("Invoice & Billing")}</h1>
          <p className="mt-2 text-sm text-gray-600">{tr("Generate deployment-linked invoices and track billing lifecycle status.")}</p>
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
              <h2 className="text-xl font-semibold text-gray-900">{tr("Create Invoice")}</h2>
              <p className="mt-1 text-sm text-gray-500">{tr("Create a billing record for a deployment and billing period.")}</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="deploymentId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Deployment")}</label>
                  <select
                    id="deploymentId"
                    name="deploymentId"
                    value={form.deploymentId}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">{tr("Select Deployment")}</option>
                    {deployments.map(deployment => (
                      <option key={deployment.id} value={deployment.id}>
                        {tr(getDeploymentLabel(deployment))}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payrollId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Linked Payroll")}</label>
                  <select
                    id="payrollId"
                    name="payrollId"
                    value={form.payrollId}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="">{tr("Select Payroll (Optional)")}</option>
                    {filteredPayrolls.map(payroll => (
                      <option key={payroll.id} value={payroll.id}>
                        {tr(payroll.payPeriodMonth)} - {tr(formatCurrency(payroll.netSalary))}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="billingPeriodMonth"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Billing Month")}</label>
                  <input
                    id="billingPeriodMonth"
                    name="billingPeriodMonth"
                    type="month"
                    value={form.billingPeriodMonth}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="invoiceDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Invoice Date")}</label>
                  <input
                    id="invoiceDate"
                    name="invoiceDate"
                    type="date"
                    value={form.invoiceDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dueDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Due Date")}</label>
                  <input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="subtotal"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Subtotal")}</label>
                  <input
                    id="subtotal"
                    name="subtotal"
                    type="number"
                    step="0.01"
                    value={form.subtotal}
                    onChange={handleChange}
                    placeholder={tr("Enter subtotal")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="taxAmount"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Tax Amount")}</label>
                  <input
                    id="taxAmount"
                    name="taxAmount"
                    type="number"
                    step="0.01"
                    value={form.taxAmount}
                    onChange={handleChange}
                    placeholder={tr("Enter tax amount")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="paymentTerms"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Payment Terms")}</label>
                  <select
                    id="paymentTerms"
                    name="paymentTerms"
                    value={form.paymentTerms}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="Net 7">{tr("Net 7")}</option>
                    <option value="Net 15">{tr("Net 15")}</option>
                    <option value="Net 30">{tr("Net 30")}</option>
                    <option value="Net 45">{tr("Net 45")}</option>
                  </select>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{tr("Total Preview")}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {tr(formatCurrency(totalPreview))}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="remarks"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >{tr("Remarks")}</label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    rows={4}
                    placeholder={tr("Optional invoice notes")}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {tr(submitting ? 'Submitting...' : 'Create Invoice')}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{tr("Invoice History")}</h2>
                  <p className="mt-1 text-sm text-gray-500">{tr("Track invoice values, dates, linked payroll, and payment status.")}</p>
                </div>

                <button
                  onClick={fetchInvoices}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >{tr("Refresh")}</button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">{tr("Invoice No.")}</th>
                      <th className="px-3 py-2">{tr("Candidate")}</th>
                      <th className="px-3 py-2">{tr("Deployment")}</th>
                      <th className="px-3 py-2">{tr("Billing Month")}</th>
                      <th className="px-3 py-2">{tr("Invoice Date")}</th>
                      <th className="px-3 py-2">{tr("Due Date")}</th>
                      <th className="px-3 py-2">{tr("Total")}</th>
                      <th className="px-3 py-2">{tr("Payroll")}</th>
                      <th className="px-3 py-2">{tr("Status")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">{tr("Loading invoices...")}</td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">{tr("No invoices found.")}</td>
                      </tr>
                    ) : (
                      invoices.map(item => (
                        <tr key={item.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                          <td className="rounded-l-2xl px-3 py-4 font-medium">{tr(item.invoiceNumber)}</td>
                          <td className="px-3 py-4">
                            {tr(item.candidate?.email || item.deployment?.candidate?.email || '—')}
                          </td>
                          <td className="px-3 py-4">{tr(item.deployment?.siteName || '—')}</td>
                          <td className="px-3 py-4">{tr(item.billingPeriodMonth)}</td>
                          <td className="px-3 py-4">{tr(item.invoiceDate)}</td>
                          <td className="px-3 py-4">{tr(item.dueDate)}</td>
                          <td className="px-3 py-4 font-semibold">
                            {tr(formatCurrency(item.totalAmount))}
                          </td>
                          <td className="px-3 py-4">
                            {tr(item.payroll
                              ? `${item.payroll.payPeriodMonth} - ${formatCurrency(item.payroll.netSalary)}`
                              : '—')}
                          </td>
                          <td className="rounded-r-2xl px-3 py-4">
                            <select
                              value={item.status}
                              onChange={e => handleStatusChange(item.id, e.target.value)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-black"
                            >
                              <option value="draft">{tr("Draft")}</option>
                              <option value="sent">{tr("Sent")}</option>
                              <option value="paid">{tr("Paid")}</option>
                              <option value="overdue">{tr("Overdue")}</option>
                              <option value="cancelled">{tr("Cancelled")}</option>
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