"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Application {
  id: string
  status: string
  coverLetter: string
  createdAt: string
  interviewDate?: string
  candidate?: {
    id: string
    email: string
    firstName: string
    lastName: string
    phone: string
    candidateProfile?: {
      headline: string
      skills: string[]
      yearsOfExperience: number
      currentLocation: string
      resumeUrl: string
    }
  }
}

interface Job {
  id: string
  title: string
  location: string
  industry: string
  jobType: string
  status: string
  totalApplications: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  shortlisted: "bg-yellow-100 text-yellow-700",
  interview_scheduled: "bg-purple-100 text-purple-700",
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
  const [interviewDate, setInterviewDate] = useState("")
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)

  useEffect(() => {
    const user = localStorage.getItem("user")
    if (!user) { router.replace("/login"); return }
    const parsed = JSON.parse(user)
    if (parsed.role !== "employer") { router.replace("/dashboard"); return }
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    const token = localStorage.getItem("token")
    try {
      const res = await fetch("http://localhost:5000/api/v1/employer/jobs", {
        headers: { Authorization: "Bearer " + token }
      })
      const data = await res.json()
      if (data.success) setJobs(data.data)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const fetchApplications = async (job: Job) => {
    setSelectedJob(job)
    setAppLoading(true)
    setApplications([])
    const token = localStorage.getItem("token")
    try {
      const res = await fetch("http://localhost:5000/api/v1/employer/jobs/" + job.id + "/applications", {
        headers: { Authorization: "Bearer " + token }
      })
      const data = await res.json()
      if (data.success) setApplications(data.data)
    } catch (err) { console.error(err) }
    setAppLoading(false)
  }

  const updateStatus = async (appId: string, status: string) => {
    const token = localStorage.getItem("token")
    const body: any = { status }
    if (status === "interview_scheduled" && interviewDate) body.interviewDate = interviewDate
    try {
      const res = await fetch("http://localhost:5000/api/v1/employer/applications/" + appId + "/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Status updated!")
        setSelectedAppId(null)
        setInterviewDate("")
        if (selectedJob) fetchApplications(selectedJob)
        setTimeout(() => setMessage(""), 3000)
      }
    } catch (err) { console.error(err) }
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <p className="text-gray-400">Loading dashboard...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-1">Employer Dashboard</h1>
          <p className="text-blue-100">Manage your job postings and applications</p>
        </div>
        {message && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium">{message}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">My Jobs ({jobs.length})</h2>
                <a href="/post-job" className="text-blue-600 text-sm hover:underline">+ Post Job</a>
              </div>
              {jobs.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <p className="mb-3">No jobs posted yet</p>
                  <a href="/post-job" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700">Post Your First Job</a>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {jobs.map(job => (
                    <button key={job.id} onClick={() => fetchApplications(job)}
                      className={"w-full text-left p-4 hover:bg-blue-50 transition-colors " + (selectedJob?.id === job.id ? "bg-blue-50 border-l-4 border-blue-600" : "")}>
                      <p className="font-semibold text-gray-900 text-sm mb-1">{job.title}</p>
                      <p className="text-gray-500 text-xs mb-2">{job.location} - {job.jobType}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{job.totalApplications} applied</span>
                        <span className={"text-xs px-2 py-0.5 rounded-full " + (job.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>{job.status}</span>
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
                  <h2 className="font-bold text-gray-900">{selectedJob.title}</h2>
                  <p className="text-gray-500 text-sm">{applications.length} applications</p>
                </div>
                {appLoading ? (
                  <div className="p-12 text-center text-gray-400">Loading applications...</div>
                ) : applications.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">No applications yet for this job</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {applications.map(app => (
                      <div key={app.id} className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-gray-900">{app.candidate?.firstName} {app.candidate?.lastName}</p>
                            <p className="text-gray-500 text-sm">{app.candidate?.email}</p>
                            {app.candidate?.candidateProfile?.headline && <p className="text-gray-600 text-sm mt-1">{app.candidate.candidateProfile.headline}</p>}
                          </div>
                          <span className={"px-3 py-1 rounded-full text-xs font-medium " + (STATUS_COLORS[app.status] || "bg-gray-100 text-gray-700")}>{app.status.replace("_", " ")}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
                          {app.candidate?.candidateProfile?.yearsOfExperience !== undefined && <span>Exp: {app.candidate.candidateProfile.yearsOfExperience} yrs</span>}
                          {app.candidate?.candidateProfile?.currentLocation && <span>Location: {app.candidate.candidateProfile.currentLocation}</span>}
                          {app.candidate?.phone && <span>Phone: {app.candidate.phone}</span>}
                        </div>
                        {app.candidate?.candidateProfile?.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {app.candidate.candidateProfile.skills.slice(0, 5).map((skill, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{skill}</span>
                            ))}
                          </div>
                        )}
                        {app.coverLetter && <p className="text-gray-600 text-sm bg-gray-50 rounded-xl p-3 mb-3 italic">"{app.coverLetter}"</p>}
                        {app.candidate?.candidateProfile?.resumeUrl && (
                          <a href={"http://localhost:5000" + app.candidate.candidateProfile.resumeUrl} target="_blank" className="text-blue-600 text-sm hover:underline mr-4">View Resume</a>
                        )}
                        {app.interviewDate && <p className="text-purple-700 text-sm mt-2">Interview: {new Date(app.interviewDate).toLocaleString()}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {app.status !== "shortlisted" && <button onClick={() => updateStatus(app.id, "shortlisted")} className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-xl hover:bg-yellow-100">Shortlist</button>}
                          {app.status !== "hired" && <button onClick={() => updateStatus(app.id, "hired")} className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-xl hover:bg-green-100">Hire</button>}
                          {app.status !== "rejected" && <button onClick={() => updateStatus(app.id, "rejected")} className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-xl hover:bg-red-100">Reject</button>}
                          <button onClick={() => setSelectedAppId(selectedAppId === app.id ? null : app.id)} className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-xl hover:bg-purple-100">Schedule Interview</button>
                        </div>
                        {selectedAppId === app.id && (
                          <div className="mt-3 flex gap-2">
                            <input type="datetime-local" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500" />
                            <button onClick={() => updateStatus(app.id, "interview_scheduled")} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700">Confirm</button>
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
