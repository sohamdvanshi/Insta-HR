'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PostJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [userPlan, setUserPlan] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    industry: '',
    jobType: '',
    experienceMin: '',
    experienceMax: '',
    salaryMin: '',
    salaryMax: '',
    skills: '',
    isFeatured: false
  })

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setUserPlan(user.subscriptionPlan || user.plan || '')

    const fetchSubscription = async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      try {
        const res = await fetch('http://localhost:5000/api/v1/payments/subscription', {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await res.json()

        if (data.success && data.data?.isActive) {
          setUserPlan(data.data.plan)
        } else {
          setUserPlan('free')
        }
      } catch (error) {
        console.error('Failed to fetch subscription', error)
      }
    }

    fetchSubscription()
  }, [])

  const canFeatureJobs = ['premium', 'enterprise'].includes(String(userPlan).toLowerCase())

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('http://localhost:5000/api/v1/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          location: formData.location,
          industry: formData.industry,
          jobType: formData.jobType,
          minExperienceYears: formData.experienceMin ? Number(formData.experienceMin) : 0,
          salaryMin: formData.salaryMin ? Number(formData.salaryMin) : null,
          salaryMax: formData.salaryMax ? Number(formData.salaryMax) : null,
          requiredSkills: formData.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          experienceLevel:
            Number(formData.experienceMin) >= 5
              ? 'senior'
              : Number(formData.experienceMin) >= 2
              ? 'mid'
              : Number(formData.experienceMin) >= 1
              ? 'junior'
              : 'intern',
          isFeatured: canFeatureJobs ? formData.isFeatured : false
        })
      })

      const data = await res.json()

      if (data.success) {
        setMessage('✅ Job posted successfully!')
        setMessageType('success')
        setTimeout(() => router.push('/jobs'), 1500)
      } else {
        setMessage(data.message || 'Failed to post job')
        setMessageType('error')
      }
    } catch (err) {
      setMessage('Something went wrong')
      setMessageType('error')
    }

    setLoading(false)
  }

  return (
    <main className='min-h-screen bg-gray-50 pt-16'>
      <div className='max-w-3xl mx-auto px-6 py-10'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Post a Job</h1>
        <p className='text-gray-500 mb-8'>Fill in the details to post your job listing</p>

        {message && (
          <div
            className={`px-4 py-3 rounded-xl mb-6 font-medium ${
              messageType === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100'>
            <h2 className='font-bold text-gray-900 mb-4'>Basic Information</h2>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Job Title *</label>
                <input
                  name='title'
                  value={formData.title}
                  onChange={handleChange}
                  placeholder='e.g. Senior React Developer'
                  required
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Location *</label>
                <input
                  name='location'
                  value={formData.location}
                  onChange={handleChange}
                  placeholder='e.g. Mumbai, Remote'
                  required
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Industry *</label>
                  <select
                    name='industry'
                    value={formData.industry}
                    onChange={handleChange}
                    required
                    className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                  >
                    <option value=''>Select Industry</option>
                    {['IT','Finance','Banking','Healthcare','Manufacturing','Pharma','Civil','Automation','Mechanical','Logistics','Others'].map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Job Type *</label>
                  <select
                    name='jobType'
                    value={formData.jobType}
                    onChange={handleChange}
                    required
                    className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                  >
                    <option value=''>Select Type</option>
                    <option value='full-time'>Full-time</option>
                    <option value='part-time'>Part-time</option>
                    <option value='contract'>Contract</option>
                    <option value='remote'>Remote</option>
                    <option value='internship'>Internship</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100'>
            <h2 className='font-bold text-gray-900 mb-4'>Experience & Salary</h2>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Min Experience (years)</label>
                <input
                  name='experienceMin'
                  value={formData.experienceMin}
                  onChange={handleChange}
                  type='number'
                  placeholder='0'
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Max Experience (years)</label>
                <input
                  name='experienceMax'
                  value={formData.experienceMax}
                  onChange={handleChange}
                  type='number'
                  placeholder='5'
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Min Salary (₹/month)</label>
                <input
                  name='salaryMin'
                  value={formData.salaryMin}
                  onChange={handleChange}
                  type='number'
                  placeholder='30000'
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Max Salary (₹/month)</label>
                <input
                  name='salaryMax'
                  value={formData.salaryMax}
                  onChange={handleChange}
                  type='number'
                  placeholder='80000'
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100'>
            <h2 className='font-bold text-gray-900 mb-4'>Skills & Description</h2>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Required Skills (comma separated)
                </label>
                <input
                  name='skills'
                  value={formData.skills}
                  onChange={handleChange}
                  placeholder='React, Node.js, PostgreSQL'
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Job Description *</label>
                <textarea
                  name='description'
                  value={formData.description}
                  onChange={handleChange}
                  placeholder='Describe the role, responsibilities and requirements...'
                  required
                  rows={6}
                  className='w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-all resize-none'
                />
              </div>
            </div>
          </div>

          <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100'>
            <h2 className='font-bold text-gray-900 mb-4'>Visibility</h2>

            {canFeatureJobs ? (
              <label className='flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 cursor-pointer'>
                <input
                  type='checkbox'
                  name='isFeatured'
                  checked={formData.isFeatured}
                  onChange={handleChange}
                  className='mt-1 h-4 w-4'
                />
                <div>
                  <p className='font-semibold text-yellow-900'>Feature this job</p>
                  <p className='text-sm text-yellow-800 mt-1'>
                    Featured jobs appear above regular listings for 30 days.
                  </p>
                </div>
              </label>
            ) : (
              <div className='rounded-xl border border-gray-200 bg-gray-50 p-4'>
                <p className='font-semibold text-gray-900'>Feature this job</p>
                <p className='text-sm text-gray-600 mt-1'>
                  Upgrade to Premium or Enterprise to place this job above regular listings.
                </p>
              </div>
            )}
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg'
          >
            {loading ? 'Posting Job...' : '🚀 Post Job'}
          </button>
        </form>
      </div>
    </main>
  )
}