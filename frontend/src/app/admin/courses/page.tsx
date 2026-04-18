'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = ['IT', 'Finance', 'Banking', 'Healthcare', 'HR', 'Marketing', 'Civil', 'Soft Skills', 'Others']
const EMOJIS = ['💻', '📊', '💰', '🏦', '🏥', '👥', '📱', '🏗️', '🗣️', '📈', '🔴', '📚', '🎯', '⚙️', '🔧']

export default function AdminCoursesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCourse, setEditCourse] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [selectedVideoName, setSelectedVideoName] = useState('')
  const [selectedThumbnailName, setSelectedThumbnailName] = useState('')

  const videoRef = useRef<HTMLInputElement>(null)
  const thumbnailRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'IT',
    type: 'video',
    price: '',
    isFree: false,
    duration: '',
    emoji: '📚',
    skills: '',
    liveLink: '',
    liveSchedule: '',
  })

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) {
      router.replace('/login')
      return
    }

    const parsed = JSON.parse(user)
    if (parsed.role !== 'admin') {
      router.replace('/dashboard')
      return
    }

    fetchCourses()
  }, [router])

  const fetchCourses = async () => {
    const token = localStorage.getItem('token')

    try {
      const res = await fetch('http://localhost:5000/api/v1/training', {
        headers: { Authorization: 'Bearer ' + token }
      })

      const data = await res.json()
      if (data.success) {
        setCourses(data.data || [])
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      category: 'IT',
      type: 'video',
      price: '',
      isFree: false,
      duration: '',
      emoji: '📚',
      skills: '',
      liveLink: '',
      liveSchedule: '',
    })

    setEditCourse(null)
    setError('')
    setUploadProgress('')
    setSelectedVideoName('')
    setSelectedThumbnailName('')

    if (videoRef.current) videoRef.current.value = ''
    if (thumbnailRef.current) thumbnailRef.current.value = ''
  }

  const handleEdit = (course: any) => {
    setEditCourse(course)
    setError('')
    setMessage('')

    setForm({
      title: course.title || '',
      description: course.description || '',
      category: course.category || 'IT',
      type: course.type || 'video',
      price: course.price ? String(course.price) : '',
      isFree: !!course.isFree,
      duration: course.duration || '',
      emoji: course.emoji || '📚',
      skills: course.skills?.join(', ') || '',
      liveLink: course.liveLink || '',
      liveSchedule: course.liveSchedule ? course.liveSchedule.slice(0, 16) : '',
    })

    setSelectedVideoName('')
    setSelectedThumbnailName('')
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  const validateForm = () => {
    if (!form.title.trim() || !form.description.trim() || !form.duration.trim()) {
      return 'Title, description and duration are required'
    }

    if (!form.isFree && (!form.price || Number(form.price) < 0)) {
      return 'Please enter a valid price or mark the course as free'
    }

    if (form.type === 'live') {
      if (!form.liveLink.trim()) {
        return 'Live class link is required for live courses'
      }
      if (!form.liveSchedule.trim()) {
        return 'Schedule date and time are required for live courses'
      }
    }

    if (form.type === 'video' && !editCourse && !videoRef.current?.files?.[0]) {
      return 'Please upload a video file for a new video course'
    }

    const videoFile = videoRef.current?.files?.[0]
    if (videoFile) {
      const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
      if (!validVideoTypes.includes(videoFile.type)) {
        return 'Video must be MP4, MOV, or AVI'
      }

      const maxVideoSize = 500 * 1024 * 1024
      if (videoFile.size > maxVideoSize) {
        return 'Video size must be less than 500MB'
      }
    }

    const thumbnailFile = thumbnailRef.current?.files?.[0]
    if (thumbnailFile) {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!validImageTypes.includes(thumbnailFile.type)) {
        return 'Thumbnail must be JPG, PNG, or WEBP'
      }

      const maxThumbSize = 10 * 1024 * 1024
      if (thumbnailFile.size > maxThumbSize) {
        return 'Thumbnail size must be less than 10MB'
      }
    }

    return ''
  }

  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setMessage('')
    setUploading(true)
    setUploadProgress('Preparing upload...')

    const token = localStorage.getItem('token')
    const formData = new FormData()

    formData.append('title', form.title.trim())
    formData.append('description', form.description.trim())
    formData.append('category', form.category)
    formData.append('type', form.type)
    formData.append('price', form.isFree ? '0' : String(form.price || 0))
    formData.append('isFree', String(form.isFree))
    formData.append('duration', form.duration.trim())
    formData.append('emoji', form.emoji)
    formData.append('skills', form.skills)
    formData.append('status', 'active')

    if (form.liveLink) formData.append('liveLink', form.liveLink.trim())
    if (form.liveSchedule) formData.append('liveSchedule', form.liveSchedule)

    if (videoRef.current?.files?.[0]) {
      setUploadProgress('Uploading video to Cloudinary... this may take a minute')
      formData.append('video', videoRef.current.files[0])
    }

    if (thumbnailRef.current?.files?.[0]) {
      formData.append('thumbnail', thumbnailRef.current.files[0])
    }

    try {
      const url = editCourse
        ? 'http://localhost:5000/api/v1/training/' + editCourse.id
        : 'http://localhost:5000/api/v1/training'

      const method = editCourse ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: 'Bearer ' + token
        },
        body: formData
      })

      const data = await res.json()

      if (data.success) {
        setMessage(editCourse ? 'Course updated successfully!' : 'Course created successfully!')
        setShowForm(false)
        resetForm()
        fetchCourses()
        setTimeout(() => setMessage(''), 4000)
      } else {
        setError(data.message || 'Something went wrong')
      }
    } catch (err) {
      setError('Failed to save course')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleDelete = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return

    const token = localStorage.getItem('token')

    try {
      const res = await fetch('http://localhost:5000/api/v1/training/' + courseId, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      })

      const data = await res.json()

      if (data.success) {
        setCourses(courses.filter(c => c.id !== courseId))
        setMessage('Course deleted!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setError(data.message || 'Failed to delete course')
      }
    } catch (err) {
      setError('Failed to delete course')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
                ← Admin Panel
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
            <p className="text-gray-500">Create and manage training courses</p>
          </div>

          <button
            onClick={() => {
              resetForm()
              setShowForm(!showForm)
            }}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            {showForm ? '✕ Cancel' : '+ New Course'}
          </button>
        </div>

        {message && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editCourse ? 'Edit Course' : 'Create New Course'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Full Stack Web Development"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what students will learn..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                <select
                  value={form.type}
                  onChange={e =>
                    setForm({
                      ...form,
                      type: e.target.value,
                      liveLink: e.target.value === 'live' ? form.liveLink : '',
                      liveSchedule: e.target.value === 'live' ? form.liveSchedule : '',
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                >
                  <option value="video">Video Course</option>
                  <option value="live">Live Class</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration *</label>
                <input
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g. 10 min, 2 hours, 8 weeks"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, emoji: e })}
                      className={
                        'w-10 h-10 text-xl rounded-lg border-2 transition-colors ' +
                        (form.emoji === e
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-400')
                      }
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Skills (comma separated)
                </label>
                <input
                  value={form.skills}
                  onChange={e => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g. React, Node.js, PostgreSQL"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pricing</label>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isFree}
                      onChange={e => setForm({ ...form, isFree: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Free Course</span>
                  </label>
                </div>

                {!form.isFree && (
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="Price in ₹"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {form.type === 'video' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Video {editCourse ? '(optional on edit)' : '*'} (MP4, MOV, AVI — max 500MB)
                  </label>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                    <div className="text-4xl mb-2">🎥</div>
                    <p className="text-gray-500 text-sm mb-3">Choose a small MP4 for quick testing</p>

                    <input
                      ref={videoRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        setSelectedVideoName(file ? file.name : '')
                      }}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />

                    {selectedVideoName && (
                      <p className="text-blue-600 text-xs mt-2">Selected video: {selectedVideoName}</p>
                    )}

                    {editCourse?.videoUrl && (
                      <p className="text-green-600 text-xs mt-2">
                        ✓ Video already uploaded. Select a new file only if you want to replace it.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.type === 'live' && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Live Class Link (Google Meet / Zoom) *
                    </label>
                    <input
                      value={form.liveLink}
                      onChange={e => setForm({ ...form, liveLink: e.target.value })}
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      Students will see this link after enrolling
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={form.liveSchedule}
                      onChange={e => setForm({ ...form, liveSchedule: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thumbnail Image (optional — JPG, PNG, WEBP)
                </label>
                <input
                  ref={thumbnailRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    setSelectedThumbnailName(file ? file.name : '')
                  }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />

                {selectedThumbnailName && (
                  <p className="text-purple-600 text-xs mt-2">Selected thumbnail: {selectedThumbnailName}</p>
                )}
              </div>
            </div>

            {uploading && (
              <div className="mt-4 bg-blue-50 text-blue-700 px-4 py-3 rounded-xl flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                {uploadProgress}
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : editCourse ? 'Update Course' : 'Create Course'}
              </button>

              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="px-8 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">All Courses ({courses.length})</h2>

            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                {courses.filter(c => c.type === 'video').length} video
              </span>
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                {courses.filter(c => c.type === 'live').length} live
              </span>
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="mb-3">No courses yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm"
              >
                Create First Course
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {courses.map(course => (
                <div key={course.id} className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={
                        'w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ' +
                        (course.type === 'live' ? 'bg-red-100' : 'bg-blue-100')
                      }
                    >
                      {course.emoji || '📚'}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{course.title}</p>

                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs text-gray-500">{course.category}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{course.duration}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{course.enrollmentCount} enrolled</span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <span
                          className={
                            'text-xs px-2 py-0.5 rounded-full ' +
                            (course.type === 'live'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700')
                          }
                        >
                          {course.type}
                        </span>

                        {course.isFree ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            FREE
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            ₹{Number(course.price).toLocaleString()}
                          </span>
                        )}

                        {course.videoUrl && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            ✓ Video
                          </span>
                        )}

                        {course.liveLink && (
                          <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                            ✓ Live Link
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <a
                      href={'/training/' + course.id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg hover:bg-gray-100"
                    >
                      Preview
                    </a>

                    <Link
                      href={'/admin/courses/' + course.id + '/quiz'}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs rounded-lg hover:bg-purple-100"
                    >
                      Manage Quiz
                    </Link>

                    <button
                      onClick={() => handleEdit(course)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-lg hover:bg-blue-100"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(course.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}