'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'

const API_BASE = 'http://localhost:5000/api/v1'

type User = {
  id: string
  email: string
  role: 'admin' | 'employer' | 'candidate'
}

type LoginResponse = {
  success: boolean
  message?: string
  token?: string
  user?: User
  code?: string
  userId?: string
  email?: string
}

type PendingVerification = {
  userId: string
  email: string
}

const saveAuth = (token: string, user: User) => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

const redirectByRole = (user?: User) => {
  if (!user?.role) {
    window.location.href = '/dashboard'
    return
  }

  if (user.role === 'admin') {
    window.location.href = '/admin'
    return
  }

  if (user.role === 'employer') {
    window.location.href = '/employer'
    return
  }

  window.location.href = '/dashboard'
}

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const goToVerifyPage = () => {
    if (!pendingVerification?.userId) return

    const params = new URLSearchParams({
      userId: pendingVerification.userId,
      email: pendingVerification.email
    })

    window.location.href = `/verify-otp?${params.toString()}`
  }

  const handleResendOtp = async () => {
    if (!pendingVerification?.userId && !formData.email) {
      setError('Missing account information to resend OTP.')
      return
    }

    try {
      setResendLoading(true)
      setError('')
      setInfo('')

      const res = await fetch(`${API_BASE}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingVerification?.userId || undefined,
          email: pendingVerification?.email || formData.email
        })
      })

      const data = await res.json()

      if (data.success) {
        setInfo(data.message || 'OTP resent successfully.')
        setPendingVerification({
          userId: data.userId || pendingVerification?.userId || '',
          email: data.email || pendingVerification?.email || formData.email
        })
      } else {
        setError(data.message || 'Failed to resend OTP.')
      }
    } catch (err) {
      setError('Failed to resend OTP. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setPendingVerification(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data: LoginResponse = await res.json()

      if (data.success && data.token && data.user) {
        saveAuth(data.token, data.user)
        redirectByRole(data.user)
        return
      }

      if (data.code === 'EMAIL_NOT_VERIFIED') {
        setError(data.message || 'Please verify your email before logging in.')
        setPendingVerification({
          userId: data.userId || '',
          email: data.email || formData.email
        })
        return
      }

      setError(data.message || 'Login failed')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setError('')
      setInfo('')
      setGoogleLoading(true)

      const credential = credentialResponse?.credential

      if (!credential) {
        setError('Google login failed. Missing credential.')
        return
      }

      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          role: 'candidate'
        })
      })

      const data: LoginResponse = await res.json()

      if (data.success && data.token && data.user) {
        saveAuth(data.token, data.user)
        redirectByRole(data.user)
      } else {
        setError(data.message || 'Google login failed')
      }
    } catch (err) {
      setError('Google login failed. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.')
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 pt-16'>
      <div className='w-full max-w-md'>
        <div className='bg-white rounded-2xl shadow-xl p-8'>
          <div className='flex items-center justify-center gap-2 mb-8'>
            <div className='w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg' />
            <span className='text-xl font-bold text-gray-900'>InstaHire</span>
          </div>

          <h1 className='text-2xl font-bold text-gray-900 text-center mb-2'>
            Welcome back!
          </h1>
          <p className='text-gray-500 text-center mb-8'>
            Login to your account
          </p>

          {error && (
            <div className='bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm'>
              {error}
            </div>
          )}

          {info && (
            <div className='bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm'>
              {info}
            </div>
          )}

          {pendingVerification && (
            <div className='bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-4 rounded-xl mb-6'>
              <p className='text-sm font-medium'>Your email is not verified yet.</p>
              <p className='text-xs mt-1 break-all'>
                Account: {pendingVerification.email}
              </p>

              <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
                <button
                  type='button'
                  onClick={goToVerifyPage}
                  className='flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors'
                >
                  Verify your account
                </button>

                <button
                  type='button'
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  className='flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50'
                >
                  {resendLoading ? 'Resending...' : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          <div className='mb-6 flex justify-center'>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme='outline'
              size='large'
              shape='pill'
              text='continue_with'
              width='320'
            />
          </div>

          {googleLoading && (
            <p className='text-sm text-center text-gray-500 mb-4'>
              Signing in with Google...
            </p>
          )}

          <div className='relative my-6'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-gray-200' />
            </div>
            <div className='relative flex justify-center text-sm'>
              <span className='bg-white px-3 text-gray-400'>or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className='space-y-5'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Email Address
              </label>
              <input
                type='email'
                name='email'
                value={formData.email}
                onChange={handleChange}
                placeholder='you@example.com'
                required
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Password
              </label>
              <input
                type='password'
                name='password'
                value={formData.password}
                onChange={handleChange}
                placeholder='Enter your password'
                required
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              />
            </div>

            <div className='text-right'>
              <Link href='/forgot-password' className='text-sm text-blue-600 hover:underline'>
                Forgot password?
              </Link>
            </div>

            <button
              type='submit'
              disabled={loading}
              className='w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50'
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className='text-center text-gray-500 text-sm mt-6'>
            Don&apos;t have an account?{' '}
            <Link href='/register' className='text-blue-600 font-medium hover:underline'>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}