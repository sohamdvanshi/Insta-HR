'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE = 'http://localhost:5000/api/v1'

export default function CourseCertificatePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<any>(null)
  const [certificate, setCertificate] = useState<any>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.replace('/login')
      return
    }

    if (!courseId) return

    fetchCertificateData()
  }, [courseId, router])

  const fetchCertificateData = async () => {
    try {
      setLoading(true)
      setError('')

      const token = localStorage.getItem('token')

      const [courseRes, certRes] = await Promise.all([
        fetch(API_BASE + '/training/' + courseId, {
          headers: {
            Authorization: 'Bearer ' + token
          }
        }),
        fetch(API_BASE + '/training/' + courseId + '/certificate', {
          headers: {
            Authorization: 'Bearer ' + token
          }
        })
      ])

      const courseData = await courseRes.json()
      const certData = await certRes.json()

      if (courseRes.ok && courseData.success) {
        setCourse(courseData.data)
      }

      if (certRes.ok && certData.success) {
        setCertificate(certData.data)
      } else {
        setError(
          certData.message ||
            'Certificate is available only after course completion and quiz passing'
        )
      }
    } catch {
      setError('Failed to load certificate')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true)

      const token = localStorage.getItem('token')

      const res = await fetch(API_BASE + '/training/' + courseId + '/certificate/pdf', {
        headers: {
          Authorization: 'Bearer ' + token
        }
      })

      if (!res.ok) {
        let message = 'Failed to download certificate'
        try {
          const data = await res.json()
          message = data.message || message
        } catch {
        }
        throw new Error(message)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${course?.title || 'course'}_certificate.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to download certificate')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Loading certificate...</p>
      </main>
    )
  }

  if (error && !certificate) {
    return (
      <main className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Certificate Not Available Yet
            </h1>
            <p className="text-gray-500 mb-6">
              {error}
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={'/training/' + courseId}
                className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Back to Course
              </Link>

              <Link
                href={'/training/' + courseId + '/quiz'}
                className="px-5 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Go to Quiz
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-6">
          <Link
            href={'/training/' + courseId}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Course
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-8 py-10 text-center">
            <div className="text-6xl mb-4">🏅</div>
            <h1 className="text-3xl font-bold text-white">
              Certificate of Completion
            </h1>
            <p className="text-white/80 mt-2">
              Congratulations on successfully completing your training and quiz
            </p>
          </div>

          <div className="p-8 md:p-12">
            <div className="border-2 border-dashed border-green-200 rounded-3xl p-8 md:p-12 text-center bg-gradient-to-br from-green-50 to-white">
              <p className="text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
                This certificate is proudly presented to
              </p>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {certificate?.learnerName}
              </h2>

              <p className="text-gray-600 text-lg mb-2">
                for successfully completing the course
              </p>

              <h3 className="text-2xl md:text-3xl font-bold text-green-700 mb-6">
                {certificate?.courseTitle}
              </h3>

              <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 text-left mt-8">
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    Certificate ID
                  </p>
                  <p className="text-sm font-semibold text-gray-900 break-all">
                    {certificate?.certificateId}
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    Completion Date
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {certificate?.completionDate
                      ? new Date(certificate.completionDate).toLocaleDateString()
                      : '-'}
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    Category
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {certificate?.category || '-'}
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                    Issued By
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {certificate?.issuedBy}
                  </p>
                </div>
              </div>

              {certificate?.skills?.length > 0 && (
                <div className="mt-8">
                  <p className="text-sm font-medium text-gray-500 mb-3">
                    Skills Covered
                  </p>

                  <div className="flex flex-wrap justify-center gap-2">
                    {certificate.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {downloading ? 'Downloading PDF...' : 'Download Certificate PDF'}
              </button>

              <Link
                href={'/training/' + courseId}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Back to Course
              </Link>
            </div>

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}