'use client';
import { tr, trError, useLocale } from '@/lib/localization'


import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type Summary = {
  totalUsers: number;
  totalJobs: number;
  totalApplications: number;
  shortlistedCandidates: number;
  hiredCandidates: number;
  activeDeployments: number;
  totalPayrollAmount: number;
  totalInvoiceAmount: number;
  totalRevenue: number;
};

type TrendItem = {
  month: string;
  count: number;
};

type IndustryItem = {
  industry: string;
  count: number;
};

type FunnelItem = {
  stage: string;
  count: number;
};

type StatusItem = {
  status: string;
  count: number;
};

type PayrollSummary = {
  statuses: StatusItem[];
  totalNetSalary: number;
  totalPayrolls: number;
};

type InvoiceSummary = {
  statuses: StatusItem[];
  totalInvoiceAmount: number;
  totalInvoices: number;
};

type TrainingAnalytics = {
  totalCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  inProgressEnrollments: number;
  completionRate: number;
};

type TopEmployer = {
  employerId: string;
  employerName: string;
  jobsPosted: number;
};

type TopJob = {
  jobId: string;
  jobTitle: string;
  applications: number;
};

type CountItem = {
  count: number;
  [key: string]: string | number;
};

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const safeArray = <T,>(value: T[] | undefined | null): T[] => {
  return Array.isArray(value) ? value.filter(Boolean) : [];
};

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeCountData = <T extends Record<string, unknown>>(
  items: T[] | undefined | null,
  labelKey: string
): CountItem[] => {
  return safeArray(items).map((item) => ({
    [labelKey]: String(item?.[labelKey] ?? 'Unknown'),
    count: toNumber(item?.count),
  }));
};

const hasPositiveCounts = (items: CountItem[]) => {
  return items.some((item) => toNumber(item.count) > 0);
};

const formatCompact = (value?: number) =>
  new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value));

const formatNumber = (value?: number) =>
  new Intl.NumberFormat('en-IN').format(toNumber(value));

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(toNumber(value));

function DashboardCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  useLocale()

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm font-medium text-gray-500">{tr(label)}</p>
      <p className="mt-3 break-words text-2xl font-bold text-gray-900">{tr(value)}</p>
      {hint ? <p className="mt-2 text-xs text-gray-400">{tr(hint)}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  heightClass = 'h-80',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  heightClass?: string;
}) {
  useLocale()

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">{tr(title)}</h2>
      {description ? <p className="mt-1 text-sm text-gray-500">{tr(description)}</p> : null}
      <div className={`mt-6 ${heightClass}`}>{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  useLocale()

  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
      {tr(message)}
    </div>
  );
}

