'use client'
import { tr, trError, useLocale } from '@/lib/localization'


import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { loginDestination } from '@/lib/trainingApi'
import { useSearchParams } from 'next/navigation'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')

type VerifyResponse = {
  success: boolean
  message?: string
  token?: string
  user?: {
    id: string
    email: string
    role: 'admin' | 'employer' | 'candidate' | 'trainer' | 'super_admin'
  }
}

const saveAuth = (token: string, user?: VerifyResponse['user']) => {
  if (!token || !user) return
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

const redirectByRole = (user?: VerifyResponse['user']) => {
  window.location.href = loginDestination(user?.role || 'candidate')
}

function VerifyOtpPageContent() {
  useLocale()

  const searchParams = useSearchParams()

  const userId = useMemo(() => searchParams.get('userId') || '', [searchParams])
  const email = useMemo(() => searchParams.get('email') || '', [searchParams])

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!userId) {
      setError('Missing user ID. Please register or login again.')
      return
    }

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP.')
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          otp: otp.trim()
        })
      })

      const data: VerifyResponse = await res.json()

      if (data.success) {
        setSuccess(data.message || 'Email verified successfully!')

        if (data.token && data.user) {
          saveAuth(data.token, data.user)
          setTimeout(() => {
            redirectByRole(data.user)
          }, 800)
        } else {
          setTimeout(() => {
            window.location.href = '/login'
          }, 1200)
        }
      } else {
        setError(data.message || 'OTP verification failed')
      }
    } catch (err) {
      setError('Something went wrong while verifying OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setSuccess('')

    if (!userId && !email) {
      setError('Missing account information to resend OTP.')
      return
    }

    try {
      setResendLoading(true)

      const res = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || undefined,
          email: email || undefined
        })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(data.message || 'OTP resent successfully!')
      } else {
        setError(data.message || 'Failed to resend OTP')
      }
    } catch (err) {
      setError('Something went wrong while resending OTP.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 pt-16'>
      <div className='w-full max-w-md'>
        <div className='bg-white rounded-2xl shadow-xl p-8'>
          <div className='flex items-center justify-center gap-2 mb-8'>
            <div className='w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg' />
            <span className='text-xl font-bold text-gray-900'>{tr("InstaHire")}</span>
          </div>

          <h1 className='text-2xl font-bold text-gray-900 text-center mb-2'>{tr("Verify your account")}</h1>

          <p className='text-gray-500 text-center mb-8 text-sm'>{tr("Enter the 6-digit OTP sent to")}{tr(' ')}
            <span className='font-medium text-gray-700 break-all'>
              {tr(email || 'your email')}
            </span>
          </p>

          {error && (
            <div className='bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm'>
              {trError(error)}
            </div>
          )}

          {success && (
            <div className='bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm'>
              {tr(success)}
            </div>
          )}

          <form onSubmit={handleVerify} className='space-y-5'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("OTP Code")}</label>
              <input
                type='text'
                inputMode='numeric'
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder={tr("Enter 6-digit OTP")}
                required
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center tracking-[0.4em] text-lg'
              />
            </div>

            <button
              type='submit'
              disabled={loading}
              className='w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50'
            >
              {tr(loading ? 'Verifying...' : 'Verify OTP')}
            </button>
          </form>

          <div className='mt-4'>
            <button
              type='button'
              onClick={handleResend}
              disabled={resendLoading}
              className='w-full py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50'
            >
              {tr(resendLoading ? 'Resending...' : 'Resend OTP')}
            </button>
          </div>

          <p className='text-center text-gray-500 text-sm mt-6'>{tr("Back to")}{tr(' ')}
            <Link href='/login' className='text-blue-600 font-medium hover:underline'>{tr("Login")}</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function VerifyOtpPage() {
  useLocale()

  return <Suspense fallback={<main className="pt-24 text-center">{tr("Loading...")}</main>}><VerifyOtpPageContent /></Suspense>
}
