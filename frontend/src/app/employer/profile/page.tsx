'use client'
import { readStoredUser } from '@/lib/storage'
import { API_BASE } from '@/lib/api'
import { tr, useLocale } from '@/lib/localization'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const INDUSTRIES = ['IT','Finance','Banking','Healthcare','Manufacturing','Pharma','Civil','Automation','Mechanical','Logistics','Education','Real Estate','Retail','Others']
const COMPANY_SIZES = ['1-10','11-50','51-200','201-500','501-1000','1000+']
const CURRENT_YEAR = new Date().getFullYear()

interface EmployerProfile {
  companyName?: string
  logoUrl?: string
  tagline?: string
  about?: string
  industry?: string
  companySize?: string
  website?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  linkedinUrl?: string
  twitterUrl?: string
  foundedYear?: number
  isVerified?: boolean
  totalJobsPosted?: number
}

export default function EmployerProfilePage() {
  useLocale()

  const router = useRouter()
  const [profile, setProfile] = useState<EmployerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const logoRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    companyName: '',
    tagline: '',
    about: '',
    industry: '',
    companySize: '1-10',
    website: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    linkedinUrl: '',
    twitterUrl: '',
    foundedYear: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const user = readStoredUser()
    if (!token || user.role !== 'employer') {
      router.push('/login')
      return
    }
    fetchProfile(token)
  }, [])

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/employers/profile`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        const p = data.data
        setProfile(p)
        setForm({
          companyName: p.companyName || '',
          tagline: p.tagline || '',
          about: p.about || '',
          industry: p.industry || '',
          companySize: p.companySize || '1-10',
          website: p.website || '',
          email: p.email || '',
          phone: p.phone || '',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          country: p.country || 'India',
          linkedinUrl: p.linkedinUrl || '',
          twitterUrl: p.twitterUrl || '',
          foundedYear: p.foundedYear?.toString() || '',
        })
      }
    } catch {
      // no profile yet, that's fine
    }
    setLoading(false)
  }

  const showMsg = (msg: string, err = false) => {
    setMessage(msg)
    setIsError(err)
    setTimeout(() => setMessage(''), 3500)
  }

  const handleSave = async () => {
    if (!form.companyName.trim()) return showMsg('Company name is required', true)
    setSaving(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/employers/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...form, foundedYear: form.foundedYear ? Number(form.foundedYear) : null })
      })
      const data = await res.json()
      if (data.success) {
        setProfile(data.data)
        showMsg('Company profile saved!')
      } else showMsg(data.message || 'Save failed', true)
    } catch { showMsg('Something went wrong', true) }
    setSaving(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!profile && !form.companyName) return showMsg('Please save company name first', true)
    setUploadingLogo(true)
    const token = localStorage.getItem('token')
    const fd = new FormData()
    fd.append('logo', file)
    try {
      const res = await fetch(`${API_BASE}/employers/logo`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd
      })
      const data = await res.json()
      if (data.success) {
        setProfile(p => ({ ...p, logoUrl: data.logoUrl }))
        showMsg('Logo updated!')
      } else showMsg(data.message, true)
    } catch { showMsg('Upload failed', true) }
    setUploadingLogo(false)
  }

  // Profile completeness
  const completeness = () => {
    let score = 0
    if (form.companyName) score += 20
    if (form.about) score += 15
    if (form.industry) score += 10
    if (profile?.logoUrl) score += 15
    if (form.website) score += 10
    if (form.city) score += 10
    if (form.email) score += 10
    if (form.phone) score += 10
    return score
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <p className="text-gray-400 text-lg">{tr("Loading company profile...")}</p>
    </main>
  )

  const pct = completeness()

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tr("Company Profile")}</h1>
            <p className="text-gray-500">{tr("Build your employer brand to attract the best candidates")}</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
            {tr(saving ? 'Saving...' : '💾 Save Profile')}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={"px-4 py-3 rounded-xl mb-6 font-medium " + (isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200')}>
            {tr(isError ? '✕ ' : '✓ ')}{tr(message)}
          </div>
        )}

        {/* Profile Completeness */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">{tr("Profile Completeness")}</h2>
            <span className={"font-bold text-lg " + (pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500')}>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={"h-3 rounded-full transition-all " + (pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400')}
              style={{ width: pct + '%' }}></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {tr(pct < 100 ? 'Add ' + (pct < 50 ? 'logo, about section, industry and location' : 'more details') + ' to reach 100%' : '🎉 Profile complete!')}
          </p>
        </div>

        {/* Logo + Company Info Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 shadow-sm mb-6 text-white">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="relative flex-shrink-0">
              <div onClick={() => logoRef.current?.click()}
                className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center cursor-pointer overflow-hidden hover:opacity-90 transition-opacity shadow-lg">
                {profile?.logoUrl ? (
                  <img src={profile.logoUrl} alt={tr("Logo")} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-3xl">🏢</span>
                )}
              </div>
              <div onClick={() => logoRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-100 shadow">
                <span className="text-blue-600 text-xs">📷</span>
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              {uploadingLogo && <p className="text-xs text-blue-100 mt-1 text-center">{tr("Uploading...")}</p>}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-2xl">{form.companyName || tr('Your Company Name')}</p>
                {profile?.isVerified && <span className="bg-green-400 text-white text-xs px-2 py-0.5 rounded-full font-medium">{tr("✓ Verified")}</span>}
              </div>
              <p className="text-blue-100 mt-1">{form.tagline || tr('Add your company tagline')}</p>
              <div className="flex gap-4 mt-2 text-sm text-blue-100">
                {form.city && <span>📍 {form.city}{form.state ? ', ' + form.state : ''}</span>}
                {form.industry && <span>🏭 {tr(form.industry)}</span>}
                {form.companySize && <span>👥 {tr(form.companySize)}{tr(" employees")}</span>}
              </div>
              <p className="text-xs text-blue-200 mt-2 cursor-pointer" onClick={() => logoRef.current?.click()}>
                {tr(profile?.logoUrl ? 'Click logo to change' : '+ Upload company logo')}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'basic', label: '🏢 Basic Info' },
            { id: 'about', label: '📝 About' },
            { id: 'contact', label: '📞 Contact' },
            { id: 'social', label: '🔗 Social' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={"px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-colors " + (activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400')}>
              {tr(tab.label)}
            </button>
          ))}
        </div>

        {/* ── BASIC INFO TAB ── */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4 text-lg">{tr("Company Details")}</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Company Name ")}<span className="text-red-500">*</span></label>
                <input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })}
                  placeholder={tr("e.g. Tata Consultancy Services")}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Tagline")}</label>
                <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })}
                  placeholder={tr("e.g. Building a better tomorrow")}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Industry")}</label>
                  <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500">
                    <option value="">{tr("Select Industry")}</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{tr(i)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Company Size")}</label>
                  <select value={form.companySize} onChange={e => setForm({ ...form, companySize: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500">
                    {COMPANY_SIZES.map(s => <option key={s} value={s}>{tr(s)}{tr(" employees")}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Founded Year")}</label>
                  <input type="number" value={form.foundedYear} onChange={e => setForm({ ...form, foundedYear: e.target.value })}
                    placeholder={tr("e.g. 2010")} min="1800" max={CURRENT_YEAR}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Website")}</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder={tr("https://yourcompany.com")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABOUT TAB ── */}
        {activeTab === 'about' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4 text-lg">{tr("About Your Company")}</h2>
            <p className="text-sm text-gray-500 mb-4">{tr("Tell candidates what makes your company a great place to work. This appears on all your job postings.")}</p>
            <textarea value={form.about} onChange={e => setForm({ ...form, about: e.target.value })}
              rows={10}
              placeholder={tr("Describe your company culture, mission, values, products/services, why people love working here...&#10;&#10;Example:&#10;We are a leading technology company specializing in AI-powered solutions. Our team of 500+ engineers works on cutting-edge products used by millions worldwide. We believe in innovation, work-life balance, and continuous learning...")}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 resize-none" />
            <p className="text-xs text-gray-400 mt-2">{form.about.length}{tr(" characters")}</p>
          </div>
        )}

        {/* ── CONTACT TAB ── */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4 text-lg">{tr("Contact Information")}</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Contact Email")}</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder={tr("hr@company.com")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Phone")}</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder={tr("+91 98765 43210")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Address")}</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder={tr("e.g. 123 MG Road, Bandra")}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("City")}</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    placeholder={tr("Mumbai")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("State")}</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                    placeholder={tr("Maharashtra")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Country")}</label>
                  <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                    placeholder={tr("India")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SOCIAL TAB ── */}
        {activeTab === 'social' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4 text-lg">{tr("Social & Web Presence")}</h2>
            <p className="text-sm text-gray-500 mb-6">{tr("Add your social links so candidates can learn more about your company.")}</p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl w-10">🌐</span>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Website")}</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder={tr("https://yourcompany.com")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl w-10">💼</span>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("LinkedIn")}</label>
                  <input value={form.linkedinUrl} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })}
                    placeholder={tr("https://linkedin.com/company/yourcompany")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl w-10">🐦</span>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr("Twitter / X")}</label>
                  <input value={form.twitterUrl} onChange={e => setForm({ ...form, twitterUrl: e.target.value })}
                    placeholder={tr("https://twitter.com/yourcompany")}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Button */}
        <div className="mt-8">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg shadow-lg">
            {tr(saving ? 'Saving...' : '💾 Save Company Profile')}
          </button>
        </div>

      </div>
    </main>
  )
}
