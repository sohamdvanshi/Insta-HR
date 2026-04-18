'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

type AttendanceRecord = {
  id: string;
  attendanceDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'late';
  remarks?: string | null;
  deployment?: {
    id: string;
    siteName: string;
    location?: string;
    status?: string;
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

export default function EmployerAttendancePage() {
  const [token, setToken] = useState('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    deploymentId: '',
    attendanceDate: '',
    checkInTime: '',
    checkOutTime: '',
    status: 'present',
    remarks: '',
  });

  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    status: 'present',
    remarks: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchAttendance();
      fetchDeployments();
    }
  }, [token]);

  const authHeaders = (json = true) => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  });

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_BASE}/employer/attendance`, {
        headers: authHeaders(false),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch attendance');

      setAttendance(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance');
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

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setEditForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const combineDateTime = (date: string, time: string) => {
    if (!date || !time) return null;
    return `${date}T${time}:00`;
  };

  const formatDateTimeLocal = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDisplayDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const getDeploymentLabel = (deployment: DeploymentOption) => {
    return deployment.candidate?.email
      ? `${deployment.siteName} - ${deployment.candidate.email}`
      : deployment.siteName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.deploymentId || !form.attendanceDate || !form.status) {
      setError('Deployment, attendance date, and status are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const payload = {
        deploymentId: form.deploymentId,
        attendanceDate: form.attendanceDate,
        checkInTime: combineDateTime(form.attendanceDate, form.checkInTime),
        checkOutTime: combineDateTime(form.attendanceDate, form.checkOutTime),
        status: form.status,
        remarks: form.remarks || null,
      };

      const res = await fetch(`${API_BASE}/employer/attendance`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to mark attendance');

      setSuccess('Attendance marked successfully.');
      setForm({
        deploymentId: '',
        attendanceDate: '',
        checkInTime: '',
        checkOutTime: '',
        status: 'present',
        remarks: '',
      });

      await fetchAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (record: AttendanceRecord) => {
    setEditingId(record.id);
    setEditForm({
      checkInTime: record.checkInTime ? formatDateTimeLocal(record.checkInTime).slice(11, 16) : '',
      checkOutTime: record.checkOutTime ? formatDateTimeLocal(record.checkOutTime).slice(11, 16) : '',
      status: record.status,
      remarks: record.remarks || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      checkInTime: '',
      checkOutTime: '',
      status: 'present',
      remarks: '',
    });
  };

  const handleUpdateAttendance = async (record: AttendanceRecord) => {
    try {
      setError('');
      setSuccess('');

      const payload = {
        checkInTime: combineDateTime(record.attendanceDate, editForm.checkInTime),
        checkOutTime: combineDateTime(record.attendanceDate, editForm.checkOutTime),
        status: editForm.status,
        remarks: editForm.remarks || null,
      };

      const res = await fetch(`${API_BASE}/employer/attendance/${record.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to update attendance');

      setSuccess('Attendance updated successfully.');
      setEditingId(null);
      await fetchAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to update attendance');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Tracking</h1>
          <p className="mt-2 text-sm text-gray-600">
            Mark daily attendance for deployed candidates and maintain payroll-ready records.
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
              <h2 className="text-xl font-semibold text-gray-900">Mark Attendance</h2>
              <p className="mt-1 text-sm text-gray-500">
                Create a daily attendance record for a deployed candidate.
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
                    htmlFor="attendanceDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Attendance Date
                  </label>
                  <input
                    id="attendanceDate"
                    name="attendanceDate"
                    type="date"
                    value={form.attendanceDate}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkInTime"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Check-In Time
                  </label>
                  <input
                    id="checkInTime"
                    name="checkInTime"
                    type="time"
                    value={form.checkInTime}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkOutTime"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Check-Out Time
                  </label>
                  <input
                    id="checkOutTime"
                    name="checkOutTime"
                    type="time"
                    value={form.checkOutTime}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Attendance Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="half_day">Half Day</option>
                    <option value="leave">Leave</option>
                    <option value="late">Late</option>
                  </select>
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
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submitting ? 'Submitting...' : 'Mark Attendance'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Attendance History</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Review and update attendance records for deployed staff.
                  </p>
                </div>

                <button
                  onClick={fetchAttendance}
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
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Check-In</th>
                      <th className="px-3 py-2">Check-Out</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Remarks</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                          Loading attendance...
                        </td>
                      </tr>
                    ) : attendance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                          No attendance records found.
                        </td>
                      </tr>
                    ) : (
                      attendance.map(record => {
                        const isEditing = editingId === record.id;

                        return (
                          <tr key={record.id} className="rounded-2xl bg-gray-50 text-sm text-gray-800">
                            <td className="rounded-l-2xl px-3 py-4 font-medium">
                              {record.candidate?.email || record.deployment?.candidate?.email || '—'}
                            </td>
                            <td className="px-3 py-4">
                              {record.deployment?.siteName || '—'}
                            </td>
                            <td className="px-3 py-4">{record.attendanceDate}</td>

                            <td className="px-3 py-4">
                              {isEditing ? (
                                <input
                                  type="time"
                                  name="checkInTime"
                                  value={editForm.checkInTime}
                                  onChange={handleEditChange}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                                />
                              ) : (
                                formatDisplayDateTime(record.checkInTime)
                              )}
                            </td>

                            <td className="px-3 py-4">
                              {isEditing ? (
                                <input
                                  type="time"
                                  name="checkOutTime"
                                  value={editForm.checkOutTime}
                                  onChange={handleEditChange}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                                />
                              ) : (
                                formatDisplayDateTime(record.checkOutTime)
                              )}
                            </td>

                            <td className="px-3 py-4">
                              {isEditing ? (
                                <select
                                  name="status"
                                  value={editForm.status}
                                  onChange={handleEditChange}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-black"
                                >
                                  <option value="present">Present</option>
                                  <option value="absent">Absent</option>
                                  <option value="half_day">Half Day</option>
                                  <option value="leave">Leave</option>
                                  <option value="late">Late</option>
                                </select>
                              ) : (
                                <span className="font-medium capitalize">
                                  {record.status.replace('_', ' ')}
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-4">
                              {isEditing ? (
                                <textarea
                                  name="remarks"
                                  value={editForm.remarks}
                                  onChange={handleEditChange}
                                  rows={2}
                                  className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                                />
                              ) : (
                                record.remarks || '—'
                              )}
                            </td>

                            <td className="rounded-r-2xl px-3 py-4">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdateAttendance(record)}
                                    className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEdit(record)}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
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