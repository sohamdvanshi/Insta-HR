'use client'
import { readStoredUser } from '@/lib/storage'
import { tr, trError, useLocale, locale } from '@/lib/localization'


import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { trainingRequest } from '@/lib/trainingApi'

type Course = { id: string; title: string; canEdit: boolean; status: string }
type Batch = { id: string; name: string; trainerId: string | null; status: string; trainer?: { email: string } }
type Session = { id: string; title: string; batchId: string | null; mode: string; startsAt: string; endsAt: string; location?: string; meetingUrl?: string; notes?: string; status: string; notificationLog?: Record<string, { sentAt?: string; error?: string }> }
type Enrollment = { userId: string; batchId: string | null; user: { email: string } }
type Attendance = { userId: string; email: string; status: string; notes: string; historical?: boolean }
const blankSession = { title: '', batchId: '', mode: 'physical', startsAt: '', endsAt: '', location: '', meetingUrl: '', notes: '' }
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2'
const button = 'rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50'
const secondary = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50'
const localDate = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const deliveryMessage = (result: { notifications?: { sent?: number; failed?: number; skipped?: number } | { sent?: number; failed?: number; skipped?: number }[] }) => {
  if (!result.notifications) return ''
  const notices = Array.isArray(result.notifications) ? result.notifications : [result.notifications]
  const sent = notices.reduce((sum, item) => sum + (item.sent || 0), 0)
  const failed = notices.reduce((sum, item) => sum + (item.failed || 0), 0)
  return ` Emails sent: ${sent}. Failed: ${failed}.${failed ? ' Use Retry pending emails in Sessions.' : ''}`
}

