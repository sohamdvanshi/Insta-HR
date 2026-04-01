'use client'
import { useState, useEffect } from 'react'

export default function AIMatchPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('http://localhost:5000/api/v1/jobs')
      .then(res => res.json())
      .then(data => {
        if (data.success) setJobs(data.data)
      })
  }, [])

  const handleMatch = async () => {
    if (!selectedJob) {
      setMessage('Please select a job first!')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/login'
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`http://localhost:5000/api/v1/candidates/ai-match/${selectedJob}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setResults(data.data)
        if (data.data.length === 0) setMessage('No candidates found!')
      }
    } catch (err) {
      setMessage('Something went wrong')
    }
    setLoading(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-50 border-green-200'
    if (score >= 40) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <main className='min-h-screen bg-gray-50 pt-16'>

      {/* Header */}
      <div className='bg-gradient-to-r from-blue-600 to-purple-600 py-12 px-6'>
        <div className='max-w-6xl mx-auto text-center'>
          <h1 className='text-3xl font-bold text-white mb-2'>🤖 AI Resume Matching</h1>
          <p className='text-blue-100'>Find the best candidates for your job using AI</p>
        </div>
      </div>

      <div className='max-w-4xl mx-auto px-6 py-8'>

        {/* Job Selector */}
        <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8'>
          <h2 className='font-bold text-gray-900 mb-4'>Select a Job to Match Candidates</h2>

          <div className='flex gap-4'>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              className='flex-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
            >
              <option value=''>-- Select a Job --</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.location}
                </option>
              ))}
            </select>

            <button
              onClick={handleMatch}
              disabled={loading}
              className='px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50'
            >
              {loading ? 'Matching...' : '🤖 Find Matches'}
            </button>
          </div>

          {message && (
            <p className='text-red-500 text-sm mt-3'>{message}</p>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div>
            <h2 className='font-bold text-gray-900 mb-4 text-xl'>
              Found {results.length} candidate{results.length > 1 ? 's' : ''}
            </h2>
            <div className='space-y-4'>
              {results.map((candidate, index) => (
                <div
                  key={candidate.candidateId}
                  className={`bg-white rounded-2xl p-6 shadow-sm border ${getScoreBg(candidate.matchScore)}`}
                >
                  <div className='flex items-start justify-between mb-4'>
                    <div className='flex items-center gap-4'>
                      <div className='w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg'>
                        {index + 1}
                      </div>
                      <div>
                        <h3 className='text-lg font-bold text-gray-900'>
                          {candidate.name || 'Unknown Candidate'}
                        </h3>
                        <p className='text-gray-500 text-sm'>Candidate ID: {candidate.candidateId?.substring(0, 8)}...</p>
                      </div>
                    </div>

                    <div className='text-right'>
                      <div className={`text-3xl font-bold ${getScoreColor(candidate.matchScore)}`}>
                        {candidate.matchScore}%
                      </div>
                      <div className='text-xs text-gray-400'>Match Score</div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className='grid grid-cols-3 gap-4 mb-4'>
                    <div className='text-center p-3 bg-white rounded-xl border border-gray-100'>
                      <div className='text-lg font-bold text-blue-600'>{candidate.skillScore}%</div>
                      <div className='text-xs text-gray-400'>Skill Match</div>
                    </div>
                    <div className='text-center p-3 bg-white rounded-xl border border-gray-100'>
                      <div className='text-lg font-bold text-purple-600'>{candidate.expScore}%</div>
                      <div className='text-xs text-gray-400'>Experience</div>
                    </div>
                    <div className='text-center p-3 bg-white rounded-xl border border-gray-100'>
                      <div className='text-lg font-bold text-green-600'>
                        {candidate.matchedSkills?.length || 0}
                      </div>
                      <div className='text-xs text-gray-400'>Skills Matched</div>
                    </div>
                  </div>

                  {/* Matched Skills */}
                  {candidate.matchedSkills?.length > 0 && (
                    <div className='mb-3'>
                      <p className='text-xs font-medium text-gray-500 mb-2'>MATCHED SKILLS</p>
                      <div className='flex flex-wrap gap-2'>
                        {candidate.matchedSkills.map((skill: string) => (
                          <span key={skill} className='px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full'>
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Skills */}
                  {candidate.missingSkills?.length > 0 && (
                    <div>
                      <p className='text-xs font-medium text-gray-500 mb-2'>MISSING SKILLS</p>
                      <div className='flex flex-wrap gap-2'>
                        {candidate.missingSkills.map((skill: string) => (
                          <span key={skill} className='px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full'>
                            ✗ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
