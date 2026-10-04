'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { trainingRequest } from '@/lib/trainingApi'

type ClassSession = { id: string; title: string; mode: string; startsAt: string; endsAt: string; status: string; location?: string; notes?: string; attendance: string; training: { id: string; title: string }; batch?: { name: string } }

export default function CandidateClasses({ courseId }: { courseId?: string }) {
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const load = useCallback(async () => {
    setError('')
    try { const data = await trainingRequest('/my/classes'); setSessions(data.data.filter((item: ClassSession) => !courseId || item.training.id === courseId)) }
    catch (err) { setError((err as Error).message) }
    finally { setLoading(false) }
  }, [courseId])
  useEffect(() => { load() }, [load])
  async function join(id: string) {
    setJoining(id); setError(''); setMeetingLink('')
    try { const data = await trainingRequest(`/sessions/${id}/join`); setMeetingLink(data.data.meetingUrl) }
    catch (err) { await load(); setError((err as Error).message) }
    finally { setJoining('') }
  }
  return <section className="rounded-2xl border bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">My classes</h2><button className="rounded-lg border px-4 py-2 text-sm" onClick={load}>Refresh status</button></div><p className="my-3 text-sm text-gray-600">Online classes become available when your trainer starts the session. Times use your browser&apos;s timezone.</p>
    {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
    {meetingLink && <p role="status" className="my-4 rounded-lg bg-blue-50 p-4"><a href={meetingLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">Join meeting ↗</a></p>}
    {loading ? <p>Loading classes...</p> : !sessions.length ? <p className="text-gray-500">No classes scheduled for your enrolled courses yet.</p> : <div className="space-y-4">{sessions.map(session => <article className="rounded-xl border p-4" key={session.id}><Link href={`/training/${session.training.id}`} className="text-sm text-blue-700 underline">{session.training.title}</Link><h3 className="my-1 font-semibold">{session.title}</h3><p className="text-sm">{session.mode === 'physical' ? 'Physical class' : 'Online live class'} · {session.status}{session.batch ? ` · ${session.batch.name}` : ''}</p><p className="mt-2 text-gray-600">{new Date(session.startsAt).toLocaleString()} — {new Date(session.endsAt).toLocaleString()}</p>{session.mode === 'physical' && <p className="mt-2 font-medium">Location: {session.location}</p>}{session.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{session.notes}</p>}<p className="mt-2 text-sm text-gray-500">My attendance: {session.attendance}</p>{session.mode === 'online' && session.status === 'live' && new Date(session.endsAt).getTime() > Date.now() && <button disabled={!!joining} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => join(session.id)}>{joining === session.id ? 'Checking access...' : 'Get join link'}</button>}</article>)}</div>}
  </section>
}
