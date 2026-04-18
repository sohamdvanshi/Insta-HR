'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type AuditSummary = {
  window: string;
  audit: {
    totalEvents: number;
    failedEvents: number;
    applicationCreateFailures: number;
  };
  fraud: {
    openAlerts: number;
    confirmedAlerts: number;
    highSeverityRecent: number;
  };
};

type AuditLog = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  targetUserId: string | null;
  status: 'success' | 'failure';
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
};

type FraudApplication = {
  id: string;
  jobId: string;
  candidateId: string;
  status: string;
  manualReviewStatus: string;
  aiScore: number | null;
};

type FraudAlert = {
  id: string;
  candidateId: string | null;
  applicationId: string | null;
  ruleCode: string;
  severity: 'low' | 'medium' | 'high';
  riskScore: number;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed' | 'confirmed';
  metadata?: Record<string, any>;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  application?: FraudApplication | null;
};

type FraudSummary = {
  totalAlerts: number;
  byStatus: {
    open: number;
    reviewed: number;
    dismissed: number;
    confirmed: number;
  };
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value?: number) =>
  new Intl.NumberFormat('en-IN').format(toNumber(value));

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const truncate = (value: string, max = 42) => {
  if (!value) return '-';
  return value.length > max ? `${value.slice(0, max)}...` : value;
};

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

function Badge({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'violet';
}) {
  const toneClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
      {message}
    </div>
  );
}

