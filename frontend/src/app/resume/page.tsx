'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE = 'http://localhost:5000/api/v1'

export default function ResumeListPage() {
  const router = useRouter()
  const [resumes, setResumes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.replace('/login')
      return
    }

    fetchResumes()
  }, [router])

  const fetchResumes = async () => {
    try {
      setLoading(true)
      setError('')

      const token = localStorage.getItem('token')
      const res = await fetch(API_BASE + '/resumes', {
        headers: {
          Authorization: 'Bearer ' + token
        }
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load resumes')
      }

      setResumes(data.data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load resumes')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this resume?')
    if (!confirmed) return

    try {
      setDeletingId(id)
      setError('')

      const token = localStorage.getItem('token')
      const res = await fetch(API_BASE + '/resumes/' + id, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + token
        }
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete resume')
      }

      setResumes((prev) => prev.filter((resume) => resume.id !== id))
    } catch (err: any) {
      setError(err.message || 'Failed to delete resume')
    } finally {
      setDeletingId('')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading resumes...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">My Resumes</h1>
            <p className="text-gray-500">Create, edit, and manage your resumes</p>
          </div>

          <Link
            href="/resume/new"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-center"
          >
            + Create New Resume
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {resumes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No resumes yet</h2>
            <p className="text-gray-500 mb-6">
              Create your first professional resume and start applying faster.
            </p>

            <Link
              href="/resume/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Create First Resume
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {resume.title || 'Untitled Resume'}
                    </h2>
                    <p className="text-sm text-gray-500 capitalize">
                      Template: {resume.template || 'classic'}
                    </p>
                  </div>

                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs capitalize">
                    {resume.status || 'draft'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-5">
                  <p>
                    Name: {resume.personalInfo?.fullName || 'Not added'}
                  </p>
                  <p>
                    Role: {resume.personalInfo?.jobTitle || 'Not added'}
                  </p>
                  <p>
                    Updated: {new Date(resume.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={'/resume/' + resume.id}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
                  >
                    Edit
                  </Link>

                  <button
                    onClick={() => handleDelete(resume.id)}
                    disabled={deletingId === resume.id}
                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingId === resume.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}