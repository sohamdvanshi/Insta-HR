'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DEMO_COURSES = [
  {
    id: '1',
    title: 'Full Stack Web Development',
    description: 'Master React, Node.js, PostgreSQL and build real-world projects from scratch.',
    category: 'IT', duration: '12 weeks', enrollmentCount: 1240, rating: 4.8,
    isFree: false, price: 4999, skills: ['React', 'Node.js', 'PostgreSQL'], type: 'video', emoji: '💻'
  },
  {
    id: '2',
    title: 'Data Science with Python',
    description: 'Learn data analysis, machine learning and visualization using Python and real datasets.',
    category: 'IT', duration: '10 weeks', enrollmentCount: 980, rating: 4.7,
    isFree: false, price: 3999, skills: ['Python', 'Pandas', 'ML'], type: 'video', emoji: '📊'
  },
  {
    id: '3',
    title: 'Finance & Accounting Fundamentals',
    description: 'Understand financial statements, budgeting, and accounting principles for business.',
    category: 'Finance', duration: '6 weeks', enrollmentCount: 560, rating: 4.6,
    isFree: true, price: 0, skills: ['Accounting', 'Tally', 'GST'], type: 'video', emoji: '💰'
  },
  {
    id: '4',
    title: 'Live: Advanced React & Next.js',
    description: 'Live interactive sessions with industry experts. Build production-grade apps with Next.js 14.',
    category: 'IT', duration: '8 weeks', enrollmentCount: 320, rating: 4.9,
    isFree: false, price: 6999, skills: ['React', 'Next.js', 'TypeScript'], type: 'live', emoji: '🔴'
  },
  {
    id: '5',
    title: 'HR Management & Recruitment',
    description: 'Learn modern HR practices, talent acquisition, performance management and labor laws.',
    category: 'HR', duration: '4 weeks', enrollmentCount: 430, rating: 4.5,
    isFree: false, price: 2999, skills: ['HR', 'Recruitment', 'Labor Law'], type: 'video', emoji: '👥'
  },
  {
    id: '6',
    title: 'Live: Digital Marketing Masterclass',
    description: 'Live sessions covering SEO, social media marketing, paid ads and content strategy.',
    category: 'Marketing', duration: '6 weeks', enrollmentCount: 750, rating: 4.7,
    isFree: false, price: 3499, skills: ['SEO', 'Social Media', 'Google Ads'], type: 'live', emoji: '📱'
  },
  {
    id: '7',
    title: 'AutoCAD & Civil Engineering Design',
    description: 'Master AutoCAD, structural design principles and construction project management.',
    category: 'Civil', duration: '8 weeks', enrollmentCount: 290, rating: 4.6,
    isFree: false, price: 3999, skills: ['AutoCAD', 'Structural Design', 'BIM'], type: 'video', emoji: '🏗️'
  },
  {
    id: '8',
    title: 'Spoken English & Communication',
    description: 'Improve your English communication skills, interview confidence and professional writing.',
    category: 'Soft Skills', duration: '4 weeks', enrollmentCount: 1850, rating: 4.8,
    isFree: true, price: 0, skills: ['English', 'Communication', 'Interview'], type: 'video', emoji: '🗣️'
  },
  {
    id: '9',
    title: 'Live: Stock Market & Trading',
    description: 'Live sessions on fundamental analysis, technical analysis and building a portfolio.',
    category: 'Finance', duration: '5 weeks', enrollmentCount: 610, rating: 4.7,
    isFree: false, price: 4499, skills: ['Trading', 'Technical Analysis', 'Portfolio'], type: 'live', emoji: '📈'
  },
]

const CATEGORIES = ['All', 'IT', 'Finance', 'HR', 'Marketing', 'Civil', 'Soft Skills']

export default function TrainingPage() {
  const router = useRouter()
  const [courses, setCourses] = useState(DEMO_COURSES)
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeType, setActiveType] = useState('all')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('http://localhost:5000/api/v1/training')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.length > 0) setCourses(data.data)
      })
      .catch(() => {})
  }, [])

  const filtered = courses.filter((c: any) => {
    const catMatch = activeCategory === 'All' || c.category === activeCategory
    const typeMatch = activeType === 'all' || c.type === activeType
    return catMatch && typeMatch
  })

  const stats = [
    { value: '50+', label: 'Courses' },
    { value: '10,000+', label: 'Students' },
    { value: '95%', label: 'Placement Rate' },
    { value: '100+', label: 'Certifications' },
  ]

  return (
    <main className="min-h-screen bg-gray-50 pt-16">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-white mb-3">Training & Certification</h1>
          <p className="text-blue-100 text-lg mb-10">Learn new skills, get certified and boost your career</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map(({ value, label }) => (
              <div key={label} className="bg-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">{value}</div>
                <div className="text-blue-200 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {message && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium border border-green-200">
            ✓ {message}
          </div>
        )}

        {/* Course Types */}
        <div className="flex gap-4 mb-6">
          {[
            { id: 'all', label: 'All Courses', emoji: '📚' },
            { id: 'video', label: 'Video Courses', emoji: '🎥' },
            { id: 'live', label: 'Live Classes', emoji: '🔴' },
          ].map(({ id, label, emoji }) => (
            <button key={id} onClick={() => setActiveType(id)}
              className={"flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors " + (activeType === id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-500 hover:text-blue-600')}>
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={"px-4 py-2 rounded-xl text-sm font-medium transition-colors " + (activeCategory === cat ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-500 hover:text-purple-600')}>
              {cat}
            </button>
          ))}
        </div>

        <p className="text-gray-500 text-sm mb-6">{filtered.length} courses found</p>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {filtered.map((course: any) => (
            <div
              key={course.id}
              onClick={() => router.push('/training/' + course.id)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1"
            >
              {/* Thumbnail */}
              <div className={"h-40 flex items-center justify-center relative " + (course.type === 'live' ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-purple-600')}>
                <span className="text-6xl">{course.emoji}</span>
                {course.type === 'live' && (
                  <span className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    LIVE
                  </span>
                )}
                {course.thumbnail && (
                  <img src={course.thumbnail} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">{course.category}</span>
                  {course.isFree ? (
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full">FREE</span>
                  ) : (
                    <span className="text-gray-900 font-bold text-sm">₹{Number(course.price).toLocaleString()}</span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">{course.title}</h3>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">{course.description}</p>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span>⏱ {course.duration}</span>
                  <span>👥 {course.enrollmentCount} enrolled</span>
                  {course.rating > 0 && <span>⭐ {course.rating}</span>}
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {course.skills?.slice(0, 3).map((skill: string) => (
                    <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{skill}</span>
                  ))}
                </div>

                <div className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-xl text-center text-sm">
                  View Course
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Certification Banner */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl p-10 text-center text-white">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold mb-3">Earn Industry Certifications</h2>
          <p className="text-yellow-100 mb-6 max-w-xl mx-auto">
            Complete any course and earn a verified certificate that employers recognize.
            Add it to your InstaHire profile and LinkedIn instantly.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="px-6 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors">
              Get Certified Today
            </Link>
            <Link href="/jobs" className="px-6 py-3 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-colors">
              Find Jobs
            </Link>
          </div>
        </div>

      </div>
    </main>
  )
}
