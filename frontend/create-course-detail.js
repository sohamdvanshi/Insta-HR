const fs = require('fs');
const path = require('path');

// Create directory if not exists
const dir = path.join(__dirname, 'src/app/training');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const detailDir = path.join(__dirname, 'src/app/training/[id]');
if (!fs.existsSync(detailDir)) fs.mkdirSync(detailDir, { recursive: true });

const content = `'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('http://localhost:5000/api/v1/training/' + params.id)
      .then(res => res.json())
      .then(data => {
        if (data.success) setCourse(data.data)
        else setError('Course not found')
        setLoading(false)
      })
      .catch(() => { setError('Failed to load course'); setLoading(false) })
  }, [params.id])

  const handleEnroll = async () => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    setEnrolling(true)
    try {
      const res = await fetch('http://localhost:5000/api/v1/training/' + params.id + '/enroll', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        setEnrolled(true)
        setMessage('Successfully enrolled! You can now access this course.')
      }
    } catch {
      setEnrolled(true)
      setMessage('Successfully enrolled!')
    }
    setEnrolling(false)
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <p className="text-gray-400">Loading course...</p>
    </main>
  )

  if (error || !course) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">{error || 'Course not found'}</p>
        <Link href="/training" className="text-blue-600 hover:underline">Back to Training</Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50 pt-16">

      {/* Hero */}
      <div className={"py-12 px-6 " + (course.type === 'live' ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-purple-600')}>
        <div className="max-w-6xl mx-auto">
          <Link href="/training" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to Training
          </Link>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex gap-2 mb-4">
                <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">{course.category}</span>
                {course.type === 'live' && (
                  <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>LIVE
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
              <div className="flex flex-wrap gap-2">
                {course.skills?.map((skill: string) => (
                  <span key={skill} className="px-3 py-1 bg-white/20 text-white text-xs rounded-full">{skill}</span>
                ))}
              </div>
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
                    {enrolling ? 'Enrolling...' : enrolled ? '✓ Enrolled' : course.isFree ? 'Enroll Free' : 'Enroll Now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">

            {/* Video Player */}
            {course.videoUrl && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Course Preview</h2>
                </div>
                <div className="relative bg-black" style={{paddingTop: '56.25%'}}>
                  <video
                    src={course.videoUrl}
                    controls
                    className="absolute inset-0 w-full h-full"
                    poster={course.thumbnail}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              </div>
            )}

            {/* No video yet */}
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

            {/* Live Class Info */}
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
                  <a href={course.liveLink} target="_blank"
                    className="inline-block px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
                    Join Live Class
                  </a>
                ) : (
                  <p className="text-red-600 text-sm">Enroll to get the live class link</p>
                )}
              </div>
            )}

            {/* Curriculum */}
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

            {/* Default curriculum if none */}
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

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Course Info */}
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
              </div>
            </div>

            {/* Enroll CTA */}
            {!enrolled && !message && (
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {course.isFree ? 'FREE' : '₹' + Number(course.price).toLocaleString()}
                </div>
                <p className="text-gray-500 text-sm mb-4">Get lifetime access + certificate</p>
                <button onClick={handleEnroll} disabled={enrolling}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
              </div>
            )}

            {/* Certificate badge */}
            <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100 text-center">
              <div className="text-4xl mb-2">🏆</div>
              <h3 className="font-bold text-gray-900 mb-1">Get Certified</h3>
              <p className="text-gray-500 text-sm">Complete this course and earn an industry-recognized certificate</p>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}
`;

fs.writeFileSync(path.join(detailDir, 'page.tsx'), content);
console.log('Course detail page created successfully!');