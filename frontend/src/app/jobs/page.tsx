'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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
  isFeatured?: boolean
  featuredUntil?: string | null
}

const INDUSTRIES = [
  'IT',
  'Finance',
  'Banking',
  'Healthcare',
  'Manufacturing',
  'Pharma',
  'Civil',
  'Automation',
  'Mechanical',
  'Logistics',
  'Others'
]

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'remote']

const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Newest', value: 'newest' },
  { label: 'Salary: High to Low', value: 'salaryHigh' },
  { label: 'Salary: Low to High', value: 'salaryLow' }
]

export default function JobsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const keywordParam = searchParams.get('keyword') || ''
  const locationParam = searchParams.get('location') || ''
  const industryParam = searchParams.get('industry') || ''
  const jobTypeParam = searchParams.get('jobType') || ''
  const sortByParam = searchParams.get('sortBy') || 'relevance'
  const pageParam = Number(searchParams.get('page') || '1')

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())

  const [keyword, setKeyword] = useState(keywordParam)
  const [location, setLocation] = useState(locationParam)
  const [industry, setIndustry] = useState(industryParam)
  const [jobType, setJobType] = useState(jobTypeParam)
  const [sortBy, setSortBy] = useState(sortByParam)

  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const limit = 10

  useEffect(() => {
    setKeyword(keywordParam)
    setLocation(locationParam)
    setIndustry(industryParam)
    setJobType(jobTypeParam)
    setSortBy(sortByParam)
  }, [keywordParam, locationParam, industryParam, jobTypeParam, sortByParam])

  const activeFilters = useMemo(
    () =>
      !!(
        keywordParam ||
        locationParam ||
        industryParam ||
        jobTypeParam ||
        (sortByParam && sortByParam !== 'relevance')
      ),
    [keywordParam, locationParam, industryParam, jobTypeParam, sortByParam]
  )

  const updateUrlParams = (
    updates: Record<string, string | number | null>,
    resetPage = false
  ) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    })

    if (resetPage) {
      params.set('page', '1')
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentKeyword = searchParams.get('keyword') || ''
      const currentLocation = searchParams.get('location') || ''

      if (keyword !== currentKeyword || location !== currentLocation) {
        updateUrlParams(
          {
            keyword: keyword.trim() || null,
            location: location.trim() || null
          },
          true
        )
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [keyword, location])

  const fetchSavedJobIds = async () => {
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || '{}')

    if (!token || user.role !== 'candidate') return

    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs-actions/saved', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()

      if (data.success) {
        setSavedJobIds(new Set(data.data.map((s: any) => s.jobId)))
      }
    } catch (error) {
      console.error('Failed to fetch saved jobs', error)
    }
  }

  const toggleSave = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    e.preventDefault()

    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/login'
      return
    }

    try {
      const res = await fetch(`http://localhost:5000/api/v1/jobs-actions/save/${jobId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })

      const data = await res.json()

      if (data.success) {
        setSavedJobIds((prev) => {
          const next = new Set(prev)
          if (data.saved) next.add(jobId)
          else next.delete(jobId)
          return next
        })
      }
    } catch (error) {
      console.error('Failed to save job', error)
    }
  }

  const fetchJobs = async () => {
    setLoading(true)

    const params = new URLSearchParams()

    if (keywordParam) params.append('keyword', keywordParam)
    if (locationParam) params.append('location', locationParam)
    if (industryParam) params.append('industry', industryParam)
    if (jobTypeParam) params.append('jobType', jobTypeParam)
    if (sortByParam) params.append('sortBy', sortByParam)

    params.append('status', 'active')
    params.append('page', String(pageParam > 0 ? pageParam : 1))
    params.append('limit', String(limit))

    try {
      const res = await fetch(
        `http://localhost:5000/api/v1/jobs/search/advanced?${params.toString()}`
      )
      const data = await res.json()

      if (data.success) {
        setJobs(data.data || [])
        setTotal(data.count || 0)
        setTotalPages(data.totalPages || 1)
      } else {
        setJobs([])
        setTotal(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('Failed to fetch jobs', error)
      setJobs([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSavedJobIds()
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [keywordParam, locationParam, industryParam, jobTypeParam, sortByParam, pageParam])

  const handleIndustryChange = (value: string) => {
    setIndustry(value)
    updateUrlParams({ industry: value || null }, true)
  }

  const handleJobTypeChange = (value: string) => {
    setJobType(value)
    updateUrlParams({ jobType: value || null }, true)
  }

  const handleSortChange = (value: string) => {
    setSortBy(value)
    updateUrlParams({ sortBy: value === 'relevance' ? null : value }, true)
  }

  const clearFilters = () => {
    setKeyword('')
    setLocation('')
    setIndustry('')
    setJobType('')
    setSortBy('relevance')
    router.replace(pathname, { scroll: false })
  }

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return
    updateUrlParams({ page: nextPage })
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find Your Perfect Job</h1>
          <p className="text-blue-100">Browse thousands of jobs across all industries</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-4 shadow-lg flex flex-wrap gap-3">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Job title, skills, keywords..."
              className="flex-1 min-w-48 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            />

            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="w-40 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            />

            <select
              value={industry}
              onChange={(e) => handleIndustryChange(e.target.value)}
              className="w-40 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            >
              <option value="">All Industries</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>

            <select
              value={jobType}
              onChange={(e) => handleJobTypeChange(e.target.value)}
              className="w-36 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            >
              <option value="">All Types</option>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-44 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500 text-sm">
            {loading ? 'Searching...' : `${total} jobs found`}
          </p>

          {activeFilters && (
            <button onClick={clearFilters} className="text-blue-600 text-sm hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse"
              >
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
          <>
            <div className="space-y-4">
              {jobs.map((job) => (
                <Link
                  href={`/jobs/${job.id}`}
                  key={job.id}
                  className={`block rounded-2xl p-6 shadow-sm border transition-all ${
                    job.isFeatured
                      ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300 hover:shadow-md'
                      : 'bg-white border-gray-100 hover:shadow-md hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                        {job.isFeatured && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold border border-yellow-200">
                            ⭐ Featured
                          </span>
                        )}
                      </div>

                      <p className="text-gray-500 text-sm">
                        {job.location} • {job.experienceLevel}
                      </p>
                    </div>

                    <span className="text-green-600 font-semibold text-sm whitespace-nowrap">
                      ₹{Number(job.salaryMin || 0).toLocaleString()} – ₹
                      {Number(job.salaryMax || 0).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{job.description}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    {job.industry && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                        {job.industry}
                      </span>
                    )}

                    {job.jobType && (
                      <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                        {job.jobType}
                      </span>
                    )}

                    {job.requiredSkills?.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={(e) => toggleSave(e, job.id)}
                      className={`text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
                        savedJobIds.has(job.id)
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-200'
                      }`}
                    >
                      {savedJobIds.has(job.id) ? 'Saved' : 'Save Job'}
                    </button>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => goToPage(pageParam - 1)}
                  disabled={pageParam <= 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {pageParam} of {totalPages}
                </span>

                <button
                  onClick={() => goToPage(pageParam + 1)}
                  disabled={pageParam >= totalPages}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}