function RankingList({
  items,
  valueKey,
  labelKey,
  valueLabel,
}: {
  items: Array<Record<string, unknown>>;
  valueKey: string;
  labelKey: string;
  valueLabel: string;
}) {
  useLocale()

  if (!items.length) {
    return <p className="text-sm text-gray-500">{tr("No data found.")}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${String(item?.[labelKey] ?? 'item')}-${index}`} className="rounded-xl bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                #{index + 1} {tr(String(item?.[labelKey] ?? 'Unknown'))}
              </p>
              <p className="text-xs text-gray-500">{tr(valueLabel)}</p>
            </div>
            <p className="shrink-0 text-lg font-bold text-gray-900">
              {tr(formatNumber(toNumber(item?.[valueKey])))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  useLocale()

  const [token, setToken] = useState<string>('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [applicationsTrend, setApplicationsTrend] = useState<CountItem[]>([]);
  const [jobsByIndustry, setJobsByIndustry] = useState<CountItem[]>([]);
  const [hiringFunnel, setHiringFunnel] = useState<CountItem[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null);
  const [trainingAnalytics, setTrainingAnalytics] = useState<TrainingAnalytics | null>(null);
  const [topEmployers, setTopEmployers] = useState<TopEmployer[]>([]);
  const [topJobs, setTopJobs] = useState<TopJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken =
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('adminToken') ||
      '';

    setToken(storedToken);
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  }, [token]);

  const fetchJson = useCallback(
    async (url: string) => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to fetch analytics data');
      }

      return data?.data;
    },
    [authHeaders]
  );

  const fetchAllAnalytics = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      setRefreshing(true);

      const [
        summaryData,
        trendData,
        industryData,
        funnelData,
        payrollData,
        invoiceData,
        trainingData,
        employersData,
        jobsData,
      ] = await Promise.all([
        fetchJson(`${API_BASE}/admin/analytics/summary`),
        fetchJson(`${API_BASE}/admin/analytics/applications-trend`),
        fetchJson(`${API_BASE}/admin/analytics/jobs-by-industry`),
        fetchJson(`${API_BASE}/admin/analytics/hiring-funnel`),
        fetchJson(`${API_BASE}/admin/analytics/payroll-status`),
        fetchJson(`${API_BASE}/admin/analytics/invoice-status`),
        fetchJson(`${API_BASE}/admin/analytics/training`),
        fetchJson(`${API_BASE}/admin/analytics/top-employers`),
        fetchJson(`${API_BASE}/admin/analytics/top-jobs`),
      ]);

      setSummary(
        summaryData
          ? {
              totalUsers: toNumber(summaryData.totalUsers),
              totalJobs: toNumber(summaryData.totalJobs),
              totalApplications: toNumber(summaryData.totalApplications),
              shortlistedCandidates: toNumber(summaryData.shortlistedCandidates),
              hiredCandidates: toNumber(summaryData.hiredCandidates),
              activeDeployments: toNumber(summaryData.activeDeployments),
              totalPayrollAmount: toNumber(summaryData.totalPayrollAmount),
              totalInvoiceAmount: toNumber(summaryData.totalInvoiceAmount),
              totalRevenue: toNumber(summaryData.totalRevenue),
            }
          : null
      );

      setApplicationsTrend(normalizeCountData<TrendItem>(trendData, 'month'));
      setJobsByIndustry(normalizeCountData<IndustryItem>(industryData, 'industry'));
      setHiringFunnel(normalizeCountData<FunnelItem>(funnelData, 'stage'));

      setPayrollSummary(
        payrollData
          ? {
              statuses: normalizeCountData<StatusItem>(payrollData.statuses, 'status') as StatusItem[],
              totalNetSalary: toNumber(payrollData.totalNetSalary),
              totalPayrolls: toNumber(payrollData.totalPayrolls),
            }
          : null
      );

      setInvoiceSummary(
        invoiceData
          ? {
              statuses: normalizeCountData<StatusItem>(invoiceData.statuses, 'status') as StatusItem[],
              totalInvoiceAmount: toNumber(invoiceData.totalInvoiceAmount),
              totalInvoices: toNumber(invoiceData.totalInvoices),
            }
          : null
      );

      setTrainingAnalytics(
        trainingData
          ? {
              totalCourses: toNumber(trainingData.totalCourses),
              totalEnrollments: toNumber(trainingData.totalEnrollments),
              completedEnrollments: toNumber(trainingData.completedEnrollments),
              inProgressEnrollments: toNumber(trainingData.inProgressEnrollments),
              completionRate: toNumber(trainingData.completionRate),
            }
          : null
      );

      setTopEmployers(
        safeArray<any>(employersData).map((item, index) => ({
          employerId: String(item?.employerId ?? `employer-${index}`),
          employerName: String(item?.employerName ?? 'Unknown Employer'),
          jobsPosted: toNumber(item?.jobsPosted),
        }))
      );

      setTopJobs(
        safeArray<any>(jobsData).map((item, index) => ({
          jobId: String(item?.jobId ?? `job-${index}`),
          jobTitle: String(item?.jobTitle ?? 'Unknown Job'),
          applications: toNumber(item?.applications),
        }))
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load analytics dashboard';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchJson, token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    void fetchAllAnalytics();
  }, [token, fetchAllAnalytics]);

  const summaryCards = useMemo(() => {
    if (!summary) return [];

    return [
      { label: 'Total Users', value: formatNumber(summary.totalUsers) },
      { label: 'Total Jobs', value: formatNumber(summary.totalJobs) },
      { label: 'Applications', value: formatNumber(summary.totalApplications) },
      { label: 'Shortlisted', value: formatNumber(summary.shortlistedCandidates) },
      { label: 'Hired', value: formatNumber(summary.hiredCandidates) },
      { label: 'Active Deployments', value: formatNumber(summary.activeDeployments) },
      { label: 'Payroll Total', value: formatCurrency(summary.totalPayrollAmount) },
      { label: 'Invoice Total', value: formatCurrency(summary.totalInvoiceAmount) },
      { label: 'Revenue', value: formatCurrency(summary.totalRevenue) },
    ];
  }, [summary]);

  const trainingBreakdown = useMemo(() => {
    const completed = toNumber(trainingAnalytics?.completedEnrollments);
    const inProgress = toNumber(trainingAnalytics?.inProgressEnrollments);

    return [
      { name: 'Completed', value: completed },
      { name: 'In Progress', value: inProgress },
    ].filter((item) => item.value > 0);
  }, [trainingAnalytics]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tr("BI Analytics Dashboard")}</h1>
            <p className="mt-2 text-sm text-gray-600">{tr("Platform-wide hiring, payroll, billing, training, and employer performance analytics.")}</p>
          </div>

          <button
            onClick={() => void fetchAllAnalytics()}
            disabled={!token || refreshing}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tr(refreshing ? 'Refreshing...' : 'Refresh')}
          </button>
        </div>

        {!token && (
          <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">{tr("JWT token not found in localStorage. Please log in again as admin.")}</div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {trError(error)}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200"
                />
              ))}
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <DashboardCard key={card.label} label={card.label} value={card.value} />
              ))}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <SectionCard title={tr("Applications Trend")} description={tr("Monthly application volume.")}>
                {applicationsTrend.length > 0 && hasPositiveCounts(applicationsTrend) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={applicationsTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickFormatter={(value) => tr(value)} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickFormatter={(value) => tr(value)} />
                      <Tooltip labelFormatter={(value) => tr(value)} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No application trend data found." />
                )}
              </SectionCard>

              <SectionCard title={tr("Jobs by Industry")} description={tr("Industry-wise job distribution.")}>
                {jobsByIndustry.length > 0 && hasPositiveCounts(jobsByIndustry) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jobsByIndustry} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="industry"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={jobsByIndustry.length > 4 ? -15 : 0}
                        textAnchor={jobsByIndustry.length > 4 ? 'end' : 'middle'}
                        height={jobsByIndustry.length > 4 ? 60 : 30} tickFormatter={(value) => tr(value)}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickFormatter={(value) => tr(value)} />
                      <Tooltip labelFormatter={(value) => tr(value)} />
                      <Bar dataKey="count" fill="#16a34a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No jobs by industry data found." />
                )}
              </SectionCard>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              <SectionCard title={tr("Hiring Funnel")} description={tr("Stage movement from applied to hired.")}>
                {hiringFunnel.length > 0 && hasPositiveCounts(hiringFunnel) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip labelFormatter={(value) => tr(value)} />
                      <Funnel data={hiringFunnel} dataKey="count">
                        <LabelList dataKey="stage" position="right" fill="#111827" stroke="none" />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No hiring funnel data found." />
                )}
              </SectionCard>

              <SectionCard
                title={tr("Payroll Status")}
                description={tr("Status split across payroll records.")}
                heightClass="h-72"
              >
                {payrollSummary?.statuses?.length && hasPositiveCounts(payrollSummary.statuses as CountItem[]) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payrollSummary.statuses}
                        dataKey="count"
                        nameKey="status"
                        outerRadius={90}
                        label
                      >
                        {payrollSummary.statuses.map((entry, index) => (
                          <Cell key={`${entry.status}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip labelFormatter={(value) => tr(value)} />
                      <Legend formatter={(value) => tr(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No payroll status data found." />
                )}
              </SectionCard>

              <SectionCard
                title={tr("Invoice Status")}
                description={tr("Status split across invoices.")}
                heightClass="h-72"
              >
                {invoiceSummary?.statuses?.length && hasPositiveCounts(invoiceSummary.statuses as CountItem[]) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={invoiceSummary.statuses}
                        dataKey="count"
                        nameKey="status"
                        outerRadius={90}
                        label
                      >
                        {invoiceSummary.statuses.map((entry, index) => (
                          <Cell key={`${entry.status}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip labelFormatter={(value) => tr(value)} />
                      <Legend formatter={(value) => tr(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No invoice status data found." />
                )}
              </SectionCard>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-500">{tr("Total Payrolls")}</p>
                <p className="mt-2 text-xl font-bold text-gray-900">
                  {tr(formatNumber(payrollSummary?.totalPayrolls))}
                </p>
                <p className="mt-1 text-sm text-gray-500">{tr("Total Net Salary: ")}{tr(formatCurrency(payrollSummary?.totalNetSalary))}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm text-gray-500">{tr("Total Invoices")}</p>
                <p className="mt-2 text-xl font-bold text-gray-900">
                  {tr(formatNumber(invoiceSummary?.totalInvoices))}
                </p>
                <p className="mt-1 text-sm text-gray-500">{tr("Total Invoice Amount: ")}{tr(formatCurrency(invoiceSummary?.totalInvoiceAmount))}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{tr("Training Analytics")}</h2>
                <p className="mt-1 text-sm text-gray-500">{tr("Learning engagement and completion.")}</p>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">{tr("Total Courses")}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {tr(formatNumber(trainingAnalytics?.totalCourses))}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">{tr("Total Enrollments")}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {tr(formatNumber(trainingAnalytics?.totalEnrollments))}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-sm text-green-700">{tr("Completed")}</p>
                      <p className="mt-1 text-2xl font-bold text-green-600">
                        {tr(formatNumber(trainingAnalytics?.completedEnrollments))}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">{tr("In Progress")}</p>
                      <p className="mt-1 text-2xl font-bold text-blue-600">
                        {tr(formatNumber(trainingAnalytics?.inProgressEnrollments))}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-indigo-50 p-4">
                    <p className="text-sm text-indigo-700">{tr("Completion Rate")}</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-800">
                      {tr(toNumber(trainingAnalytics?.completionRate).toFixed(2))}%
                    </p>
                  </div>

                  <div className="mt-2 h-56">
                    {trainingBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={trainingBreakdown}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={75}
                            label
                          >
                            {trainingBreakdown.map((_, index) => (
                              <Cell
                                key={`training-cell-${index}`}
                                fill={index === 0 ? '#16a34a' : '#2563eb'}
                              />
                            ))}
                          </Pie>
                          <Tooltip labelFormatter={(value) => tr(value)} />
                          <Legend formatter={(value) => tr(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="No training breakdown data found." />
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{tr("Top Employers")}</h2>
                <p className="mt-1 text-sm text-gray-500">{tr("Ranked by jobs posted.")}</p>
                <div className="mt-6">
                  <RankingList
                    items={topEmployers as Array<Record<string, unknown>>}
                    labelKey="employerName"
                    valueKey="jobsPosted"
                    valueLabel="Jobs posted"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{tr("Top Jobs")}</h2>
                <p className="mt-1 text-sm text-gray-500">{tr("Ranked by applications received.")}</p>
                <div className="mt-6">
                  <RankingList
                    items={topJobs as Array<Record<string, unknown>>}
                    labelKey="jobTitle"
                    valueKey="applications"
                    valueLabel="Applications"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{tr("Quick Snapshot")}</h2>
              <p className="mt-1 text-sm text-gray-500">{tr("Compact view of the most important totals.")}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{tr("Users")}</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {tr(formatCompact(summary?.totalUsers))}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{tr("Applications")}</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {tr(formatCompact(summary?.totalApplications))}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{tr("Revenue")}</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {tr(formatCurrency(summary?.totalRevenue))}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{tr("Completion Rate")}</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {tr(toNumber(trainingAnalytics?.completionRate).toFixed(2))}%
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}