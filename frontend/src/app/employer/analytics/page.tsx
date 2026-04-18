'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type ConversionRates = {
  applicationToShortlisted: number;
  shortlistedToInterview: number;
  interviewToHired: number;
  applicationToHired: number;
};

type TopJob = {
  jobId: string;
  jobTitle: string;
  applications: number;
  shortlisted: number;
  interview: number;
  hired: number;
  rejected: number;
  applicationToHireRate: number;
};

type EmployerFunnelData = {
  jobsPosted: number;
  applications: number;
  shortlisted: number;
  interview: number;
  hired: number;
  rejected: number;
  conversionRates: ConversionRates;
  topJobs: TopJob[];
};

type TrendPoint = {
  month: string;
  count: number;
};

type SlowJob = {
  jobId: string;
  jobTitle: string;
  applications: number;
  hired: number;
  avgDaysToHire: number;
};

type EmployerTrendsData = {
  summary: {
    applications: number;
    interviews: number;
    hired: number;
    avgDaysToInterview: number;
    avgDaysToHire: number;
  };
  monthlyApplications: TrendPoint[];
  monthlyHires: TrendPoint[];
  slowJobs: SlowJob[];
};

type SegmentItem = {
  label: string;
  applications: number;
  hired: number;
  hireRate: number;
};

type SegmentAnalyticsData = {
  totals: {
    jobs: number;
    applications: number;
    hired: number;
  };
  byJobType: SegmentItem[];
  byIndustry: SegmentItem[];
  byExperienceLevel: SegmentItem[];
};

type FunnelStageItem = {
  stage: string;
  value: number;
};

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6'];
const TREND_COLORS = {
  applications: '#2563eb',
  hires: '#16a34a',
  slowJobs: '#f59e0b',
};

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value?: number) =>
  new Intl.NumberFormat('en-IN').format(toNumber(value));

const formatPercent = (value?: number) => `${toNumber(value).toFixed(2)}%`;

const formatDays = (value?: number) => `${toNumber(value).toFixed(2)} days`;

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      {subtitle ? <p className="mt-2 text-xs text-gray-400">{subtitle}</p> : null}
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
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      <div className={`mt-6 ${heightClass}`}>{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
      {message}
    </div>
  );
}

