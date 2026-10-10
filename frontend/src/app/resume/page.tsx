'use client'
import { tr, trError, useLocale, locale } from '@/lib/localization'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE = 'http://localhost:5000/api/v1'

export default function ResumeListPage() {
  useLocale()

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

  const handleCopyShareLink = async (resume: any) => {
    try {
      setError('')

      if (resume.visibility !== 'link') {
        throw new Error('This resume is not set to link sharing')
      }

      const shareUrl = `${window.location.origin}/resume/share/${resume.id}`
      await navigator.clipboard.writeText(shareUrl)
      window.alert('Share link copied to clipboard')
    } catch (err: any) {
      setError(err.message || 'Failed to copy share link')
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

  const formatLabel = (value?: string) => {
    if (!value) return 'Not set'

    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const getVisibilityBadgeClasses = (visibility?: string) => {
    if (visibility === 'link') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    }

    return 'bg-gray-100 text-gray-700 border border-gray-200'
  }

  const getStatusBadgeClasses = (status?: string) => {
    if (status === 'published') {
      return 'bg-green-50 text-green-700 border border-green-200'
    }

    if (status === 'completed') {
      return 'bg-blue-50 text-blue-700 border border-blue-200'
    }

    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">{tr("Loading resumes...")}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">{tr("← Back to Dashboard")}</Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">{tr("My Resumes")}</h1>
            <p className="text-gray-500">{tr("Create, edit, and manage your resumes")}</p>
          </div>

          <Link
            href="/resume/new"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-center"
          >{tr("+ Create New Resume")}</Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            {trError(error)}
          </div>
        )}

        {resumes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{tr("No resumes yet")}</h2>
            <p className="text-gray-500 mb-6">{tr("Create your first professional resume and start applying faster.")}</p>

            <Link
              href="/resume/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >{tr("Create First Resume")}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-lg font-bold text-gray-900 break-words">
                        {resume.title || 'Untitled Resume'}
                      </h2>

                      {resume.isDefault ? (
                        <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold">{tr("Default")}</span>
                      ) : null}
                    </div>

                    <p className="text-sm text-gray-500 capitalize">{tr("Template: ")}{resume.template || 'classic'}
                    </p>
                  </div>

                  <span
                    className={
                      'px-2.5 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap ' +
                      getStatusBadgeClasses(resume.status)
                    }
                  >
                    {resume.status || 'draft'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">{tr("Sector: ")}{tr(formatLabel(resume.sector || 'general'))}
                  </span>

                  <span
                    className={
                      'px-2.5 py-1 rounded-full text-xs font-medium ' +
                      getVisibilityBadgeClasses(resume.visibility)
                    }
                  >{tr("Visibility: ")}{tr(resume.visibility === 'link' ? 'Link' : 'Private')}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-5">
                  <p>{tr("Name: ")}{resume.personalInfo?.fullName || 'Not added'}</p>
                  <p>{tr("Role: ")}{resume.personalInfo?.jobTitle || 'Not added'}</p>
                  <p>{tr("Updated:")}{tr(' ')}
                    {tr(resume.updatedAt
                      ? new Date(resume.updatedAt).toLocaleDateString(locale())
                      : 'Not available')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={'/resume/' + resume.id}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
                  >{tr("Edit")}</Link>

                  {resume.visibility === 'link' ? (
                    <button
                      onClick={() => handleCopyShareLink(resume)}
                      className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl hover:bg-emerald-100"
                    >{tr("Copy Link")}</button>
                  ) : null}

                  <button
                    onClick={() => handleDelete(resume.id)}
                    disabled={deletingId === resume.id}
                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-50"
                  >
                    {tr(deletingId === resume.id ? 'Deleting...' : 'Delete')}
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