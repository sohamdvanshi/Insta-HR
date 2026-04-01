'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function VerifyOTPPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const email = searchParams.get('email')

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('http://localhost:5000/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Email verified successfully! Redirecting...')
        localStorage.setItem('token', data.token)
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        setError(data.message || 'Invalid OTP')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setSuccess('')
    try {
      const res = await fetch('http://localhost:5000/api/v1/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('New OTP sent to your email!')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      setError('Failed to resend OTP')
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4'>
      <div className='bg-white rounded-2xl shadow-xl p-8 w-full max-w-md'>

        {/* Header */}
        <div className='text-center mb-8'>
          <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <span className='text-3xl'>📧</span>
          </div>
          <h1 className='text-2xl font-bold text-gray-900'>Verify Your Email</h1>
          <p className='text-gray-500 mt-2'>
            We sent a 6-digit OTP to<br />
            <span className='font-semibold text-blue-600'>{email || 'your email'}</span>
          </p>
        </div>

        {/* OTP Input */}
        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Enter OTP
          </label>
          <input
            type='text'
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder='000000'
            className='w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-2xl font-bold tracking-widest focus:border-blue-500 focus:outline-none'
          />
        </div>

        {/* Error / Success */}
        {error && (
          <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm'>
            {error}
          </div>
        )}
        {success && (
          <div className='mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm'>
            {success}
          </div>
        )}

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={loading}
          className='w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50'
        >
          {loading ? 'Verifying...' : 'Verify Email'}
        </button>

        {/* Resend */}
        <div className='text-center mt-4'>
          <p className='text-gray-500 text-sm'>
            Didn't receive the OTP?{' '}
            <button
              onClick={handleResend}
              className='text-blue-600 font-semibold hover:underline'
            >
              Resend OTP
            </button>
          </p>
        </div>

        {/* Back to login */}
        <div className='text-center mt-4'>
          <Link href='/auth/login' className='text-gray-400 text-sm hover:text-gray-600'>
            ← Back to Login
          </Link>
        </div>

      </div>
    </div>
  )
}