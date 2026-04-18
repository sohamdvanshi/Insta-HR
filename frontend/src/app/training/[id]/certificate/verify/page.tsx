'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function VerifyCertificatePage() {
  const searchParams = useSearchParams()
  const [certificateId, setCertificateId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const prefillId = searchParams.get('certificateId')
    if (prefillId) {
      setCertificateId(prefillId.toUpperCase())
    }
  }, [searchParams])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const cleanedId = certificateId.trim().toUpperCase()

      const res = await fetch(
        'http://localhost:5000/api/v1/training/certificate/verify/' + encodeURIComponent(cleanedId)
      )

      const data = await res.json()

      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.message || 'Certificate not found')
      }
    } catch {
      setError('Failed to verify certificate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Link href="/training" className="text-white/70 hover:text-white text-sm mb-4 inline-block">
            ← Back to Training
          </Link>
          <h1 className="text-4xl font-bold text-white mb-3">Certificate Verification</h1>
          <p className="text-emerald-100 text-lg">
            Verify the authenticity of an InstaHire course completion certificate
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
          <form onSubmit={handleVerify}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Enter Certificate ID
            </label>

            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={certificateId}
                onChange={(e) => setCertificateId(e.target.value.toUpperCase())}
                placeholder="Example: CERT-1234ABCD-5678EFGH"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500"
              />

              <button
                type="submit"
                disabled={loading || !certificateId.trim()}
                className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>

          <p className="text-xs text-gray-400 mt-3">
            Enter the exact certificate ID shown on the certificate.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">❌</div>
            <h2 className="text-xl font-bold mb-2">Verification failed</h2>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 p-6 text-center">
              <div className="text-5xl mb-3">✅</div>
              <h2 className="text-2xl font-bold text-green-700 mb-1">Certificate Verified</h2>
              <p className="text-green-600">This certificate is valid and was issued by InstaHire.</p>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Certificate ID</p>
                  <p className="font-semibold text-gray-900 break-all">{result.certificateId}</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Learner Name</p>
                  <p className="font-semibold text-gray-900">{result.learnerName}</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Course Title</p>
                  <p className="font-semibold text-gray-900">{result.courseTitle}</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Category</p>
                  <p className="font-semibold text-gray-900">{result.category || 'General'}</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Completion Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(result.completionDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Issued By</p>
                  <p className="font-semibold text-gray-900">{result.issuedBy}</p>
                </div>
              </div>

              {result.skills?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Skills Covered</p>
                  <div className="flex flex-wrap gap-2">
                    {result.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}