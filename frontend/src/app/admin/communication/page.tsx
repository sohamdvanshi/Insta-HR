'use client'

import { useEffect, useMemo, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'

type Thread = {
  id: string
  subject: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  creator?: { email?: string; role?: string }
  assignee?: { email?: string; role?: string } | null
}

type Message = {
  id: string
  body: string
  createdAt: string
  sender?: { email?: string; role?: string }
}

type ThreadDetails = Thread & {
  messages?: Message[]
}

const categories = [
  'general',
  'candidate',
  'employer',
  'job',
  'application',
  'payment',
  'payroll',
  'referral',
  'fraud'
]

const priorities = ['low', 'normal', 'high', 'urgent']

export default function AdminCommunicationPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThread, setSelectedThread] = useState<ThreadDetails | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  }, [])

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  })

  useEffect(() => {
    loadThreads()
  }, [statusFilter])

  const loadThreads = async () => {
    try {
      setLoading(true)
      setError('')
      const query = statusFilter ? `?status=${statusFilter}` : ''
      const response = await fetch(`${API_BASE}/internal/threads${query}`, {
        headers: headers()
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load threads')
      setThreads(data.data || [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load threads')
    } finally {
      setLoading(false)
    }
  }

  const openThread = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/internal/threads/${id}`, {
        headers: headers()
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load thread')
      setSelectedThread(data.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load thread')
    }
  }

  const createThread = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_BASE}/internal/threads`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ subject, body, category, priority })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to create thread')
      setSubject('')
      setBody('')
      setSuccess('Thread created successfully.')
      await loadThreads()
      if (data.data?.id) await openThread(data.data.id)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create thread')
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    if (!selectedThread || !reply.trim()) return

    try {
      setSaving(true)
      const response = await fetch(`${API_BASE}/internal/threads/${selectedThread.id}/messages`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ body: reply })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to send reply')
      setReply('')
      await openThread(selectedThread.id)
      await loadThreads()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send reply')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (status: string) => {
    if (!selectedThread) return

    try {
      const response = await fetch(`${API_BASE}/internal/threads/${selectedThread.id}/status`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to update status')
      setSuccess('Thread status updated.')
      await openThread(selectedThread.id)
      await loadThreads()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update status')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-600">Admin Workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Internal Communication</h1>
          <p className="mt-2 text-gray-600">Coordinate privately with InstaHire admin staff.</p>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900">New thread</h2>
            <form onSubmit={createThread} className="mt-5 space-y-4">
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm">
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm">
                {priorities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} placeholder="Write an internal message..." className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              <button disabled={saving} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Thread'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Threads</h2>
                <p className="text-sm text-gray-500">Open a thread to view and reply.</p>
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? <p className="py-8 text-center text-gray-500">Loading threads...</p> : threads.length === 0 ? <p className="py-8 text-center text-gray-500">No threads yet.</p> : threads.map((thread) => (
                <button key={thread.id} type="button" onClick={() => openThread(thread.id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-indigo-400 ${selectedThread?.id === thread.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{thread.subject}</p>
                      <p className="mt-1 text-xs capitalize text-gray-500">{thread.category} · {thread.priority}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs capitalize text-gray-600">{thread.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Created by {thread.creator?.email || 'staff member'}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        {selectedThread && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedThread.subject}</h2>
                <p className="text-sm text-gray-500">{selectedThread.category} · {selectedThread.priority}</p>
              </div>
              <select value={selectedThread.status} onChange={(event) => updateStatus(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="max-h-96 space-y-4 overflow-y-auto py-5">
              {(selectedThread.messages || []).map((message) => (
                <div key={message.id} className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-indigo-600">{message.sender?.email || 'Staff'}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{message.body}</p>
                  <p className="mt-2 text-xs text-gray-400">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Write a reply..." className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              <button type="button" onClick={sendReply} disabled={saving || !reply.trim() || selectedThread.status === 'closed'} className="self-end rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
                Reply
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
