'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Job {
  id: string
  title: string
  location: string
  description: string
  industry: string
  jobType: string
  salaryMin: number
  salaryMax: number
  requiredSkills: string[]
  experienceLevel: string
}

const INDUSTRIES = ['IT','Finance','Banking','Healthcare','Manufacturing','Pharma','Civil','Automation','Mechanical','Logistics','Others']
const JOB_TYPES = ['full-time','part-time','contract','internship','remote']

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [savedJobIds, setSavedJobIds] = useState<Set<number>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')
  const [jobType, setJobType] = useState('')
  const [total, setTotal] = useState(0)

  const fetchSavedJobIds = async () => {
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!token || user.role !== 'candidate') return
    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs-actions/saved', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) setSavedJobIds(new Set(data.data.map((s: any) => s.jobId)))
    } catch {}
  }

  const toggleSave = async (e: React.MouseEvent, jobId: number) => {
    e.stopPropagation()
    e.preventDefault()
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs-actions/save/' + jobId, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        setSavedJobIds(prev => {
          const next = new Set(prev)
          if (data.saved) next.add(jobId)
          else next.delete(jobId)
          return next
        })
      }
    } catch {}
  }

  const fetchJobs = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (keyword) params.append('keyword', keyword)
    if (location) params.append('location', location)
    if (industry) params.append('industry', industry)
    if (jobType) params.append('jobType', jobType)

    try {
      const res = await fetch(`http://localhost:5000/api/v1/jobs?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setJobs(data.data)
        setTotal(data.total)
      }
    } catch {
      console.error('Failed to fetch jobs')
    }
    setLoading(false)
  }

  useEffect(() => { fetchJobs()
    fetchSavedJobIds() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchJobs()
  }

  const clearFilters = () => {
    setKeyword('')
    setLocation('')
    setIndustry('')
    setJobType('')
    setTimeout(fetchJobs, 100)
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">

      {/* Header + Search */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find Your Perfect Job</h1>
          <p className="text-blue-100">Browse thousands of jobs across all industries</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-4 shadow-lg flex flex-wrap gap-3">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Job title, skills, keywords..."
              className="flex-1 min-w-48 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location"
              className="w-40 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            />
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-40 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            >
              <option value="">All Industries</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              className="w-36 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            >
              <option value="">All Types</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500 text-sm">{loading ? 'Searching...' : `${total} jobs found`}</p>
          {(keyword || location || industry || jobType) && (
            <button onClick={clearFilters} className="text-blue-600 text-sm hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">No jobs found</p>
            <p className="text-gray-300 text-sm">Try different keywords or filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <Link
                href={`/jobs/${job.id}`}
                key={job.id}
                className="block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                  <span className="text-green-600 font-semibold text-sm whitespace-nowrap ml-4">
                    ₹{Number(job.salaryMin).toLocaleString()} – ₹{Number(job.salaryMax).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mb-3">{job.location} • {job.experienceLevel}</p>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{job.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">{job.industry}</span>
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">{job.jobType}</span>
                  {job.requiredSkills?.slice(0,3).map((s,i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{s}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}