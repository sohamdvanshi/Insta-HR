'use client'
import { API_BASE } from '@/lib/api'
import { tr, trError, useLocale } from '@/lib/localization'

import { useState } from 'react'
import Link from 'next/link'

export default function RegisterPage() {
  useLocale()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'candidate',
    firstName: '',
    lastName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      })

      const data = await res.json()

      if (data.success) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = `/auth/verify-otp?userId=${data.user.id}&email=${encodeURIComponent(formData.email)}`
      } else {
        setError(data.message)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 pt-16'>
      <div className='w-full max-w-md'>
        <div className='bg-white rounded-2xl shadow-xl p-8'>

          <div className='flex items-center justify-center gap-2 mb-8'>
            <div className='w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg' />
            <span className='text-xl font-bold text-gray-900'>{tr("InstaHire")}</span>
          </div>

          <h1 className='text-2xl font-bold text-gray-900 text-center mb-2'>{tr("Create your account")}</h1>
          <p className='text-gray-500 text-center mb-8'>{tr("Join 2 million people finding jobs")}</p>

          {error && (
            <div className='bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm'>
              {trError(error)}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-5'>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("I am a...")}</label>
              <select
                name='role'
                value={formData.role}
                onChange={handleChange}
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              >
                <option value='candidate'>{tr("Job Seeker")}</option>
                <option value='employer'>{tr("Employer / Recruiter")}</option>
              </select>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("First Name")}</label>
                <input
                  type='text'
                  name='firstName'
                  required={formData.role === 'candidate'}
                  maxLength={100}
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={tr("John")}
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("Last Name")}</label>
                <input
                  type='text'
                  name='lastName'
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={tr("Doe")}
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("Email Address")}</label>
              <input
                type='email'
                name='email'
                value={formData.email}
                onChange={handleChange}
                placeholder={tr("you@example.com")}
                required
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("Password")}</label>
              <input
                type='password'
                name='password'
                value={formData.password}
                onChange={handleChange}
                placeholder={tr("Min 8 characters")}
                required
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>{tr("Confirm Password")}</label>
              <input
                type='password'
                name='confirmPassword'
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={tr("Repeat your password")}
                required
                className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all'
              />
            </div>

            <button
              type='submit'
              disabled={loading}
              className='w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50'
            >
              {tr(loading ? 'Creating account...' : 'Create Account')}
            </button>

          </form>

          <p className='text-center text-gray-500 text-sm mt-6'>{tr("Already have an account?")}{tr(' ')}
            <Link href='/auth/login' className='text-blue-600 font-medium hover:underline'>{tr("Login here")}</Link>
          </p>

        </div>
      </div>
    </main>
  )
}