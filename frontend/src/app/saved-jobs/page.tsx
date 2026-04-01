'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SavedJobsPage() {
  const router = useRouter()
  const [savedJobs, setSavedJobs] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('saved')
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [alertForm, setAlertForm] = useState({ keywords: '', location: '', industry: '', jobType: '', email: '' })
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<any>(null)

  const INDUSTRIES = ['IT','Finance','Banking','Healthcare','Manufacturing','Pharma','Civil','Automation','Mechanical','Logistics','Others']
  const JOB_TYPES = ['full-time','part-time','contract','remote','internship']

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token) { router.push('/login'); return }
    if (userData) setUser(JSON.parse(userData))
    fetchSavedJobs(token)
    fetchAlerts(token)
  }, [])

  const fetchSavedJobs = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs-actions/saved', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) setSavedJobs(data.data)
    } catch {}
    setLoading(false)
  }

  const fetchAlerts = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs-actions/alerts', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) setAlerts(data.data)
    } catch {}
  }

  const unsaveJob = async (jobId: number) => {
    const token = localStorage.getItem('token')
    await fetch('http://localhost:5000/api/v1/jobs-actions/save/' + jobId, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }
    })
    setSavedJobs(prev => prev.filter(s => s.jobId !== jobId))
  }

  const createAlert = async () => {
    if (!alertForm.keywords && !alertForm.location && !alertForm.industry) {
      setMessage('Please fill at least one filter (keywords, location, or industry)')
      return
    }
    const token = localStorage.getItem('token')
    const userData = JSON.parse(localStorage.getItem('user') || '{}')
    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs-actions/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...alertForm, email: alertForm.email || userData.email })
      })
      const data = await res.json()
      if (data.success) {
        setAlerts(prev => [data.data, ...prev])
        setShowAlertForm(false)
        setAlertForm({ keywords: '', location: '', industry: '', jobType: '', email: '' })
        setMessage('✓ Job alert created! You will get emails when matching jobs are posted.')
        setTimeout(() => setMessage(''), 4000)
      }
    } catch {}
  }

  const deleteAlert = async (id: number) => {
    const token = localStorage.getItem('token')
    await fetch('http://localhost:5000/api/v1/jobs-actions/alerts/' + id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const toggleAlert = async (id: number) => {
    const token = localStorage.getItem('token')
    const res = await fetch('http://localhost:5000/api/v1/jobs-actions/alerts/' + id + '/toggle', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + token }
    })
    const data = await res.json()
    if (data.success) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isActive: data.isActive } : a))
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Saved Jobs</h1>
            <p className="text-gray-500">Your bookmarked jobs and email alerts</p>
          </div>
          <button onClick={() => setShowAlertForm(true)}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm">
            🔔 + New Alert
          </button>
        </div>

        {message && (
          <div className="bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-xl mb-6 font-medium">
            {message}
          </div>
        )}

        {/* Create Alert Modal */}
        {showAlertForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">🔔 Create Job Alert</h2>
                <button onClick={() => setShowAlertForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Get email notifications when new matching jobs are posted.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                  <input value={alertForm.keywords} onChange={e => setAlertForm({...alertForm, keywords: e.target.value})}
                    placeholder="e.g. React Developer, Python, Manager"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input value={alertForm.location} onChange={e => setAlertForm({...alertForm, location: e.target.value})}
                    placeholder="e.g. Mumbai, Pune, Remote"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <select value={alertForm.industry} onChange={e => setAlertForm({...alertForm, industry: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm">
                      <option value="">Any</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                    <select value={alertForm.jobType} onChange={e => setAlertForm({...alertForm, jobType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm">
                      <option value="">Any</option>
                      {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert Email</label>
                  <input type="email" value={alertForm.email} onChange={e => setAlertForm({...alertForm, email: e.target.value})}
                    placeholder={user?.email || 'your@email.com'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to use your account email</p>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAlertForm(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium text-sm">
                  Cancel
                </button>
                <button onClick={createAlert}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm">
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('saved')}
            className={"px-5 py-2 rounded-xl font-medium text-sm transition-colors " + (activeTab === 'saved' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400')}>
            🔖 Saved Jobs ({savedJobs.length})
          </button>
          <button onClick={() => setActiveTab('alerts')}
            className={"px-5 py-2 rounded-xl font-medium text-sm transition-colors " + (activeTab === 'alerts' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400')}>
            🔔 Job Alerts ({alerts.length})
          </button>
        </div>

        {/* ── SAVED JOBS TAB ── */}
        {activeTab === 'saved' && (
          <div className="space-y-4">
            {savedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <div className="text-5xl mb-4">🔖</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No saved jobs yet</h3>
                <p className="text-gray-500 mb-4">Browse jobs and click the bookmark icon to save them here.</p>
                <Link href="/jobs" className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 inline-block">
                  Browse Jobs
                </Link>
              </div>
            ) : savedJobs.map(saved => (
              <div key={saved.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-lg">{saved.job?.title}</h3>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full capitalize">{saved.job?.jobType}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">🏢 {saved.job?.companyName} &nbsp;•&nbsp; 📍 {saved.job?.location}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>🏭 {saved.job?.industry}</span>
                      {saved.job?.salaryMin && <span>💰 ₹{saved.job.salaryMin.toLocaleString()} - ₹{saved.job.salaryMax.toLocaleString()}</span>}
                      <span>Saved {formatDate(saved.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Link href={'/jobs/' + saved.job?.id}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                      Apply
                    </Link>
                    <button onClick={() => unsaveJob(saved.jobId)}
                      className="px-3 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:border-red-300 hover:text-red-500 transition-colors">
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <div className="text-5xl mb-4">🔔</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No job alerts yet</h3>
                <p className="text-gray-500 mb-4">Create an alert and get emailed when matching jobs are posted.</p>
                <button onClick={() => setShowAlertForm(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
                  Create First Alert
                </button>
              </div>
            ) : alerts.map(alert => (
              <div key={alert.id} className={"bg-white rounded-2xl p-5 border shadow-sm " + (alert.isActive ? 'border-gray-100' : 'border-gray-200 opacity-60')}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={"w-2 h-2 rounded-full " + (alert.isActive ? 'bg-green-500' : 'bg-gray-400')}></span>
                      <span className={"text-xs font-medium " + (alert.isActive ? 'text-green-600' : 'text-gray-400')}>
                        {alert.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {alert.keywords && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">🔍 {alert.keywords}</span>}
                      {alert.location && <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">📍 {alert.location}</span>}
                      {alert.industry && <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">🏭 {alert.industry}</span>}
                      {alert.jobType && <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-full capitalize">💼 {alert.jobType}</span>}
                    </div>
                    <p className="text-xs text-gray-400">📧 Alerts sent to: {alert.email}</p>
                    {alert.lastSentAt && <p className="text-xs text-gray-400">Last alert: {formatDate(alert.lastSentAt)}</p>}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => toggleAlert(alert.id)}
                      className={"px-3 py-1.5 text-xs rounded-xl font-medium border transition-colors " + (alert.isActive ? 'border-yellow-300 text-yellow-600 hover:bg-yellow-50' : 'border-green-300 text-green-600 hover:bg-green-50')}>
                      {alert.isActive ? '⏸ Pause' : '▶ Resume'}
                    </button>
                    <button onClick={() => deleteAlert(alert.id)}
                      className="px-3 py-1.5 text-xs rounded-xl font-medium border border-red-200 text-red-500 hover:bg-red-50">
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {alerts.length > 0 && (
              <button onClick={() => setShowAlertForm(true)}
                className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 rounded-2xl hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
                + Create Another Alert
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
