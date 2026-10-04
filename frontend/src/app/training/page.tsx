'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TRAINING_API } from '@/lib/trainingApi'

type Course = { id: string; title: string; description: string; category: string; duration: string; emoji: string; isFree: boolean; price: number }
export default function TrainingPage() {
  const [trainer, setTrainer] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('All')
  useEffect(() => {
    setTrainer(JSON.parse(localStorage.getItem('user') || '{}').role === 'trainer')
    let cancelled = false
    fetch(TRAINING_API).then(async response => {
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load courses')
      if (!cancelled) setCourses(data.data)
    }).catch(err => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  const categories = ['All', ...new Set(courses.map(item => item.category).filter(Boolean))]
  return <main className="min-h-screen bg-gray-50 px-6 py-24"><div className="mx-auto max-w-6xl">
    <h1 className="text-3xl font-bold">Training and courses</h1>
    <p className="my-3 text-gray-600">Browse courses. Log in with your candidate account to enroll, learn, and join scheduled classes.</p>
    <nav className="my-5 flex flex-wrap gap-5">{trainer ? <Link className="text-blue-700 underline" href="/trainer">Training workspace</Link> : <><Link className="text-blue-700 underline" href="/training/my-learning">My learning</Link><Link className="text-blue-700 underline" href="/training/classes">My classes</Link></>}</nav>
    <label htmlFor="training-category">Category</label><select id="training-category" className="ml-3 rounded-lg border bg-white p-2" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select>
    {error && <p role="alert" className="my-5 text-red-700">{error}</p>}
    {loading ? <p className="my-6">Loading courses...</p> : <div className="my-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{courses.filter(item => category === 'All' || item.category === category).map(course => <article key={course.id} className="rounded-2xl border bg-white p-6"><div className="text-4xl">{course.emoji || '📚'}</div><h2 className="my-3 text-xl font-semibold">{course.title}</h2><p className="line-clamp-3 text-gray-600">{course.description}</p><p className="my-3 text-sm">{course.category} · {course.duration || 'Flexible duration'}</p><p className="font-medium">{course.isFree ? 'Free' : `₹${Number(course.price).toLocaleString()} · Contact training team to enroll`}</p><Link className="mt-4 inline-block font-semibold text-blue-700" href={`/training/${course.id}`}>View course →</Link></article>)}</div>}
    {!loading && !error && !courses.length && <p className="my-6 text-gray-500">No courses available yet.</p>}
  </div></main>
}