export default function TrainingWorkspace() {
  useLocale()

  const currentCourse = useRef('')
  const [role, setRole] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [staff, setStaff] = useState<{ id: string; email: string }[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [trainer, setTrainer] = useState({ email: '', password: '' })
  const [batchForm, setBatchForm] = useState({ name: '', trainerId: '' })
  const [candidateEmail, setCandidateEmail] = useState('')
  const [memberBatch, setMemberBatch] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [sessionForm, setSessionForm] = useState(blankSession)
  const [editingSession, setEditingSession] = useState('')
  const [attendanceSession, setAttendanceSession] = useState('')
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [meetingLink, setMeetingLink] = useState('')
  const course = courses.find(item => item.id === courseId)
  const admin = ['admin', 'super_admin'].includes(role)
  const coursesPath = role === 'trainer' ? '/trainer/courses' : '/admin/courses'

  const loadCourse = useCallback(async () => {
    if (!courseId) return
    const [batchData, sessionData, enrollmentData] = await Promise.all([
      trainingRequest(`/${courseId}/batches`), trainingRequest(`/${courseId}/sessions`), trainingRequest(`/${courseId}/enrollments`)
    ])
    if (currentCourse.current !== courseId) return
    setBatches(batchData.data); setSessions(sessionData.data); setEnrollments(enrollmentData.data)
  }, [courseId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const user = readStoredUser()
        if (!['trainer', 'admin', 'super_admin'].includes(user.role)) {
          window.location.assign(user.role ? '/dashboard' : '/login'); return
        }
        setRole(user.role)
        const [courseData, staffData] = await Promise.all([trainingRequest('/manage/courses'), trainingRequest('/staff')])
        if (!cancelled) { setCourses(courseData.data); setStaff(staffData.data); setCourseId(courseData.data[0]?.id || '') }
      } catch (err) { if (!cancelled) setError((err as Error).message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    currentCourse.current = courseId
    setBatches([]); setSessions([]); setEnrollments([]); setAttendance([]); setAttendanceSession(''); setMemberBatch(''); setEditingSession(''); setSessionForm(blankSession); setMeetingLink('')
    loadCourse().catch(err => setError(err.message))
  }, [loadCourse])

  async function run(action: () => Promise<any>, success: string) {
    setBusy(true); setError(''); setMessage('')
    try { const result = await action(); await loadCourse(); setMessage(success + deliveryMessage(result || {})) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  async function saveSession() {
    await run(async () => {
      const body = { ...sessionForm, startsAt: new Date(sessionForm.startsAt).toISOString(), endsAt: new Date(sessionForm.endsAt).toISOString() }
      const result = await trainingRequest(editingSession ? `/sessions/${editingSession}` : `/${courseId}/sessions`, { method: editingSession ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      setEditingSession(''); setSessionForm(blankSession)
      return result
    }, 'Class saved.')
  }
  async function openMeeting(session: Session) {
    await run(async () => {
      const result = await trainingRequest(`/sessions/${session.id}/join`)
      setMeetingLink(result.data.meetingUrl)
      return result
    }, 'Meeting link ready. Use Open meeting below.')
  }
  if (loading) return <main className="pt-24 text-center">{tr("Loading training workspace...")}</main>
  return (
    <main className="min-h-screen bg-gray-50 px-5 pb-12 pt-24">
      <div className="mx-auto max-w-6xl space-y-6">
        <header><h1 className="text-3xl font-bold">{tr("Training workspace")}</h1><p className="mt-2 text-gray-600">{tr("Manage courses, batches, class schedules, and trainee attendance.")}</p>
          <nav className="mt-4 flex flex-wrap gap-4"><Link href={coursesPath} className="text-blue-700 underline">{tr("Manage courses")}</Link><a href="#batches" className="text-blue-700 underline">{tr("Batches")}</a><a href="#classes" className="text-blue-700 underline">{tr("Classes")}</a><a href="#attendance" className="text-blue-700 underline">{tr("Attendance")}</a></nav>
        </header>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{trError(error)}</p>}
        {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{tr(message)}</p>}
        {meetingLink && <p className="rounded-xl border bg-white p-4"><a href={meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{tr("Open meeting ↗")}</a><span className="ml-3 text-sm text-gray-500">{tr("The meeting opens in your video provider.")}</span></p>}
        {admin && <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{tr("Create trainer account")}</h2><p className="my-2 text-sm text-gray-600">{tr("Trainers log in using email and password. Give the initial password directly to the trainer.")}</p>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={event => { event.preventDefault(); run(async () => { const result = await trainingRequest('/staff', { method: 'POST', body: JSON.stringify(trainer) }); setTrainer({ email: '', password: '' }); setStaff((await trainingRequest('/staff')).data); return result }, 'Trainer created.') }}>
            <label>{tr("Email")}<input required type="email" autoComplete="off" className={input} value={trainer.email} onChange={event => setTrainer({ ...trainer, email: event.target.value })} /></label>
            <label>{tr("Initial password")}<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" className={input} value={trainer.password} onChange={event => setTrainer({ ...trainer, password: event.target.value })} /></label>
            <button disabled={busy} className={`${button} self-end`}>{tr("Create trainer")}</button>
          </form>
        </section>}
        <section className="rounded-xl border bg-white p-5"><label className="font-medium" htmlFor="managed-course">{tr("Course")}</label><select id="managed-course" className={`${input} mt-2`} disabled={busy} value={courseId} onChange={event => setCourseId(event.target.value)}><option value="">{tr("Select course")}</option>{courses.map(item => <option key={item.id} value={item.id}>{item.title}{tr(item.status === 'inactive' ? ' (inactive)' : '')}</option>)}</select>
          {!courses.length && <p className="mt-3 text-gray-600">{tr("No courses assigned yet. Create a course or ask an admin to assign you a batch.")}</p>}
        </section>
        {course && <>
          {course.canEdit && <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{tr("Enroll an existing candidate")}</h2><p className="my-2 text-sm text-gray-600">{tr("Grant access after confirming eligibility or arranging paid enrollment. Free courses also support candidate self-enrollment.")}</p><form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); run(async () => { const result = await trainingRequest(`/${courseId}/enrollments`, { method: 'POST', body: JSON.stringify({ email: candidateEmail }) }); setCandidateEmail(''); return result }, 'Candidate enrolled.') }}><label className="grow">{tr("Candidate email")}<input type="email" required className={input} value={candidateEmail} onChange={event => setCandidateEmail(event.target.value)} /></label><button disabled={busy} className={`${button} self-end`}>{tr("Grant access")}</button></form></section>}
          <section id="batches" className="scroll-mt-24 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{tr("Batches")}</h2>
            {course.canEdit && <form className="my-4 grid gap-3 md:grid-cols-3" onSubmit={event => { event.preventDefault(); run(async () => { const result = await trainingRequest(`/${courseId}/batches`, { method: 'POST', body: JSON.stringify(batchForm) }); setBatchForm({ name: '', trainerId: '' }); return result }, 'Batch created.') }}>
              <label>{tr("Batch name")}<input required maxLength={200} className={input} value={batchForm.name} onChange={event => setBatchForm({ ...batchForm, name: event.target.value })} /></label>
              <label>{tr("Trainer")}<select className={input} value={batchForm.trainerId} onChange={event => setBatchForm({ ...batchForm, trainerId: event.target.value })}><option value="">{tr(role === 'trainer' ? 'Assign to me' : 'No trainer yet')}</option>{staff.map(item => <option value={item.id} key={item.id}>{item.email}</option>)}</select></label>
              <button disabled={busy} className={`${button} self-end`}>{tr("Create batch")}</button>
            </form>}
            {!batches.length && <p className="my-3 text-gray-500">{tr("No batches yet.")}</p>}
            <div className="space-y-3">{batches.map(batch => <article key={batch.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{batch.name}</h3><p className="text-sm text-gray-600">{batch.trainer?.email || tr('No trainer assigned')} · {tr(batch.status)} · {enrollments.filter(item => item.batchId === batch.id).length}{tr(" members")}</p></div>
              {course.canEdit && batch.status === 'active' && <button disabled={busy} className={secondary} onClick={() => { setMemberBatch(batch.id); setMembers(enrollments.filter(item => item.batchId === batch.id).map(item => item.userId)) }}>{tr("Assign members")}</button>}
              {admin && <label className="text-sm">{tr("Assign trainer")}<select disabled={busy} className={input} value={batch.trainerId || ''} onChange={event => run(() => trainingRequest(`/batches/${batch.id}`, { method: 'PATCH', body: JSON.stringify({ trainerId: event.target.value || null }) }), 'Trainer assignment updated.')}><option value="">{tr("No trainer")}</option>{staff.map(item => <option value={item.id} key={item.id}>{item.email}</option>)}</select></label>}
              {course.canEdit && <button disabled={busy} className={secondary} onClick={() => run(() => trainingRequest(`/batches/${batch.id}`, { method: 'PATCH', body: JSON.stringify({ status: batch.status === 'active' ? 'archived' : 'active' }) }), 'Batch status updated.')}>{tr(batch.status === 'active' ? 'Archive batch' : 'Reactivate batch')}</button>}
            </div></article>)}</div>
            {memberBatch && <div className="mt-4 rounded-lg bg-blue-50 p-4"><h3 className="font-semibold">{tr("Members of ")}{batches.find(item => item.id === memberBatch)?.name}</h3><p className="mb-3 text-sm text-gray-600">{tr("Each candidate can belong to one batch per course. Selecting a candidate moves them from their previous batch.")}</p>{enrollments.map(item => <label className="mb-2 block" key={item.userId}><input type="checkbox" checked={members.includes(item.userId)} onChange={event => setMembers(event.target.checked ? [...members, item.userId] : members.filter(id => id !== item.userId))} /> <span>{item.user.email}{tr(item.batchId && item.batchId !== memberBatch ? ' (in another batch)' : '')}</span></label>)}{!enrollments.length && <p>{tr("No candidates enrolled yet.")}</p>}<button disabled={busy} className={`${button} mt-3`} onClick={() => run(async () => { const result = await trainingRequest(`/batches/${memberBatch}/members`, { method: 'PUT', body: JSON.stringify({ userIds: members }) }); setMemberBatch(''); return result }, 'Batch members saved.')}>{tr("Save members")}</button><button className="ml-3 underline" onClick={() => setMemberBatch('')}>{tr("Close")}</button></div>}
          </section>
          <section id="classes" className="scroll-mt-24 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{tr("Class sessions")}</h2><p className="my-2 text-sm text-gray-600">{tr("Physical sessions include a venue. Online sessions use a Meet, Zoom, or other meeting link. Invitations go to enrolled candidates; times below use ")}{tr(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p>
            <form className="my-5 grid gap-3 md:grid-cols-2" onSubmit={event => { event.preventDefault(); saveSession() }}>
              <label>{tr("Class title")}<input required maxLength={200} className={input} value={sessionForm.title} onChange={event => setSessionForm({ ...sessionForm, title: event.target.value })} /></label>
              <label>{tr("Audience")}<select required={!course.canEdit} disabled={!!editingSession} className={input} value={sessionForm.batchId} onChange={event => setSessionForm({ ...sessionForm, batchId: event.target.value })}><option value="">{tr(course.canEdit ? 'All enrolled candidates' : 'Choose assigned batch')}</option>{batches.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>{tr("Mode")}<select className={input} value={sessionForm.mode} onChange={event => setSessionForm({ ...sessionForm, mode: event.target.value })}><option value="physical">{tr("Physical class")}</option><option value="online">{tr("Online live class")}</option></select></label>
              <label>{tr(sessionForm.mode === 'physical' ? 'Venue / full address' : 'Meeting link')}<input required type={sessionForm.mode === 'online' ? 'url' : 'text'} className={input} value={sessionForm.mode === 'physical' ? sessionForm.location : sessionForm.meetingUrl} onChange={event => setSessionForm({ ...sessionForm, [sessionForm.mode === 'physical' ? 'location' : 'meetingUrl']: event.target.value })} /></label>
              <label>{tr("Starts")}<input required type="datetime-local" className={input} value={sessionForm.startsAt} onChange={event => setSessionForm({ ...sessionForm, startsAt: event.target.value })} /></label>
              <label>{tr("Ends")}<input required type="datetime-local" className={input} value={sessionForm.endsAt} onChange={event => setSessionForm({ ...sessionForm, endsAt: event.target.value })} /></label>
              <label className="md:col-span-2">{tr("Instructions")}<textarea maxLength={4000} className={input} value={sessionForm.notes} onChange={event => setSessionForm({ ...sessionForm, notes: event.target.value })} /></label>
              <div><button disabled={busy || course.status !== 'active'} className={button}>{tr(editingSession ? 'Save changes and notify candidates' : 'Schedule class and send invitations')}</button>{editingSession && <button type="button" className="ml-3 underline" onClick={() => { setEditingSession(''); setSessionForm(blankSession) }}>{tr("Cancel edit")}</button>}</div>
            </form>
            <button disabled={busy} className={`${secondary} mb-4`} onClick={() => run(async () => ({}), 'Class list refreshed.')}>{tr("Refresh status")}</button>
            {!sessions.length && <p className="text-gray-500">{tr("No classes scheduled yet.")}</p>}
            <div className="space-y-4">{sessions.map(session => {
              const logs = Object.values(session.notificationLog || {})
              const canStart = new Date(session.startsAt).getTime() <= Date.now() && new Date(session.endsAt).getTime() > Date.now()
              return <article className="rounded-lg border p-4" key={session.id}><h3 className="font-semibold">{session.title}</h3><p className="mt-1 text-sm">{tr(session.mode)} · {tr(session.status)} · {batches.find(item => item.id === session.batchId)?.name || tr('All enrolled candidates')}</p><p className="text-sm text-gray-600">{tr(new Date(session.startsAt).toLocaleString(locale()))} — {tr(new Date(session.endsAt).toLocaleString(locale()))}</p>{session.mode === 'physical' && <p className="mt-2">{tr("Location: ")}{session.location}</p>}<p className="mt-2 text-sm text-gray-500">{tr("Emails: ")}{logs.filter(item => item.sentAt).length}{tr(" sent · ")}{logs.filter(item => item.error).length}{tr(" failed")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.status === 'scheduled' && <><button disabled={busy || !canStart} title={tr("Available during the scheduled class time")} className={button} onClick={() => run(() => trainingRequest(`/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'live' }) }), 'Class started. Candidates can now join online classes.')}>{tr("Start class")}</button><button disabled={busy} className={secondary} onClick={() => { setEditingSession(session.id); setSessionForm({ title: session.title, batchId: session.batchId || '', mode: session.mode, startsAt: localDate(session.startsAt), endsAt: localDate(session.endsAt), location: session.location || '', meetingUrl: session.meetingUrl || '', notes: session.notes || '' }); document.getElementById('classes')?.scrollIntoView() }}>{tr("Edit schedule")}</button></>}
                  {session.mode === 'online' && ['scheduled', 'live'].includes(session.status) && <button disabled={busy} className={secondary} onClick={() => openMeeting(session)}>{tr("Get meeting link")}</button>}
                  {session.status === 'live' && <button disabled={busy} className={secondary} onClick={() => run(() => trainingRequest(`/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }), 'Class completed.')}>{tr("End class")}</button>}
                  {['scheduled', 'live'].includes(session.status) && <button disabled={busy} className={secondary} onClick={() => { if (window.confirm('Cancel this class and notify its candidates?')) run(() => trainingRequest(`/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }), 'Class cancelled.') }}>{tr("Cancel class")}</button>}
                  {session.status !== 'completed' && <button disabled={busy} className={secondary} onClick={() => run(() => trainingRequest(`/sessions/${session.id}/notify`, { method: 'POST' }), 'Notification retry finished.')}>{tr("Retry pending emails")}</button>}
                  <button disabled={busy} className={secondary} onClick={() => run(async () => { const result = await trainingRequest(`/sessions/${session.id}/attendance`); setAttendanceSession(session.id); setAttendance(result.data); document.getElementById('attendance')?.scrollIntoView(); return result }, 'Attendance roster loaded.')}>{tr("Attendance")}</button>
                </div></article>
            })}</div>
          </section>
          <section id="attendance" className="scroll-mt-24 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{tr("Trainee attendance")}</h2>{!attendanceSession ? <p className="mt-3 text-gray-600">{tr("Choose Attendance on a class above to load its roster.")}</p> : <><p className="my-3 font-medium">{sessions.find(item => item.id === attendanceSession)?.title}</p><p className="my-2 text-sm">{tr("Present: ")}{attendance.filter(item => item.status === 'present').length}{tr(" · Absent: ")}{attendance.filter(item => item.status === 'absent').length}{tr(" · Excused: ")}{attendance.filter(item => item.status === 'excused').length}</p><div className="space-y-3">{attendance.map((item, index) => <div key={item.userId} className="grid items-center gap-3 border-b pb-3 md:grid-cols-3"><span className="break-all">{item.email}{tr(item.historical ? ' (former member)' : '')}</span><label><span className="sr-only">{tr("Attendance for ")}{item.email}</span><select disabled={busy || item.historical} className={input} value={item.status} onChange={event => setAttendance(attendance.map((row, rowIndex) => rowIndex === index ? { ...row, status: event.target.value } : row))}>{item.status === 'unmarked' && <option value="unmarked">{tr("Not marked")}</option>}<option value="present">{tr("Present")}</option><option value="absent">{tr("Absent")}</option><option value="excused">{tr("Excused")}</option></select></label><label><span className="sr-only">{tr("Notes for ")}{item.email}</span><input disabled={busy || item.historical} maxLength={1000} placeholder={tr("Optional note")} className={input} value={item.notes} onChange={event => setAttendance(attendance.map((row, rowIndex) => rowIndex === index ? { ...row, notes: event.target.value } : row))} /></label></div>)}</div>{!attendance.length && <p className="text-gray-600">{tr("No trainees in this session.")}</p>}<button disabled={busy || !attendance.length} className={`${button} mt-4`} onClick={() => run(() => trainingRequest(`/sessions/${attendanceSession}/attendance`, { method: 'PUT', body: JSON.stringify({ records: attendance.filter(item => !item.historical && item.status !== 'unmarked').map(({ userId, status, notes }) => ({ userId, status, notes })) }) }), 'Attendance saved.')}>{tr("Save attendance")}</button></>}
          </section>
        </>}
      </div>
    </main>
  )
}