export default function EmployerAnalyticsPage() {
  const [token, setToken] = useState<string>('');
  const [data, setData] = useState<EmployerFunnelData | null>(null);
  const [trends, setTrends] = useState<EmployerTrendsData | null>(null);
  const [segments, setSegments] = useState<SegmentAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken =
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('employerToken') ||
      '';

    setToken(storedToken);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      setRefreshing(true);

      const [funnelResponse, trendsResponse, segmentResponse] = await Promise.all([
        fetch(`${API_BASE}/employer/analytics/funnel`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/employer/analytics/trends`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/employer/analytics/segment-performance`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }),
      ]);

      let funnelResult: any = null;
      let trendsResult: any = null;
      let segmentResult: any = null;

      try {
        funnelResult = await funnelResponse.json();
      } catch {
        funnelResult = null;
      }

      try {
        trendsResult = await trendsResponse.json();
      } catch {
        trendsResult = null;
      }

      try {
        segmentResult = await segmentResponse.json();
      } catch {
        segmentResult = null;
      }

      if (!funnelResponse.ok) {
        throw new Error(funnelResult?.message || 'Failed to fetch employer funnel analytics');
      }

      if (!trendsResponse.ok) {
        throw new Error(trendsResult?.message || 'Failed to fetch employer trends analytics');
      }

      if (!segmentResponse.ok) {
        throw new Error(segmentResult?.message || 'Failed to fetch employer segment analytics');
      }

      const funnelPayload = funnelResult?.data;
      const trendsPayload = trendsResult?.data;
      const segmentPayload = segmentResult?.data;

      setData({
        jobsPosted: toNumber(funnelPayload?.jobsPosted),
        applications: toNumber(funnelPayload?.applications),
        shortlisted: toNumber(funnelPayload?.shortlisted),
        interview: toNumber(funnelPayload?.interview),
        hired: toNumber(funnelPayload?.hired),
        rejected: toNumber(funnelPayload?.rejected),
        conversionRates: {
          applicationToShortlisted: toNumber(
            funnelPayload?.conversionRates?.applicationToShortlisted
          ),
          shortlistedToInterview: toNumber(
            funnelPayload?.conversionRates?.shortlistedToInterview
          ),
          interviewToHired: toNumber(
            funnelPayload?.conversionRates?.interviewToHired
          ),
          applicationToHired: toNumber(
            funnelPayload?.conversionRates?.applicationToHired
          ),
        },
        topJobs: Array.isArray(funnelPayload?.topJobs)
          ? funnelPayload.topJobs.map((job: any, index: number) => ({
              jobId: String(job?.jobId ?? `job-${index}`),
              jobTitle: String(job?.jobTitle ?? 'Untitled Job'),
              applications: toNumber(job?.applications),
              shortlisted: toNumber(job?.shortlisted),
              interview: toNumber(job?.interview),
              hired: toNumber(job?.hired),
              rejected: toNumber(job?.rejected),
              applicationToHireRate: toNumber(job?.applicationToHireRate),
            }))
          : [],
      });

      setTrends({
        summary: {
          applications: toNumber(trendsPayload?.summary?.applications),
          interviews: toNumber(trendsPayload?.summary?.interviews),
          hired: toNumber(trendsPayload?.summary?.hired),
          avgDaysToInterview: toNumber(trendsPayload?.summary?.avgDaysToInterview),
          avgDaysToHire: toNumber(trendsPayload?.summary?.avgDaysToHire),
        },
        monthlyApplications: Array.isArray(trendsPayload?.monthlyApplications)
          ? trendsPayload.monthlyApplications.map((item: any) => ({
              month: String(item?.month ?? ''),
              count: toNumber(item?.count),
            }))
          : [],
        monthlyHires: Array.isArray(trendsPayload?.monthlyHires)
          ? trendsPayload.monthlyHires.map((item: any) => ({
              month: String(item?.month ?? ''),
              count: toNumber(item?.count),
            }))
          : [],
        slowJobs: Array.isArray(trendsPayload?.slowJobs)
          ? trendsPayload.slowJobs.map((job: any, index: number) => ({
              jobId: String(job?.jobId ?? `slow-job-${index}`),
              jobTitle: String(job?.jobTitle ?? 'Untitled Job'),
              applications: toNumber(job?.applications),
              hired: toNumber(job?.hired),
              avgDaysToHire: toNumber(job?.avgDaysToHire),
            }))
          : [],
      });

      setSegments({
        totals: {
          jobs: toNumber(segmentPayload?.totals?.jobs),
          applications: toNumber(segmentPayload?.totals?.applications),
          hired: toNumber(segmentPayload?.totals?.hired),
        },
        byJobType: Array.isArray(segmentPayload?.byJobType)
          ? segmentPayload.byJobType.map((item: any, index: number) => ({
              label: String(item?.label ?? `Job Type ${index + 1}`),
              applications: toNumber(item?.applications),
              hired: toNumber(item?.hired),
              hireRate: toNumber(item?.hireRate),
            }))
          : [],
        byIndustry: Array.isArray(segmentPayload?.byIndustry)
          ? segmentPayload.byIndustry.map((item: any, index: number) => ({
              label: String(item?.label ?? `Industry ${index + 1}`),
              applications: toNumber(item?.applications),
              hired: toNumber(item?.hired),
              hireRate: toNumber(item?.hireRate),
            }))
          : [],
        byExperienceLevel: Array.isArray(segmentPayload?.byExperienceLevel)
          ? segmentPayload.byExperienceLevel.map((item: any, index: number) => ({
              label: String(item?.label ?? `Level ${index + 1}`),
              applications: toNumber(item?.applications),
              hired: toNumber(item?.hired),
              hireRate: toNumber(item?.hireRate),
            }))
          : [],
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load employer analytics';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    void fetchAnalytics();
  }, [token, fetchAnalytics]);

  const funnelData = useMemo<FunnelStageItem[]>(() => {
    if (!data) return [];

    return [
      { stage: 'Applications', value: toNumber(data.applications) },
      { stage: 'Shortlisted', value: toNumber(data.shortlisted) },
      { stage: 'Interview', value: toNumber(data.interview) },
      { stage: 'Hired', value: toNumber(data.hired) },
    ].filter((item) => item.value > 0);
  }, [data]);

  const stageDropoffData = useMemo(() => {
    if (!data) return [];

    return [
      { name: 'Shortlisted', value: toNumber(data.shortlisted) },
      { name: 'Interview', value: toNumber(data.interview) },
      { name: 'Hired', value: toNumber(data.hired) },
      { name: 'Rejected', value: toNumber(data.rejected) },
    ].filter((item) => item.value > 0);
  }, [data]);

  const topJobsChartData = useMemo(() => {
    return (data?.topJobs || []).map((job) => ({
      jobTitle:
        job.jobTitle.length > 18 ? `${job.jobTitle.slice(0, 18)}...` : job.jobTitle,
      applications: toNumber(job.applications),
      hired: toNumber(job.hired),
    }));
  }, [data]);

  const conversionCards = useMemo(() => {
    if (!data) return [];

    return [
      {
        title: 'Application → Shortlisted',
        value: formatPercent(data.conversionRates.applicationToShortlisted),
      },
      {
        title: 'Shortlisted → Interview',
        value: formatPercent(data.conversionRates.shortlistedToInterview),
      },
      {
        title: 'Interview → Hired',
        value: formatPercent(data.conversionRates.interviewToHired),
      },
      {
        title: 'Application → Hired',
        value: formatPercent(data.conversionRates.applicationToHired),
      },
    ];
  }, [data]);

  const trendChartData = useMemo(() => {
    const applicationMap = new Map<string, number>();
    const hireMap = new Map<string, number>();

    (trends?.monthlyApplications || []).forEach((item) => {
      applicationMap.set(item.month, toNumber(item.count));
    });

    (trends?.monthlyHires || []).forEach((item) => {
      hireMap.set(item.month, toNumber(item.count));
    });

    const months = Array.from(
      new Set([...applicationMap.keys(), ...hireMap.keys()])
    ).sort();

    return months.map((month) => ({
      month,
      applications: applicationMap.get(month) || 0,
      hires: hireMap.get(month) || 0,
    }));
  }, [trends]);

  const slowJobsChartData = useMemo(() => {
    return (trends?.slowJobs || []).map((job) => ({
      jobTitle:
        job.jobTitle.length > 18 ? `${job.jobTitle.slice(0, 18)}...` : job.jobTitle,
      avgDaysToHire: toNumber(job.avgDaysToHire),
    }));
  }, [trends]);

  const jobTypeChartData = useMemo(() => {
    return (segments?.byJobType || []).map((item) => ({
      label: item.label.length > 16 ? `${item.label.slice(0, 16)}...` : item.label,
      applications: toNumber(item.applications),
      hired: toNumber(item.hired),
    }));
  }, [segments]);

  const industryHireRateData = useMemo(() => {
    return (segments?.byIndustry || []).map((item) => ({
      label: item.label.length > 16 ? `${item.label.slice(0, 16)}...` : item.label,
      hireRate: toNumber(item.hireRate),
    }));
  }, [segments]);

  const experienceLevelData = useMemo(() => {
    return (segments?.byExperienceLevel || []).map((item) => ({
      name: item.label,
      value: toNumber(item.applications),
    }));
  }, [segments]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Employer Analytics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track application flow, conversion rates, hiring trends, top-performing jobs, and segment performance.
            </p>
          </div>

          <button
            onClick={() => void fetchAnalytics()}
            disabled={!token || refreshing}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {!token && (
          <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            JWT token not found in localStorage. Please log in again as employer.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
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
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Jobs Posted" value={formatNumber(data?.jobsPosted)} />
              <StatCard
                title="Applications"
                value={formatNumber(trends?.summary?.applications ?? data?.applications)}
              />
              <StatCard title="Shortlisted" value={formatNumber(data?.shortlisted)} />
              <StatCard title="Hired" value={formatNumber(trends?.summary?.hired ?? data?.hired)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {conversionCards.map((card) => (
                <StatCard key={card.title} title={card.title} value={card.value} />
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Avg Days to Interview"
                value={formatDays(trends?.summary?.avgDaysToInterview)}
              />
              <StatCard
                title="Avg Days to Hire"
                value={formatDays(trends?.summary?.avgDaysToHire)}
              />
              <StatCard
                title="Interviews"
                value={formatNumber(trends?.summary?.interviews ?? data?.interview)}
              />
              <StatCard
                title="Rejected"
                value={formatNumber(data?.rejected)}
              />
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <SectionCard
                title="Hiring Funnel"
                description="See how candidates move from application to hire."
              >
                {funnelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip />
                      <Funnel data={funnelData} dataKey="value">
                        <LabelList
                          dataKey="stage"
                          position="right"
                          fill="#111827"
                          stroke="none"
                        />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No funnel data found." />
                )}
              </SectionCard>

              <SectionCard
                title="Pipeline Outcome Split"
                description="Distribution across active and final outcomes."
              >
                {stageDropoffData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stageDropoffData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        label
                      >
                        {stageDropoffData.map((_, index) => (
                          <Cell
                            key={`stage-cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No outcome split data found." />
                )}
              </SectionCard>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <SectionCard
                title="Top Jobs Performance"
                description="Applications vs hires across your best jobs."
              >
                {topJobsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topJobsChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="jobTitle"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={topJobsChartData.length > 3 ? -10 : 0}
                        textAnchor={topJobsChartData.length > 3 ? 'end' : 'middle'}
                        height={topJobsChartData.length > 3 ? 55 : 30}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="applications"
                        fill="#2563eb"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="hired"
                        fill="#16a34a"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No top jobs data found." />
                )}
              </SectionCard>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Top Jobs Table</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Detailed funnel breakdown by job.
                </p>

                <div className="mt-6 overflow-x-auto">
                  {data?.topJobs?.length ? (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="pb-3 pr-4 font-medium">Job</th>
                          <th className="pb-3 pr-4 font-medium">Apps</th>
                          <th className="pb-3 pr-4 font-medium">Shortlisted</th>
                          <th className="pb-3 pr-4 font-medium">Interview</th>
                          <th className="pb-3 pr-4 font-medium">Hired</th>
                          <th className="pb-3 pr-4 font-medium">Rejected</th>
                          <th className="pb-3 pr-0 font-medium">Hire Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topJobs.map((job) => (
                          <tr
                            key={job.jobId}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            <td className="py-3 pr-4 font-medium text-gray-900">
                              {job.jobTitle}
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              {formatNumber(job.applications)}
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              {formatNumber(job.shortlisted)}
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              {formatNumber(job.interview)}
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              {formatNumber(job.hired)}
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              {formatNumber(job.rejected)}
                            </td>
                            <td className="py-3 pr-0 font-semibold text-emerald-600">
                              {formatPercent(job.applicationToHireRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-80">
                      <EmptyState message="No top jobs data found." />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <SectionCard
                title="Applications vs Hires Trend"
                description="Monthly comparison of incoming applications and successful hires."
              >
                {trendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="applications"
                        stroke={TREND_COLORS.applications}
                        strokeWidth={3}
                        name="Applications"
                      />
                      <Line
                        type="monotone"
                        dataKey="hires"
                        stroke={TREND_COLORS.hires}
                        strokeWidth={3}
                        name="Hires"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No monthly trend data found." />
                )}
              </SectionCard>

              <SectionCard
                title="Slowest Jobs by Time to Hire"
                description="Jobs taking the longest average time to convert to hired."
              >
                {slowJobsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={slowJobsChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="jobTitle"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={slowJobsChartData.length > 3 ? -10 : 0}
                        textAnchor={slowJobsChartData.length > 3 ? 'end' : 'middle'}
                        height={slowJobsChartData.length > 3 ? 55 : 30}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="avgDaysToHire"
                        fill={TREND_COLORS.slowJobs}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No slow jobs data found." />
                )}
              </SectionCard>
            </div>

            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Slow Jobs Table</h2>
              <p className="mt-1 text-sm text-gray-500">
                Detailed job-level hiring speed metrics.
              </p>

              <div className="mt-6 overflow-x-auto">
                {trends?.slowJobs?.length ? (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-3 pr-4 font-medium">Job</th>
                        <th className="pb-3 pr-4 font-medium">Applications</th>
                        <th className="pb-3 pr-4 font-medium">Hired</th>
                        <th className="pb-3 pr-0 font-medium">Avg Days to Hire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends.slowJobs.map((job) => (
                        <tr
                          key={job.jobId}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          <td className="py-3 pr-4 font-medium text-gray-900">
                            {job.jobTitle}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">
                            {formatNumber(job.applications)}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">
                            {formatNumber(job.hired)}
                          </td>
                          <td className="py-3 pr-0 font-semibold text-amber-600">
                            {formatDays(job.avgDaysToHire)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-80">
                    <EmptyState message="No slow jobs data found." />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <SectionCard
                title="Job Type Performance"
                description="Compare applications and hires across job types."
              >
                {jobTypeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={jobTypeChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={jobTypeChartData.length > 3 ? -10 : 0}
                        textAnchor={jobTypeChartData.length > 3 ? 'end' : 'middle'}
                        height={jobTypeChartData.length > 3 ? 55 : 30}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="applications" fill="#2563eb" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="hired" fill="#16a34a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No job type performance data found." />
                )}
              </SectionCard>

              <SectionCard
                title="Industry Hire Rate"
                description="See which industries convert applications to hires best."
              >
                {industryHireRateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={industryHireRateData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={industryHireRateData.length > 3 ? -10 : 0}
                        textAnchor={industryHireRateData.length > 3 ? 'end' : 'middle'}
                        height={industryHireRateData.length > 3 ? 55 : 30}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                      <Bar dataKey="hireRate" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No industry performance data found." />
                )}
              </SectionCard>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <SectionCard
                title="Experience Level Demand"
                description="Application share across role seniority levels."
              >
                {experienceLevelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={experienceLevelData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                        label
                      >
                        {experienceLevelData.map((_, index) => (
                          <Cell
                            key={`exp-cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="No experience level data found." />
                )}
              </SectionCard>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Segment Performance Table</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Detailed breakdown by job type, industry, and experience level.
                </p>

                <div className="mt-6 space-y-8">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">By Job Type</h3>
                    {(segments?.byJobType || []).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-500">
                              <th className="pb-3 pr-4 font-medium">Job Type</th>
                              <th className="pb-3 pr-4 font-medium">Applications</th>
                              <th className="pb-3 pr-4 font-medium">Hired</th>
                              <th className="pb-3 pr-0 font-medium">Hire Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(segments?.byJobType || []).map((item) => (
                              <tr key={item.label} className="border-b border-gray-100 last:border-b-0">
                                <td className="py-3 pr-4 font-medium text-gray-900">{item.label}</td>
                                <td className="py-3 pr-4 text-gray-700">{formatNumber(item.applications)}</td>
                                <td className="py-3 pr-4 text-gray-700">{formatNumber(item.hired)}</td>
                                <td className="py-3 pr-0 font-semibold text-emerald-600">
                                  {formatPercent(item.hireRate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-32">
                        <EmptyState message="No job type rows found." />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">By Industry</h3>
                    {(segments?.byIndustry || []).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-500">
                              <th className="pb-3 pr-4 font-medium">Industry</th>
                              <th className="pb-3 pr-4 font-medium">Applications</th>
                              <th className="pb-3 pr-4 font-medium">Hired</th>
                              <th className="pb-3 pr-0 font-medium">Hire Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(segments?.byIndustry || []).map((item) => (
                              <tr key={item.label} className="border-b border-gray-100 last:border-b-0">
                                <td className="py-3 pr-4 font-medium text-gray-900">{item.label}</td>
                                <td className="py-3 pr-4 text-gray-700">{formatNumber(item.applications)}</td>
                                <td className="py-3 pr-4 text-gray-700">{formatNumber(item.hired)}</td>
                                <td className="py-3 pr-0 font-semibold text-amber-600">
                                  {formatPercent(item.hireRate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-32">
                        <EmptyState message="No industry rows found." />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">By Experience Level</h3>
                    {(segments?.byExperienceLevel || []).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-500">
                              <th className="pb-3 pr-4 font-medium">Experience Level</th>
                              <th className="pb-3 pr-4 font-medium">Applications</th>
                              <th className="pb-3 pr-4 font-medium">Hired</th>
                              <th className="pb-3 pr-0 font-medium">Hire Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(segments?.byExperienceLevel || []).map((item) => (
                              <tr key={item.label} className="border-b border-gray-100 last:border-b-0">
                                <td className="py-3 pr-4 font-medium text-gray-900">{item.label}</td>
                                <td className="py-3 pr-4 text-gray-700">{formatNumber(item.applications)}</td>
                                <td className="py-3 pr-4 text-gray-700">{formatNumber(item.hired)}</td>
                                <td className="py-3 pr-0 font-semibold text-violet-600">
                                  {formatPercent(item.hireRate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-32">
                        <EmptyState message="No experience-level rows found." />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Funnel Snapshot</h2>
              <p className="mt-1 text-sm text-gray-500">
                A quick summary of your current hiring pipeline.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Applications</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {formatNumber(trends?.summary?.applications ?? data?.applications)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Interview</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {formatNumber(trends?.summary?.interviews ?? data?.interview)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Rejected</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {formatNumber(data?.rejected)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Hired</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {formatNumber(trends?.summary?.hired ?? data?.hired)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Overall Hire Rate</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    {formatPercent(data?.conversionRates?.applicationToHired)}
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