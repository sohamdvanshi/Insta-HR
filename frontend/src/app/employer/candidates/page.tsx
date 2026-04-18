"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Candidate {
  id: string
  userId: string
  firstName?: string
  lastName?: string
  headline?: string
  summary?: string
  skills?: string[]
  experience?: any[]
  education?: any[]
  currentLocation?: string
  expectedSalary?: string | number
  yearsOfExperience?: number | string
  resumeUrl?: string
  industry?: string
  profileCompleteness?: number
  email?: string
  phone?: string
}

export default function EmployerCandidatesPage() {
  const router = useRouter()

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState({
    keyword: "",
    location: "",
    industry: "",
    minExperience: "",
    skills: ""
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

    fetchCandidates()
  }, [router])

  const fetchCandidates = async (customFilters = filters) => {
    const token = localStorage.getItem("token")
    setError("")
    setSearching(true)

    try {
      const params = new URLSearchParams()

      if (customFilters.keyword.trim()) params.append("keyword", customFilters.keyword.trim())
      if (customFilters.location.trim()) params.append("location", customFilters.location.trim())
      if (customFilters.industry.trim()) params.append("industry", customFilters.industry.trim())
      if (customFilters.minExperience.trim()) params.append("minExperience", customFilters.minExperience.trim())
      if (customFilters.skills.trim()) params.append("skills", customFilters.skills.trim())

      const query = params.toString()
      const url = `http://localhost:5000/api/v1/employer/candidates${query ? `?${query}` : ""}`

      const res = await fetch(url, {
        headers: {
          Authorization: "Bearer " + token
        }
      })

      const data = await res.json()

      if (data.success) {
        setCandidates(data.data || [])
      } else {
        setError(data.message || "Failed to load candidates")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load candidates")
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const handleSearch = () => {
    fetchCandidates(filters)
  }

  const clearFilters = () => {
    const cleared = {
      keyword: "",
      location: "",
      industry: "",
      minExperience: "",
      skills: ""
    }
    setFilters(cleared)
    fetchCandidates(cleared)
  }

  const formatNamePart = (value?: string) => {
    if (!value) return ""
    return value
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ")
  }

  const getCandidateName = (candidate: Candidate) => {
    const firstName = formatNamePart(candidate.firstName)
    const lastName = formatNamePart(candidate.lastName)
    const fullName = `${firstName} ${lastName}`.trim()
    return fullName || candidate.email || "Candidate"
  }

  const getExperienceValue = (value?: number | string) => {
    if (value === undefined || value === null || value === "") return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading candidates...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-1">Resume Databank</h1>
          <p className="text-blue-100">
            Search public candidate profiles by skill, location, industry, and experience
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6 font-medium">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Keyword"
              value={filters.keyword}
              onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />

            <input
              type="text"
              placeholder="Location"
              value={filters.location}
              onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />

            <input
              type="text"
              placeholder="Industry"
              value={filters.industry}
              onChange={(e) => setFilters((prev) => ({ ...prev, industry: e.target.value }))}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />

            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="Min Experience"
              value={filters.minExperience}
              onChange={(e) => setFilters((prev) => ({ ...prev, minExperience: e.target.value }))}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />

            <input
              type="text"
              placeholder="Skills (comma separated)"
              value={filters.skills}
              onChange={(e) => setFilters((prev) => ({ ...prev, skills: e.target.value }))}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search Candidates"}
            </button>

            <button
              onClick={clearFilters}
              className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {candidates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
            <p className="text-lg mb-2">No candidates found</p>
            <p className="text-sm">Try changing your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {candidates.map((candidate) => {
              const experienceValue = getExperienceValue(candidate.yearsOfExperience)
              const hasSkills = Array.isArray(candidate.skills) && candidate.skills.length > 0
              const hasSummary = !!candidate.summary?.trim()
              const hasHeadline = !!candidate.headline?.trim()
              const hasLocation = !!candidate.currentLocation?.trim()
              const hasIndustry = !!candidate.industry?.trim()
              const hasPhone = !!candidate.phone?.trim()
              const showCompleteness =
                typeof candidate.profileCompleteness === "number" && candidate.profileCompleteness > 0

              return (
                <div
                  key={candidate.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {getCandidateName(candidate)}
                      </h2>
                      <p className="text-gray-500 text-sm">
                        {candidate.email || "No email available"}
                      </p>

                      {hasHeadline && (
                        <p className="text-gray-600 text-sm mt-1">{candidate.headline}</p>
                      )}
                    </div>

                    {showCompleteness && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap">
                        {candidate.profileCompleteness}% complete
                      </span>
                    )}
                  </div>

                  {(experienceValue !== null || hasLocation || hasIndustry || hasPhone) && (
                    <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
                      {experienceValue !== null && <span>Exp: {experienceValue} yrs</span>}
                      {hasLocation && <span>Location: {candidate.currentLocation}</span>}
                      {hasIndustry && <span>Industry: {candidate.industry}</span>}
                      {hasPhone && <span>Phone: {candidate.phone}</span>}
                    </div>
                  )}

                  {hasSummary ? (
                    <p className="text-gray-600 text-sm mb-3 leading-6">{candidate.summary}</p>
                  ) : (
                    <p className="text-gray-400 text-sm mb-3 italic">No summary added yet.</p>
                  )}

                  {hasSkills && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {candidate.skills!.slice(0, 8).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {candidate.resumeUrl && (
                      <a
                        href={candidate.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm hover:underline"
                      >
                        View Resume
                      </a>
                    )}

                    {candidate.email && (
                      <a
                        href={`mailto:${candidate.email}`}
                        className="text-purple-600 text-sm hover:underline"
                      >
                        Contact Candidate
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}