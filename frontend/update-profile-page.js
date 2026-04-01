const fs = require('fs');

const content = `'use client'
import { useState, useEffect, useRef } from 'react'

const INDUSTRIES = ['IT','Finance','Banking','Healthcare','Manufacturing','Pharma','Civil','Automation','Mechanical','Logistics','Others']

interface Education {
  degree: string
  institution: string
  year: string
  grade?: string
}

interface Experience {
  title: string
  company: string
  location?: string
  from: string
  to: string
  current: boolean
  description?: string
}

interface Profile {
  firstName?: string
  lastName?: string
  headline?: string
  summary?: string
  currentLocation?: string
  industry?: string
  yearsOfExperience?: number
  expectedSalary?: number
  skills?: string[]
  resumeUrl?: string
  photoUrl?: string
  education?: Education[]
  experience?: Experience[]
  isResumePublic?: boolean
  profileCompleteness?: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const photoRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', headline: '', summary: '',
    currentLocation: '', industry: '', yearsOfExperience: '',
    expectedSalary: '', skills: '', isResumePublic: true
  })

  const [education, setEducation] = useState<Education[]>([])
  const [experience, setExperience] = useState<Experience[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { window.location.href = '/login'; return }
    fetchProfile(token)
  }, [])

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/candidates/profile', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        const p = data.data
        setProfile(p)
        setForm({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          headline: p.headline || '',
          summary: p.summary || '',
          currentLocation: p.currentLocation || '',
          industry: p.industry || '',
          yearsOfExperience: p.yearsOfExperience?.toString() || '',
          expectedSalary: p.expectedSalary?.toString() || '',
          skills: p.skills?.join(', ') || '',
          isResumePublic: p.isResumePublic ?? true
        })
        setEducation(p.education || [])
        setExperience(p.experience || [])
      }
    } catch { showMsg('Failed to load profile', true) }
    setLoading(false)
  }

  const showMsg = (msg: string, err = false) => {
    setMessage(msg); setIsError(err)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('http://localhost:5000/api/v1/candidates/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          ...form,
          yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : 0,
          expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : 0,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
          education,
          experience
        })
      })
      const data = await res.json()
      if (data.success) { setProfile(data.data); showMsg('Profile saved successfully!') }
      else showMsg(data.message || 'Save failed', true)
    } catch { showMsg('Something went wrong', true) }
    setSaving(false)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const token = localStorage.getItem('token')
    const fd = new FormData(); fd.append('photo', file)
    try {
      const res = await fetch('http://localhost:5000/api/v1/candidates/photo', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd
      })
      const data = await res.json()
      if (data.success) { setProfile(p => ({ ...p, photoUrl: data.photoUrl })); showMsg('Photo updated!') }
      else showMsg(data.message, true)
    } catch { showMsg('Upload failed', true) }
    setUploadingPhoto(false)
  }

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingResume(true)
    const token = localStorage.getItem('token')
    const fd = new FormData(); fd.append('resume', file)
    try {
      const res = await fetch('http://localhost:5000/api/v1/candidates/resume', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd
      })
      const data = await res.json()
      if (data.success) { setProfile(p => ({ ...p, resumeUrl: data.resumeUrl })); showMsg('Resume uploaded!') }
      else showMsg(data.message, true)
    } catch { showMsg('Upload failed', true) }
    setUploadingResume(false)
  }

  // Education helpers
  const addEducation = () => setEducation([...education, { degree: '', institution: '', year: '', grade: '' }])
  const updateEducation = (i: number, field: string, val: string) => {
    const updated = [...education]; (updated[i] as any)[field] = val; setEducation(updated)
  }
  const removeEducation = (i: number) => setEducation(education.filter((_, idx) => idx !== i))

  // Experience helpers
  const addExperience = () => setExperience([...experience, { title: '', company: '', location: '', from: '', to: '', current: false, description: '' }])
  const updateExperience = (i: number, field: string, val: any) => {
    const updated = [...experience]; (updated[i] as any)[field] = val; setExperience(updated)
  }
  const removeExperience = (i: number) => setExperience(experience.filter((_, idx) => idx !== i))

  // Completeness
  const completeness = () => {
    let score = 0
    if (form.firstName) score += 15
    if (form.headline) score += 10
    if (form.summary) score += 10
    if (form.skills) score += 15
    if (profile?.photoUrl) score += 10
    if (profile?.resumeUrl) score += 20
    if (education.length > 0) score += 10
    if (experience.length > 0) score += 10
    return score
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <p className="text-gray-400">Loading profile...</p>
    </main>
  )

  const pct = completeness()

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-500">Keep your profile updated to get better job matches</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {message && (
          <div className={"px-4 py-3 rounded-xl mb-6 font-medium " + (isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700')}>
            {isError ? '✕ ' : '✓ '}{message}
          </div>
        )}

        {/* Profile Completeness */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Profile Completeness</h2>
            <span className={"font-bold text-lg " + (pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500')}>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={"h-3 rounded-full transition-all " + (pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400')}
              style={{ width: pct + '%' }}></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {pct < 100 ? 'Add ' + (pct < 50 ? 'photo, resume, skills and summary' : 'more details') + ' to reach 100%' : '🎉 Profile complete!'}
          </p>
        </div>

        {/* Photo + Basic Info Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-6">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              <div onClick={() => photoRef.current?.click()}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center cursor-pointer overflow-hidden hover:opacity-90 transition-opacity">
                {profile?.photoUrl ? (
                  <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-white font-bold">
                    {form.firstName ? form.firstName[0].toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <div onClick={() => photoRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700">
                <span className="text-white text-xs">📷</span>
              </div>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              {uploadingPhoto && <p className="text-xs text-blue-600 mt-1 text-center">Uploading...</p>}
            </div>

            <div className="flex-1">
              <p className="font-bold text-gray-900 text-xl">{form.firstName} {form.lastName}</p>
              <p className="text-gray-500">{form.headline || 'Add your headline'}</p>
              <p className="text-gray-400 text-sm">{form.currentLocation || 'Add location'}</p>
              <p className="text-xs text-blue-600 mt-1 cursor-pointer" onClick={() => photoRef.current?.click()}>
                {profile?.photoUrl ? 'Change photo' : '+ Upload photo'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'basic', label: 'Basic Info' },
            { id: 'education', label: 'Education' },
            { id: 'experience', label: 'Experience' },
            { id: 'resume', label: 'Resume' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={"px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-colors " + (activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400')}>
              {tab.label}
              {tab.id === 'education' && education.length > 0 && <span className="ml-1 text-xs">({education.length})</span>}
              {tab.id === 'experience' && experience.length > 0 && <span className="ml-1 text-xs">({experience.length})</span>}
            </button>
          ))}
        </div>

        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
                    placeholder="John" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
                    placeholder="Doe" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Headline</label>
                <input value={form.headline} onChange={e => setForm({...form, headline: e.target.value})}
                  placeholder="e.g. Senior React Developer at TCS" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
                <textarea value={form.summary} onChange={e => setForm({...form, summary: e.target.value})}
                  rows={4} placeholder="Tell employers about yourself, your experience and what you're looking for..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Location</label>
                <input value={form.currentLocation} onChange={e => setForm({...form, currentLocation: e.target.value})}
                  placeholder="e.g. Mumbai, Maharashtra" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <select value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500">
                    <option value="">Select Industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                  <input type="number" value={form.yearsOfExperience} onChange={e => setForm({...form, yearsOfExperience: e.target.value})}
                    placeholder="e.g. 3" min="0" max="50" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">Skills & Salary</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Skills (comma separated)</label>
                <input value={form.skills} onChange={e => setForm({...form, skills: e.target.value})}
                  placeholder="React, Node.js, PostgreSQL, Python" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                {form.skills && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.skills.split(',').map(s => s.trim()).filter(Boolean).map(skill => (
                      <span key={skill} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{skill}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Salary (per month ₹)</label>
                <input type="number" value={form.expectedSalary} onChange={e => setForm({...form, expectedSalary: e.target.value})}
                  placeholder="e.g. 80000" min="0" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Education Tab */}
        {activeTab === 'education' && (
          <div className="space-y-4">
            {education.map((edu, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Education {i + 1}</h3>
                  <button onClick={() => removeEducation(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Degree / Course</label>
                    <input value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)}
                      placeholder="e.g. B.Tech Computer Science" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Institution</label>
                    <input value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)}
                      placeholder="e.g. IIT Bombay" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Passing Year</label>
                    <input value={edu.year} onChange={e => updateEducation(i, 'year', e.target.value)}
                      placeholder="e.g. 2022" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grade / CGPA (optional)</label>
                    <input value={edu.grade} onChange={e => updateEducation(i, 'grade', e.target.value)}
                      placeholder="e.g. 8.5 CGPA or 85%" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addEducation}
              className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 rounded-2xl hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
              + Add Education
            </button>
          </div>
        )}

        {/* Experience Tab */}
        {activeTab === 'experience' && (
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Experience {i + 1}</h3>
                  <button onClick={() => removeExperience(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                    <input value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)}
                      placeholder="e.g. Software Engineer" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                    <input value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)}
                      placeholder="e.g. Infosys" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location (optional)</label>
                  <input value={exp.location} onChange={e => updateExperience(i, 'location', e.target.value)}
                    placeholder="e.g. Pune, Maharashtra" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From (Month/Year)</label>
                    <input value={exp.from} onChange={e => updateExperience(i, 'from', e.target.value)}
                      placeholder="e.g. Jan 2021" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To (Month/Year)</label>
                    <input value={exp.to} onChange={e => updateExperience(i, 'to', e.target.value)}
                      disabled={exp.current} placeholder={exp.current ? 'Present' : 'e.g. Dec 2023'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 disabled:bg-gray-50" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={exp.current} onChange={e => updateExperience(i, 'current', e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">I currently work here</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                  <textarea value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)}
                    rows={3} placeholder="Describe your responsibilities and achievements..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            ))}
            <button onClick={addExperience}
              className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 rounded-2xl hover:border-blue-400 hover:text-blue-600 transition-colors font-medium">
              + Add Experience
            </button>
          </div>
        )}

        {/* Resume Tab */}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">Resume</h2>

              {profile?.resumeUrl && (
                <div className="flex items-center justify-between bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
                  <div>
                    <p className="font-medium text-green-700">✓ Resume Uploaded</p>
                    <p className="text-sm text-gray-500">Stored on Cloudinary • Visible to employers</p>
                  </div>
                  <a href={profile.resumeUrl} target="_blank" rel="noreferrer"
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700">
                    View Resume
                  </a>
                </div>
              )}

              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-blue-400 transition-colors">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-gray-700 font-medium mb-1">{uploadingResume ? 'Uploading to Cloudinary...' : profile?.resumeUrl ? 'Upload New Resume' : 'Upload Your Resume'}</p>
                  <p className="text-xs text-gray-400">PDF, DOC, DOCX — Max 10MB</p>
                </div>
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" disabled={uploadingResume} />
              </label>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">Resume Privacy</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Make resume public</p>
                  <p className="text-sm text-gray-500">Employers can find and view your resume in the resume bank</p>
                </div>
                <button onClick={() => setForm({...form, isResumePublic: !form.isResumePublic})}
                  className={"w-12 h-6 rounded-full transition-colors relative " + (form.isResumePublic ? 'bg-blue-600' : 'bg-gray-300')}>
                  <span className={"w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all " + (form.isResumePublic ? 'left-6' : 'left-0.5')}></span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>

      </div>
    </main>
  )
}
`;

fs.writeFileSync('src/app/profile/page.tsx', content);
console.log('✅ Profile page created!');