'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const API_BASE = 'http://localhost:5000/api/v1'

export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [progressPercent, setProgressPercent] = useState(0)
  const [watchTimeSeconds, setWatchTimeSeconds] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [lastSaved, setLastSaved] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(false)

  const [quizResult, setQuizResult] = useState<any>(null)
  const [loadingQuizResult, setLoadingQuizResult] = useState(false)

  useEffect(() => {
    fetch(API_BASE + '/training/' + params.id)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCourse(data.data)
        else setError('Course not found')
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load course')
        setLoading(false)
      })
  }, [params.id])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !params.id) return

    const fetchEnrollmentStatus = async () => {
      try {
        const res = await fetch(
          API_BASE + '/training/' + params.id + '/enrollment-status',
          {
            headers: {
              Authorization: 'Bearer ' + token
            }
          }
        )
        const data = await res.json()
        if (data.success) {
          setEnrolled(!!data.enrolled)
        }
      } catch {
      }
    }

    fetchEnrollmentStatus()
  }, [params.id])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !params.id || !course?.videoUrl || !enrolled) return

    const fetchProgress = async () => {
      setLoadingProgress(true)
      try {
        const res = await fetch(API_BASE + '/training/' + params.id + '/progress', {
          headers: {
            Authorization: 'Bearer ' + token
          }
        })
        const data = await res.json()

        if (data.success && data.data) {
          setProgressPercent(Number(data.data.progressPercent || 0))
          setWatchTimeSeconds(Number(data.data.watchTimeSeconds || 0))
          setCompleted(!!data.data.completed)
        }
      } catch {
      } finally {
        setLoadingProgress(false)
      }
    }

    fetchProgress()
  }, [params.id, course?.videoUrl, enrolled])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !params.id || !enrolled || !completed) {
      setQuizResult(null)
      return
    }

    const fetchQuizResult = async () => {
      setLoadingQuizResult(true)

      try {
        const res = await fetch(API_BASE + '/training/' + params.id + '/quiz/result', {
          headers: {
            Authorization: 'Bearer ' + token
          }
        })

        const data = await res.json()

        if (res.ok && data.success) {
          setQuizResult(data.data)
        } else {
          setQuizResult(null)
        }
      } catch {
        setQuizResult(null)
      } finally {
        setLoadingQuizResult(false)
      }
    }

    fetchQuizResult()
  }, [params.id, enrolled, completed])

  const saveProgress = async (percent: number, watchedSeconds: number) => {
    const token = localStorage.getItem('token')
    if (!token || !course?.videoUrl || !enrolled) return

    try {
      const res = await fetch(API_BASE + '/training/' + params.id + '/progress', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          progressPercent: percent,
          watchTimeSeconds: watchedSeconds
        })
      })

      const data = await res.json()

      if (data.success && data.data) {
        setProgressPercent(Number(data.data.progressPercent || 0))
        setWatchTimeSeconds(Number(data.data.watchTimeSeconds || 0))
        setCompleted(!!data.data.completed)
        setLastSaved(new Date().toLocaleTimeString())
      }
    } catch {
    }
  }

  const handleEnroll = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    setEnrolling(true)
    try {
      const res = await fetch(API_BASE + '/training/' + params.id + '/enroll', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        setEnrolled(true)
        setMessage(data.message || 'Successfully enrolled!')
      } else {
        setError(data.message || 'Failed to enroll')
      }
    } catch {
      setError('Failed to enroll')
    }
    setEnrolling(false)
  }

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    if (!video.duration || Number.isNaN(video.duration)) return

    const percent = Math.min(100, (video.currentTime / video.duration) * 100)
    const watched = Math.floor(video.currentTime)

    setProgressPercent(percent)
    setWatchTimeSeconds(watched)
    setCompleted(percent >= 90)
  }

  const handleVideoPause = () => {
    if (!course?.videoUrl || !enrolled) return
    saveProgress(progressPercent, watchTimeSeconds)
  }

  const handleVideoEnded = () => {
    if (!course?.videoUrl || !enrolled) return
    const finalSeconds = Math.floor(videoRef.current?.duration || watchTimeSeconds)
    setProgressPercent(100)
    setCompleted(true)
    saveProgress(100, finalSeconds)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !course?.videoUrl || !enrolled) return

    const interval = setInterval(() => {
      if (!video.paused && !video.ended && video.duration) {
        const percent = Math.min(100, (video.currentTime / video.duration) * 100)
        const watched = Math.floor(video.currentTime)
        saveProgress(percent, watched)
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [course?.videoUrl, params.id, enrolled, progressPercent, watchTimeSeconds])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading course...</p>
      </main>
    )
  }

  if (error || !course) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error || 'Course not found'}</p>
          <Link href="/training" className="text-blue-600 hover:underline">
            Back to Training
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div
        className={
          'py-12 px-6 ' +
          (course.type === 'live'
            ? 'bg-gradient-to-r from-red-600 to-orange-500'
            : 'bg-gradient-to-r from-blue-600 to-purple-600')
        }
      >
        <div className="max-w-6xl mx-auto">
          <Link href="/training" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to Training
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex gap-2 mb-4">
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                  {course.category}
                </span>
                {course.type === 'live' && (
                  <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    LIVE
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold text-white mb-4">{course.title}</h1>
              <p className="text-white/80 mb-6">{course.description}</p>

              <div className="flex flex-wrap gap-4 text-white/70 text-sm mb-6">
                <span>⏱ {course.duration}</span>
                <span>👥 {course.enrollmentCount} enrolled</span>
                {course.rating > 0 && <span>⭐ {course.rating} rating</span>}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {course.skills?.map((skill: string) => (
                  <span key={skill} className="px-3 py-1 bg-white/20 text-white text-xs rounded-full">
                    {skill}
                  </span>
                ))}
              </div>

              {course.videoUrl && enrolled ? (
                <div className="bg-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-white mb-2">
                    <span className="text-sm font-medium">Your Progress</span>
                    <span className="text-sm font-bold">{Math.round(progressPercent)}%</span>
                  </div>

                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden mb-3">
                    <div
                      className={
                        'h-full rounded-full transition-all duration-300 ' +
                        (completed ? 'bg-green-400' : 'bg-white')
                      }
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-white/80">
                    <span>Watch Time: {watchTimeSeconds}s</span>
                    <span>Status: {completed ? 'Completed ✅' : 'In Progress'}</span>
                    {lastSaved && <span>Last Saved: {lastSaved}</span>}
                    {loadingProgress && <span>Loading progress...</span>}
                  </div>
                </div>
              ) : course.videoUrl ? (
                <div className="bg-white/10 rounded-2xl p-4 text-white/90">
                  <p className="font-medium mb-1">Enroll to start tracking progress.</p>
                  <p className="text-sm text-white/70">Progress is available only for enrolled users.</p>
                </div>
              ) : (
                <div className="bg-white/10 rounded-2xl p-4 text-white/90">
                  <p className="font-medium mb-1">Progress tracking will appear once a video is uploaded.</p>
                  <p className="text-sm text-white/70">This course currently has no video content.</p>
                </div>
              )}
            </div>

            <div className="text-center">
              <div className="text-8xl mb-4">{course.emoji || '📚'}</div>
              <div className="bg-white/10 rounded-2xl p-6">
                <div className="text-3xl font-bold text-white mb-1">
                  {course.isFree ? 'FREE' : '₹' + Number(course.price).toLocaleString()}
                </div>

                {!course.isFree && <p className="text-white/60 text-sm mb-4">One-time payment</p>}

                {message ? (
                  <div className="bg-green-500 text-white px-4 py-3 rounded-xl font-medium">
                    ✓ {message}
                  </div>
                ) : (
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling || enrolled}
                    className="w-full py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    {enrolling
                      ? 'Enrolling...'
                      : enrolled
                      ? '✓ Enrolled'
                      : course.isFree
                      ? 'Enroll Free'
                      : 'Enroll Now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {course.videoUrl && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Course Player</h2>
                  <span className="text-sm text-gray-500">
                    {enrolled ? `${Math.round(progressPercent)}% completed` : 'Enroll to watch'}
                  </span>
                </div>

                <div className="relative bg-black" style={{ paddingTop: '56.25%' }}>
                  {enrolled ? (
                    <video
                      ref={videoRef}
                      src={course.videoUrl}
                      controls
                      className="absolute inset-0 w-full h-full"
                      poster={course.thumbnail}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onPause={handleVideoPause}
                      onEnded={handleVideoEnded}
                    >
                      Your browser does not support video playback.
                    </video>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/90 px-6 text-center">
                      <div className="text-5xl mb-4">🔒</div>
                      <p className="text-lg font-semibold mb-2">Enroll to access this course</p>
                      <p className="text-white/70 text-sm">You need to enroll before watching course content.</p>
                    </div>
                  )}
                </div>

                {enrolled && (
                  <div className="p-4">
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div
                        className={'h-full rounded-full ' + (completed ? 'bg-green-500' : 'bg-blue-600')}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>{Math.round(progressPercent)}% completed</span>
                      <span>{watchTimeSeconds}s watched</span>
                      <span>{completed ? 'Course completed' : 'Complete 90% to finish course'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!course.videoUrl && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Course Video</h2>
                </div>
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center py-16">
                  <div className="text-6xl mb-4">{course.emoji || '📚'}</div>
                  <p className="text-gray-500 font-medium mb-2">Video content coming soon</p>
                  <p className="text-gray-400 text-sm">Enroll now to get notified when video is uploaded</p>
                </div>
              </div>
            )}

            {course.type === 'live' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h2 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Live Class Details
                </h2>

                {course.liveSchedule && (
                  <p className="text-red-700 mb-2">
                    📅 Scheduled: {new Date(course.liveSchedule).toLocaleString()}
                  </p>
                )}

                {course.liveLink && enrolled ? (
                  <a
                    href={course.liveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Join Live Class
                  </a>
                ) : (
                  <p className="text-red-600 text-sm">Enroll to get the live class link</p>
                )}
              </div>
            )}

            {course.curriculum && course.curriculum.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Course Curriculum</h2>
                </div>

                <div className="divide-y divide-gray-50">
                  {course.curriculum.map((item: any, i: number) => (
                    <div key={i} className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                        {item.duration && <p className="text-gray-400 text-xs">{item.duration}</p>}
                      </div>
                      <span className="ml-auto text-xs text-gray-400">{item.type || 'video'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!course.curriculum || course.curriculum.length === 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">What You Will Learn</h2>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {course.skills?.map((skill: string) => (
                      <div key={skill} className="flex items-center gap-2 text-gray-700 text-sm">
                        <span className="text-green-500 font-bold">✓</span>
                        {skill}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Course Details</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900 capitalize">{course.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium text-gray-900">{course.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-gray-900">{course.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Students</span>
                  <span className="font-medium text-gray-900">{course.enrollmentCount}</span>
                </div>
                {course.rating > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rating</span>
                    <span className="font-medium text-gray-900">⭐ {course.rating}/5</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Certificate</span>
                  <span className="font-medium text-green-600">✓ Yes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Enrollment</span>
                  <span className={'font-medium ' + (enrolled ? 'text-green-600' : 'text-orange-500')}>
                    {enrolled ? 'Enrolled' : 'Not Enrolled'}
                  </span>
                </div>

                {course.videoUrl && enrolled && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium text-blue-600">{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={'font-medium ' + (completed ? 'text-green-600' : 'text-orange-500')}>
                        {completed ? 'Completed' : 'In Progress'}
                      </span>
                    </div>

                    {completed && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Quiz</span>
                        <span
                          className={
                            'font-medium ' +
                            (quizResult?.passed
                              ? 'text-green-600'
                              : quizResult
                              ? 'text-orange-500'
                              : 'text-blue-600')
                          }
                        >
                          {quizResult?.passed ? 'Passed' : quizResult ? 'Attempted' : 'Unlocked'}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {!enrolled && !message && (
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {course.isFree ? 'FREE' : '₹' + Number(course.price).toLocaleString()}
                </div>
                <p className="text-gray-500 text-sm mb-4">Get lifetime access + certificate</p>
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
              </div>
            )}

            <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100 text-center">
              <div className="text-4xl mb-2">🏆</div>
              <h3 className="font-bold text-gray-900 mb-1">Get Certified</h3>
              <p className="text-gray-500 text-sm">
                Complete this course, pass the quiz, and earn an industry-recognized certificate
              </p>

              {!enrolled && (
                <div className="mt-4 px-4 py-2 bg-white text-gray-600 rounded-xl text-sm border border-yellow-200">
                  Enroll first to unlock progress tracking, quiz, and certificate
                </div>
              )}

              {enrolled && course.videoUrl && !completed && (
                <div className="mt-4 space-y-3">
                  <div className="px-4 py-2 bg-white text-orange-600 rounded-xl text-sm font-medium border border-yellow-200">
                    Complete at least 90% of the course to unlock the quiz
                  </div>
                </div>
              )}

              {enrolled && course.videoUrl && completed && (
                <div className="mt-4 space-y-3">
                  <div className="px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
                    ✓ Course completed successfully
                  </div>

                  {loadingQuizResult ? (
                    <div className="px-4 py-2 bg-white text-gray-500 rounded-xl text-sm border border-yellow-200">
                      Checking quiz status...
                    </div>
                  ) : quizResult?.passed ? (
                    <>
                      <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium">
                        ✓ Quiz passed ({quizResult.percentage}%)
                      </div>

                      <Link
                        href={'/training/' + course.id + '/certificate'}
                        className="block w-full py-3 bg-green-600 text-white font-semibold rounded-xl text-center hover:bg-green-700 transition-colors"
                      >
                        View Certificate
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-white text-gray-700 rounded-xl text-sm border border-yellow-200">
                        {quizResult
                          ? `Latest quiz score: ${quizResult.percentage}% — you need to pass to unlock certificate`
                          : 'Quiz is now unlocked. Take the quiz to get your certificate.'}
                      </div>

                      <Link
                        href={'/training/' + course.id + '/quiz'}
                        className="block w-full py-3 bg-blue-600 text-white font-semibold rounded-xl text-center hover:bg-blue-700 transition-colors"
                      >
                        {quizResult ? 'Retake Quiz' : 'Take Quiz'}
                      </Link>
                    </>
                  )}
                </div>
              )}

              {enrolled && !course.videoUrl && (
                <div className="mt-4 px-4 py-2 bg-white text-gray-600 rounded-xl text-sm border border-yellow-200">
                  Quiz will be available once video-based course completion is enabled
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}