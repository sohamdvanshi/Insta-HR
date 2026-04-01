'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PostJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
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
    skills: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          requiredSkills: formData.skills.split(',').map(s => s.trim()),
          experienceMin: Number(formData.experienceMin),
          experienceMax: Number(formData.experienceMax),
          salaryMin: Number(formData.salaryMin),
          salaryMax: Number(formData.salaryMax)
        })
      })

      const data = await res.json()
      if (data.success) {
        setMessage('✅ Job posted successfully!')
        setTimeout(() => router.push('/jobs'), 2000)
      } else {
        setMessage(data.message)
      }
    } catch (err) {
      setMessage('Something went wrong')
    }
    setLoading(false)
  }

  return (
    <main className='min-h-screen bg-gray-50 pt-16'>
      <div className='max-w-3xl mx-auto px-6 py-10'>

        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Post a Job</h1>
        <p className='text-gray-500 mb-8'>Fill in the details to post your job listing</p>

        {message && (
          <div className='bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 font-medium'>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>

          {/* Job Title */}
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

          {/* Experience & Salary */}
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

          {/* Skills & Description */}
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
