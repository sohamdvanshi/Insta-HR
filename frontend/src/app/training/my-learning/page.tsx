'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MyLearningPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/login')
      return
    }

    const fetchMyCourses = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/v1/training/my/enrolled', {
          headers: {
            Authorization: 'Bearer ' + token
          }
        })

        const data = await res.json()

        if (!data.success) {
          setError(data.message || 'Failed to load enrolled courses')
          setLoading(false)
          return
        }

        const enrolledCourses = data.data || []
        setCourses(enrolledCourses)

        const progressResults: Record<string, any> = {}

        await Promise.all(
          enrolledCourses.map(async (course: any) => {
            if (!course.videoUrl) return

            try {
              const progressRes = await fetch(
                'http://localhost:5000/api/v1/training/' + course.id + '/progress',
                {
                  headers: {
                    Authorization: 'Bearer ' + token
                  }
                }
              )

              const progressData = await progressRes.json()

              if (progressData.success) {
                progressResults[course.id] = progressData.data
              }
            } catch {
            }
          })
        )

        setProgressMap(progressResults)
      } catch {
        setError('Failed to load enrolled courses')
      } finally {
        setLoading(false)
      }
    }

    fetchMyCourses()
  }, [router])

  const completedCount = courses.filter((course) => {
    const progress = progressMap[course.id]
    return progress?.completed
  }).length

  const inProgressCount = courses.filter((course) => {
    const progress = progressMap[course.id]
    return progress && !progress.completed && Number(progress.progressPercent || 0) > 0
  }).length

  const notStartedCount = courses.filter((course) => {
    const progress = progressMap[course.id]
    if (!course.videoUrl) return false
    return !progress || Number(progress.progressPercent || 0) === 0
  }).length

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading your learning dashboard...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/training" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to Training
          </Link>

          <h1 className="text-4xl font-bold text-white mb-3">My Learning</h1>
          <p className="text-blue-100 text-lg mb-8">
            Access your enrolled courses and continue learning from where you left off
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">{courses.length}</div>
              <div className="text-blue-100 text-sm">Enrolled Courses</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">{inProgressCount}</div>
              <div className="text-blue-100 text-sm">In Progress</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">{completedCount}</div>
              <div className="text-blue-100 text-sm">Completed</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="text-2xl font-bold text-white">{notStartedCount}</div>
              <div className="text-blue-100 text-sm">Not Started</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6 border border-red-200">
            {error}
          </div>
        )}

        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No enrolled courses yet</h2>
            <p className="text-gray-500 mb-6">Start learning by enrolling in a course from the training library.</p>
            <Link
              href="/training"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Courses</h2>
              <Link href="/training" className="text-blue-600 hover:underline text-sm font-medium">
                Explore More Courses
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {courses.map((course) => {
                const progress = progressMap[course.id]
                const progressPercent = Math.round(Number(progress?.progressPercent || 0))
                const completed = !!progress?.completed
                const hasVideo = !!course.videoUrl

                let statusText = 'Enrolled'
                let statusColor = 'bg-blue-100 text-blue-700'

                if (hasVideo) {
                  if (completed) {
                    statusText = 'Completed'
                    statusColor = 'bg-green-100 text-green-700'
                  } else if (progressPercent > 0) {
                    statusText = 'In Progress'
                    statusColor = 'bg-orange-100 text-orange-700'
                  } else {
                    statusText = 'Not Started'
                    statusColor = 'bg-gray-100 text-gray-700'
                  }
                } else {
                  statusText = 'Content Coming Soon'
                  statusColor = 'bg-purple-100 text-purple-700'
                }

                return (
                  <div
                    key={course.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <div
                      className={
                        'h-44 relative flex items-center justify-center ' +
                        (course.type === 'live'
                          ? 'bg-gradient-to-br from-red-500 to-orange-500'
                          : 'bg-gradient-to-br from-blue-500 to-purple-600')
                      }
                    >
                      <span className="text-6xl">{course.emoji || '📚'}</span>

                      {course.thumbnail && (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}

                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="px-2 py-1 bg-white/90 text-gray-800 text-xs font-medium rounded-full">
                          {course.category}
                        </span>
                        {course.type === 'live' && (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                            LIVE
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className={'px-2.5 py-1 text-xs font-medium rounded-full ' + statusColor}>
                          {statusText}
                        </span>
                        <span className="text-xs text-gray-400">
                          {hasVideo ? `${progressPercent}%` : 'No video'}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-2">{course.title}</h3>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{course.description}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                        <span>⏱ {course.duration}</span>
                        <span>👥 {course.enrollmentCount} enrolled</span>
                        {course.rating > 0 && <span>⭐ {course.rating}</span>}
                      </div>

                      {hasVideo && (
                        <div className="mb-4">
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                            <div
                              className={'h-full rounded-full ' + (completed ? 'bg-green-500' : 'bg-blue-600')}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{progressPercent}% completed</span>
                            <span>
                              {completed
                                ? 'Finished'
                                : progressPercent > 0
                                ? 'Continue learning'
                                : 'Start now'}
                            </span>
                          </div>
                        </div>
                      )}

                      {!hasVideo && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                          Video lessons have not been uploaded yet for this course.
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mb-5">
                        {course.skills?.slice(0, 4).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <Link
                          href={'/training/' + course.id}
                          className="block w-full py-3 bg-blue-600 text-white font-semibold rounded-xl text-center hover:bg-blue-700 transition-colors"
                        >
                          {hasVideo
                            ? completed
                              ? 'Review Course'
                              : progressPercent > 0
                              ? 'Continue Learning'
                              : 'Start Course'
                            : 'View Course'}
                        </Link>

                        {completed && (
                          <Link
                            href={'/training/' + course.id + '/certificate'}
                            className="block w-full py-3 bg-green-50 text-green-700 font-semibold rounded-xl text-center hover:bg-green-100 transition-colors border border-green-200"
                          >
                            View Certificate
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}