export default function AdminAuditPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [fraudSummary, setFraudSummary] = useState<FraudSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [auditPagination, setAuditPagination] = useState<Pagination | null>(null);
  const [fraudPagination, setFraudPagination] = useState<Pagination | null>(null);

  const [auditStatusFilter, setAuditStatusFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');

  const [fraudStatusFilter, setFraudStatusFilter] = useState('');
  const [fraudSeverityFilter, setFraudSeverityFilter] = useState('');
  const [updatingAlertId, setUpdatingAlertId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken =
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('adminToken') ||
      '';

    setToken(storedToken);
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      setRefreshing(true);

      const auditLogsQuery = new URLSearchParams();
      auditLogsQuery.set('page', '1');
      auditLogsQuery.set('limit', '20');
      if (auditStatusFilter) auditLogsQuery.set('status', auditStatusFilter);
      if (auditActionFilter) auditLogsQuery.set('action', auditActionFilter);
      if (auditEntityFilter) auditLogsQuery.set('entityType', auditEntityFilter);

      const fraudAlertsQuery = new URLSearchParams();
      fraudAlertsQuery.set('page', '1');
      fraudAlertsQuery.set('limit', '20');
      if (fraudStatusFilter) fraudAlertsQuery.set('status', fraudStatusFilter);
      if (fraudSeverityFilter) fraudAlertsQuery.set('severity', fraudSeverityFilter);

      const [summaryRes, fraudSummaryRes, auditLogsRes, fraudAlertsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/audit/summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/admin/audit/fraud-alerts/summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/admin/audit/logs?${auditLogsQuery.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/admin/audit/fraud-alerts?${fraudAlertsQuery.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
      ]);

      const [summaryJson, fraudSummaryJson, auditLogsJson, fraudAlertsJson] = await Promise.all([
        summaryRes.json(),
        fraudSummaryRes.json(),
        auditLogsRes.json(),
        fraudAlertsRes.json(),
      ]);

      if (!summaryRes.ok) throw new Error(summaryJson?.message || 'Failed to fetch summary');
      if (!fraudSummaryRes.ok) {
        throw new Error(fraudSummaryJson?.message || 'Failed to fetch fraud summary');
      }
      if (!auditLogsRes.ok) throw new Error(auditLogsJson?.message || 'Failed to fetch audit logs');
      if (!fraudAlertsRes.ok) {
        throw new Error(fraudAlertsJson?.message || 'Failed to fetch fraud alerts');
      }

      setSummary(summaryJson?.data || null);
      setFraudSummary(fraudSummaryJson?.data || null);
      setAuditLogs(Array.isArray(auditLogsJson?.data) ? auditLogsJson.data : []);
      setFraudAlerts(Array.isArray(fraudAlertsJson?.data) ? fraudAlertsJson.data : []);
      setAuditPagination(auditLogsJson?.pagination || null);
      setFraudPagination(fraudAlertsJson?.pagination || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin audit dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, auditStatusFilter, auditActionFilter, auditEntityFilter, fraudStatusFilter, fraudSeverityFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const updateFraudAlertStatus = async (
    alertId: string,
    status: 'reviewed' | 'dismissed' | 'confirmed'
  ) => {
    if (!token) return;

    try {
      setUpdatingAlertId(alertId);

      const response = await fetch(`${API_BASE}/admin/audit/fraud-alerts/${alertId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || 'Failed to update fraud alert status');
      }

      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update fraud alert status');
    } finally {
      setUpdatingAlertId('');
    }
  };

  const auditActionOptions = useMemo(() => {
    const values = Array.from(new Set(auditLogs.map((log) => log.action).filter(Boolean)));
    return values.sort();
  }, [auditLogs]);

  const auditEntityOptions = useMemo(() => {
    const values = Array.from(new Set(auditLogs.map((log) => log.entityType).filter(Boolean)));
    return values.sort();
  }, [auditLogs]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs & Fraud Detection</h1>
            <p className="mt-2 text-sm text-gray-600">
              Monitor critical admin activity, suspicious application patterns, and fraud alert review status.
            </p>
          </div>

          <button
            onClick={() => void fetchData()}
            disabled={!token || refreshing}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {!token && (
          <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            Admin token not found in localStorage. Please log in again.
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
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200"
                />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
            <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-gray-200" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Audit Events (7 days)"
                value={formatNumber(summary?.audit?.totalEvents)}
                subtitle="Recent tracked activity"
              />
              <StatCard
                title="Failed Audit Events"
                value={formatNumber(summary?.audit?.failedEvents)}
                subtitle="Errors and blocked operations"
              />
              <StatCard
                title="Application Create Failures"
                value={formatNumber(summary?.audit?.applicationCreateFailures)}
                subtitle="Recent failed application attempts"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Open Fraud Alerts"
                value={formatNumber(summary?.fraud?.openAlerts)}
                subtitle="Needs admin review"
              />
              <StatCard
                title="Confirmed Fraud Alerts"
                value={formatNumber(summary?.fraud?.confirmedAlerts)}
                subtitle="Confirmed suspicious activity"
              />
              <StatCard
                title="High Severity Alerts (7 days)"
                value={formatNumber(summary?.fraud?.highSeverityRecent)}
                subtitle="Recent critical risk signals"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Fraud Alerts" value={formatNumber(fraudSummary?.totalAlerts)} />
              <StatCard title="Reviewed Alerts" value={formatNumber(fraudSummary?.byStatus?.reviewed)} />
              <StatCard title="Dismissed Alerts" value={formatNumber(fraudSummary?.byStatus?.dismissed)} />
              <StatCard title="Low / Medium / High" value={`${formatNumber(fraudSummary?.bySeverity?.low)} / ${formatNumber(fraudSummary?.bySeverity?.medium)} / ${formatNumber(fraudSummary?.bySeverity?.high)}`} />
            </div>

            <div className="mt-8">
              <Section
                title="Audit Logs"
                description="Filter and inspect sensitive system activity across your platform."
              >
                <div className="mb-5 grid gap-3 md:grid-cols-4">
                  <select
                    value={auditStatusFilter}
                    onChange={(e) => setAuditStatusFilter(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="success">Success</option>
                    <option value="failure">Failure</option>
                  </select>

                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                  >
                    <option value="">All actions</option>
                    {auditActionOptions.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>

                  <select
                    value={auditEntityFilter}
                    onChange={(e) => setAuditEntityFilter(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                  >
                    <option value="">All entities</option>
                    {auditEntityOptions.map((entity) => (
                      <option key={entity} value={entity}>
                        {entity}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      setAuditStatusFilter('');
                      setAuditActionFilter('');
                      setAuditEntityFilter('');
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Reset filters
                  </button>
                </div>

                {auditLogs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="pb-3 pr-4 font-medium">Time</th>
                          <th className="pb-3 pr-4 font-medium">Action</th>
                          <th className="pb-3 pr-4 font-medium">Entity</th>
                          <th className="pb-3 pr-4 font-medium">Actor</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">IP</th>
                          <th className="pb-3 pr-0 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="border-b border-gray-100 last:border-b-0 align-top">
                            <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge tone="blue">{log.action}</Badge>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              <div className="font-medium text-gray-900">{log.entityType}</div>
                              <div className="text-xs text-gray-500">{truncate(log.entityId || '-')}</div>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              <div className="font-medium text-gray-900">{log.actorRole || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{truncate(log.actorId || '-')}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <Badge tone={log.status === 'success' ? 'green' : 'red'}>
                                {log.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">{log.ipAddress || '-'}</td>
                            <td className="py-3 pr-0 text-xs text-gray-600">
                              <pre className="max-w-[320px] whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-2">
                                {JSON.stringify(log.metadata || {}, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No audit logs found for the selected filters." />
                )}

                {auditPagination ? (
                  <div className="mt-4 text-xs text-gray-500">
                    Showing page {auditPagination.page} of {auditPagination.totalPages} · Total {formatNumber(auditPagination.total)} logs
                  </div>
                ) : null}
              </Section>
            </div>

            <div className="mt-8">
              <Section
                title="Fraud Alerts"
                description="Review suspicious applications, risk scores, and investigation actions."
              >
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <select
                    value={fraudStatusFilter}
                    onChange={(e) => setFraudStatusFilter(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="confirmed">Confirmed</option>
                  </select>

                  <select
                    value={fraudSeverityFilter}
                    onChange={(e) => setFraudSeverityFilter(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                  >
                    <option value="">All severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>

                  <button
                    onClick={() => {
                      setFraudStatusFilter('');
                      setFraudSeverityFilter('');
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Reset filters
                  </button>
                </div>

                {fraudAlerts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="pb-3 pr-4 font-medium">Created</th>
                          <th className="pb-3 pr-4 font-medium">Rule</th>
                          <th className="pb-3 pr-4 font-medium">Severity</th>
                          <th className="pb-3 pr-4 font-medium">Risk</th>
                          <th className="pb-3 pr-4 font-medium">Status</th>
                          <th className="pb-3 pr-4 font-medium">Application</th>
                          <th className="pb-3 pr-4 font-medium">Reason</th>
                          <th className="pb-3 pr-0 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fraudAlerts.map((alert) => (
                          <tr key={alert.id} className="border-b border-gray-100 last:border-b-0 align-top">
                            <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                              {formatDateTime(alert.createdAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge tone="violet">{alert.ruleCode}</Badge>
                            </td>
                            <td className="py-3 pr-4">
                              <Badge
                                tone={
                                  alert.severity === 'high'
                                    ? 'red'
                                    : alert.severity === 'medium'
                                    ? 'yellow'
                                    : 'gray'
                                }
                              >
                                {alert.severity}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 font-semibold text-gray-900">
                              {formatNumber(alert.riskScore)}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge
                                tone={
                                  alert.status === 'confirmed'
                                    ? 'red'
                                    : alert.status === 'dismissed'
                                    ? 'gray'
                                    : alert.status === 'reviewed'
                                    ? 'blue'
                                    : 'yellow'
                                }
                              >
                                {alert.status}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              <div className="font-medium text-gray-900">
                                {truncate(alert.applicationId || '-')}
                              </div>
                              <div className="text-xs text-gray-500">
                                App Status: {alert.application?.status || '-'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Review: {alert.application?.manualReviewStatus || '-'}
                              </div>
                              <div className="text-xs text-gray-500">
                                AI Score: {alert.application?.aiScore ?? '-'}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              <div className="max-w-xs">{alert.reason}</div>
                              {alert.metadata ? (
                                <pre className="mt-2 max-w-[280px] whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                                  {JSON.stringify(alert.metadata, null, 2)}
                                </pre>
                              ) : null}
                            </td>
                            <td className="py-3 pr-0">
                              <div className="flex min-w-[210px] flex-wrap gap-2">
                                <button
                                  onClick={() => void updateFraudAlertStatus(alert.id, 'reviewed')}
                                  disabled={updatingAlertId === alert.id}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  Review
                                </button>
                                <button
                                  onClick={() => void updateFraudAlertStatus(alert.id, 'dismissed')}
                                  disabled={updatingAlertId === alert.id}
                                  className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                                >
                                  Dismiss
                                </button>
                                <button
                                  onClick={() => void updateFraudAlertStatus(alert.id, 'confirmed')}
                                  disabled={updatingAlertId === alert.id}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  Confirm
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState message="No fraud alerts found for the selected filters." />
                )}

                {fraudPagination ? (
                  <div className="mt-4 text-xs text-gray-500">
                    Showing page {fraudPagination.page} of {fraudPagination.totalPages} · Total {formatNumber(fraudPagination.total)} alerts
                  </div>
                ) : null}
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}