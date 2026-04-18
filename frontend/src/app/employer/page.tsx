"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface CandidateProfile {
  firstName?: string
  lastName?: string
  headline?: string
  skills?: string[]
  yearsOfExperience?: number
  currentLocation?: string
  resumeUrl?: string
}

interface Candidate {
  id: string
  email: string
  phone?: string
  candidateProfile?: CandidateProfile
}

interface Application {
  id: string
  status: string
  coverLetter?: string
  createdAt: string
  interviewDate?: string
  interviewMode?: "online" | "offline"
  interviewMeetingLink?: string
  interviewLocation?: string
  interviewNotes?: string
  interviewStatus?: "scheduled" | "completed" | "cancelled" | "rescheduled"
  candidate?: Candidate
}

interface Job {
  id: string
  title: string
  location?: string
  industry?: string
  jobType?: string
  status: string
  totalApplications: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  shortlisted: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700"
}

export default function EmployerDashboard() {
  const router = useRouter()

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [appLoading, setAppLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [jobActionLoading, setJobActionLoading] = useState(false)

  const [interviewForm, setInterviewForm] = useState({
    interviewDate: "",
    interviewMode: "online" as "online" | "offline",
    interviewMeetingLink: "",
    interviewLocation: "",
    interviewNotes: ""
  })

  useEffect(() => {
    const user = localStorage.getItem("user")
    if (!user) {
      router.replace("/login")
      return
    }

    const parsed = JSON.parse(user)
    if (parsed.role !== "employer") {
      router.replace("/dashboard")
      return
    }

    fetchJobs()
  }, [router])

  const fetchJobs = async () => {
    const token = localStorage.getItem("token")
    setError("")

    try {
      const res = await fetch("http://localhost:5000/api/v1/employer/jobs", {
        headers: {
          Authorization: "Bearer " + token
        }
      })

      const data = await res.json()

      if (data.success) {
        const jobsData = data.data || []
        setJobs(jobsData)

        if (selectedJob) {
          const updatedSelectedJob = jobsData.find((job: Job) => job.id === selectedJob.id) || null
          setSelectedJob(updatedSelectedJob)
        }
      } else {
        setError(data.message || "Failed to load jobs")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load jobs")
    } finally {
      setLoading(false)
    }
  }

  const fetchApplications = async (job: Job) => {
    setSelectedJob(job)
    setAppLoading(true)
    setApplications([])
    setError("")

    const token = localStorage.getItem("token")

    try {
      const res = await fetch(`http://localhost:5000/api/v1/employer/jobs/${job.id}/applications`, {
        headers: {
          Authorization: "Bearer " + token
        }
      })

      const data = await res.json()

      if (data.success) {
        setApplications(data.data || [])
      } else {
        setError(data.message || "Failed to load applications")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load applications")
    } finally {
      setAppLoading(false)
    }
  }

  const updateStatus = async (appId: string, status: string) => {
    const token = localStorage.getItem("token")
    setError("")

    try {
      const res = await fetch(`http://localhost:5000/api/v1/applications/${appId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ status })
      })

      const data = await res.json()

      if (data.success) {
        setMessage("Status updated successfully")
        if (selectedJob) {
          fetchApplications(selectedJob)
          fetchJobs()
        }
        setTimeout(() => setMessage(""), 3000)
      } else {
        setError(data.message || "Failed to update status")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to update status")
    }
  }

  const openScheduleForm = (appId: string) => {
    if (selectedAppId === appId) {
      setSelectedAppId(null)
      setInterviewForm({
        interviewDate: "",
        interviewMode: "online",
        interviewMeetingLink: "",
        interviewLocation: "",
        interviewNotes: ""
      })
      return
    }

    setSelectedAppId(appId)
    setInterviewForm({
      interviewDate: "",
      interviewMode: "online",
      interviewMeetingLink: "",
      interviewLocation: "",
      interviewNotes: ""
    })
    setError("")
  }

  const scheduleInterview = async (appId: string) => {
    const token = localStorage.getItem("token")
    setError("")

    if (!interviewForm.interviewDate) {
      setError("Please select interview date and time")
      return
    }

    if (interviewForm.interviewMode === "online" && !interviewForm.interviewMeetingLink.trim()) {
      setError("Please enter meeting link for online interview")
      return
    }

    if (interviewForm.interviewMode === "offline" && !interviewForm.interviewLocation.trim()) {
      setError("Please enter interview location for offline interview")
      return
    }

    setScheduleLoading(true)

    try {
      const body: Record<string, string> = {
        interviewDate: new Date(interviewForm.interviewDate).toISOString(),
        interviewMode: interviewForm.interviewMode,
        interviewNotes: interviewForm.interviewNotes
      }

      if (interviewForm.interviewMode === "online") {
        body.interviewMeetingLink = interviewForm.interviewMeetingLink
      } else {
        body.interviewLocation = interviewForm.interviewLocation
      }

      const res = await fetch(`http://localhost:5000/api/v1/applications/${appId}/schedule-interview`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (data.success) {
        setMessage("Interview scheduled successfully")
        setSelectedAppId(null)
        setInterviewForm({
          interviewDate: "",
          interviewMode: "online",
          interviewMeetingLink: "",
          interviewLocation: "",
          interviewNotes: ""
        })
        if (selectedJob) {
          fetchApplications(selectedJob)
          fetchJobs()
        }
        setTimeout(() => setMessage(""), 3000)
      } else {
        setError(data.message || "Failed to schedule interview")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to schedule interview")
    } finally {
      setScheduleLoading(false)
    }
  }

  const handleEditJob = (jobId: string) => {
    router.push(`/employer/jobs/${jobId}/edit`)
  }

  const handleDeleteJob = async (jobId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this job? This action cannot be undone.")
    if (!confirmed) return

    const token = localStorage.getItem("token")
    setError("")
    setMessage("")
    setJobActionLoading(true)

    try {
      const res = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token
        }
      })

      const data = await res.json()

      if (data.success) {
        setMessage("Job deleted successfully")
        if (selectedJob?.id === jobId) {
          setSelectedJob(null)
          setApplications([])
        }
        await fetchJobs()
        setTimeout(() => setMessage(""), 3000)
      } else {
        setError(data.message || "Failed to delete job")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to delete job")
    } finally {
      setJobActionLoading(false)
    }
  }

  const handleToggleJobStatus = async (job: Job) => {
    const isClosing = job.status === "active"
    const confirmed = window.confirm(
      isClosing
        ? "Are you sure you want to close this job?"
        : "Are you sure you want to reopen this job?"
    )
    if (!confirmed) return

    const token = localStorage.getItem("token")
    setError("")
    setMessage("")
    setJobActionLoading(true)

    try {
      const endpoint = isClosing
        ? `http://localhost:5000/api/v1/jobs/${job.id}/close`
        : `http://localhost:5000/api/v1/jobs/${job.id}/reopen`

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token
        }
      })

      const data = await res.json()

      if (data.success) {
        setMessage(isClosing ? "Job closed successfully" : "Job reopened successfully")
        await fetchJobs()

        const updatedJob = {
          ...job,
          status: isClosing ? "closed" : "active"
        }
        setSelectedJob(updatedJob)

        setTimeout(() => setMessage(""), 3000)
      } else {
        setError(data.message || "Failed to update job status")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to update job status")
    } finally {
      setJobActionLoading(false)
    }
  }

  const getCandidateDisplayName = (app: Application) => {
    const firstName = app.candidate?.candidateProfile?.firstName
    const lastName = app.candidate?.candidateProfile?.lastName

    if (firstName) {
      return `${firstName} ${lastName || ""}`.trim()
    }

    return app.candidate?.email || "Candidate"
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Hero banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">Employer Dashboard</h1>
              <p className="text-blue-100">Manage your job postings and applications</p>
            </div>
            <a
              href="/ai-screening"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white text-purple-700 font-bold rounded-xl shadow hover:bg-purple-50 transition-colors text-sm whitespace-nowrap"
            >
              🤖 AI Resume Screening
            </a>
          </div>
        </div>

        {message && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Jobs list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">My Jobs ({jobs.length})</h2>
                <a href="/post-job" className="text-blue-600 text-sm hover:underline">
                  + Post Job
                </a>
              </div>

              {jobs.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <p className="mb-3">No jobs posted yet</p>
                  <a
                    href="/post-job"
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"
                  >
                    Post Your First Job
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => fetchApplications(job)}
                      className={
                        "w-full text-left p-4 hover:bg-blue-50 transition-colors " +
                        (selectedJob?.id === job.id ? "bg-blue-50 border-l-4 border-blue-600" : "")
                      }
                    >
                      <p className="font-semibold text-gray-900 text-sm mb-1">{job.title}</p>
                      <p className="text-gray-500 text-xs mb-2">
                        {job.location || "Location not set"} - {job.jobType || "Job type not set"}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {job.totalApplications || 0} applied
                        </span>
                        <span
                          className={
                            "text-xs px-2 py-0.5 rounded-full " +
                            (job.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600")
                          }
                        >
                          {job.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {!selectedJob ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                <p className="text-lg mb-2">Select a job to view applications</p>
                <p className="text-sm">Click any job from the left panel</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="font-bold text-gray-900">{selectedJob.title}</h2>
                      <p className="text-gray-500 text-sm">
                        {applications.length} applications
                      </p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                          {selectedJob.location || "Location not set"}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                          {selectedJob.jobType || "Job type not set"}
                        </span>
                        <span
                          className={
                            "text-xs px-2 py-1 rounded-full " +
                            (selectedJob.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600")
                          }
                        >
                          {selectedJob.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleEditJob(selectedJob.id)}
                        disabled={jobActionLoading}
                        className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50"
                      >
                        Edit Job
                      </button>

                      <button
                        onClick={() => handleToggleJobStatus(selectedJob)}
                        disabled={jobActionLoading}
                        className={
                          "px-3 py-2 text-sm font-medium rounded-xl disabled:opacity-50 " +
                          (selectedJob.status === "active"
                            ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100")
                        }
                      >
                        {selectedJob.status === "active" ? "Close Job" : "Reopen Job"}
                      </button>

                      <button
                        onClick={() => handleDeleteJob(selectedJob.id)}
                        disabled={jobActionLoading}
                        className="px-3 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Job
                      </button>
                    </div>
                  </div>
                </div>

                {appLoading ? (
                  <div className="p-12 text-center text-gray-400">Loading applications...</div>
                ) : applications.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">No applications yet for this job</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {applications.map((app) => (
                      <div key={app.id} className="p-6">
                        <div className="flex items-start justify-between mb-3 gap-4">
                          <div>
                            <p className="font-bold text-gray-900">
                              {getCandidateDisplayName(app)}
                            </p>
                            <p className="text-gray-500 text-sm">{app.candidate?.email}</p>
                            {app.candidate?.candidateProfile?.headline && (
                              <p className="text-gray-600 text-sm mt-1">
                                {app.candidate.candidateProfile.headline}
                              </p>
                            )}
                          </div>

                          <span
                            className={
                              "px-3 py-1 rounded-full text-xs font-medium " +
                              (STATUS_COLORS[app.status] || "bg-gray-100 text-gray-700")
                            }
                          >
                            {app.status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
                          {app.candidate?.candidateProfile?.yearsOfExperience !== undefined && (
                            <span>Exp: {app.candidate.candidateProfile.yearsOfExperience} yrs</span>
                          )}
                          {app.candidate?.candidateProfile?.currentLocation && (
                            <span>Location: {app.candidate.candidateProfile.currentLocation}</span>
                          )}
                          {app.candidate?.phone && <span>Phone: {app.candidate.phone}</span>}
                        </div>

                        {app.candidate?.candidateProfile?.skills &&
                          app.candidate.candidateProfile.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {app.candidate.candidateProfile.skills.slice(0, 5).map((skill, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}

                        {app.coverLetter && (
                          <p className="text-gray-600 text-sm bg-gray-50 rounded-xl p-3 mb-3 italic">
                            "{app.coverLetter}"
                          </p>
                        )}

                        {app.candidate?.candidateProfile?.resumeUrl && (
                          <a
                            href={"http://localhost:5000" + app.candidate.candidateProfile.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 text-sm hover:underline mr-4"
                          >
                            View Resume
                          </a>
                        )}

                        {app.interviewDate && (
                          <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm">
                            <p className="text-purple-800 font-medium">
                              Interview: {new Date(app.interviewDate).toLocaleString()}
                            </p>
                            {app.interviewStatus && (
                              <p className="text-purple-700 mt-1">
                                Status: {app.interviewStatus}
                              </p>
                            )}
                            {app.interviewMode && (
                              <p className="text-purple-700 mt-1">
                                Mode: {app.interviewMode === "online" ? "Online" : "Offline"}
                              </p>
                            )}
                            {app.interviewMeetingLink && (
                              <a
                                href={app.interviewMeetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-700 underline mt-1 block"
                              >
                                Join Meeting
                              </a>
                            )}
                            {app.interviewLocation && (
                              <p className="text-purple-700 mt-1">
                                Location: {app.interviewLocation}
                              </p>
                            )}
                            {app.interviewNotes && (
                              <p className="text-purple-700 mt-1">
                                Notes: {app.interviewNotes}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {app.status !== "shortlisted" && (
                            <button
                              onClick={() => updateStatus(app.id, "shortlisted")}
                              className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-xl hover:bg-yellow-100"
                            >
                              Shortlist
                            </button>
                          )}

                          {app.status !== "hired" && (
                            <button
                              onClick={() => updateStatus(app.id, "hired")}
                              className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-xl hover:bg-green-100"
                            >
                              Hire
                            </button>
                          )}

                          {app.status !== "rejected" && (
                            <button
                              onClick={() => updateStatus(app.id, "rejected")}
                              className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-xl hover:bg-red-100"
                            >
                              Reject
                            </button>
                          )}

                          <button
                            onClick={() => openScheduleForm(app.id)}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-xl hover:bg-purple-100"
                          >
                            {selectedAppId === app.id ? "Close Interview Form" : "Schedule Interview"}
                          </button>
                        </div>

                        {selectedAppId === app.id && (
                          <div className="mt-4 space-y-3 bg-gray-50 rounded-xl p-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Interview Date & Time
                              </label>
                              <input
                                type="datetime-local"
                                value={interviewForm.interviewDate}
                                onChange={(e) =>
                                  setInterviewForm((prev) => ({
                                    ...prev,
                                    interviewDate: e.target.value
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Interview Mode
                              </label>
                              <select
                                value={interviewForm.interviewMode}
                                onChange={(e) =>
                                  setInterviewForm((prev) => ({
                                    ...prev,
                                    interviewMode: e.target.value as "online" | "offline"
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500"
                              >
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                              </select>
                            </div>

                            {interviewForm.interviewMode === "online" ? (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Meeting Link
                                </label>
                                <input
                                  type="text"
                                  value={interviewForm.interviewMeetingLink}
                                  onChange={(e) =>
                                    setInterviewForm((prev) => ({
                                      ...prev,
                                      interviewMeetingLink: e.target.value
                                    }))
                                  }
                                  placeholder="https://meet.google.com/..."
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Interview Location
                                </label>
                                <input
                                  type="text"
                                  value={interviewForm.interviewLocation}
                                  onChange={(e) =>
                                    setInterviewForm((prev) => ({
                                      ...prev,
                                      interviewLocation: e.target.value
                                    }))
                                  }
                                  placeholder="Enter office address"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes
                              </label>
                              <textarea
                                rows={3}
                                value={interviewForm.interviewNotes}
                                onChange={(e) =>
                                  setInterviewForm((prev) => ({
                                    ...prev,
                                    interviewNotes: e.target.value
                                  }))
                                }
                                placeholder="Optional instructions for the candidate"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500 resize-none"
                              />
                            </div>

                            <button
                              onClick={() => scheduleInterview(app.id)}
                              disabled={scheduleLoading}
                              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50"
                            >
                              {scheduleLoading ? "Scheduling..." : "Confirm Interview"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}