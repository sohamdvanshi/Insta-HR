'use client'
import { API_BASE } from '@/lib/api'
import { tr, useLocale } from '@/lib/localization'


import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'


export default function NewResumePage() {
  useLocale()

  const router = useRouter()
  const creation = useRef<Promise<string> | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.replace('/login')
      return
    }

    let cancelled = false
    creation.current ||= createResume()
    creation.current.then(id => { if (!cancelled) router.replace(`/resume/${id}`) }).catch(() => { if (!cancelled) router.replace('/resume') })
    return () => { cancelled = true }
  }, [router])

  const createResume = async () => {
    try {
      const token = localStorage.getItem('token')

      const res = await fetch(API_BASE + '/resumes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          title: 'My Resume',
          template: 'classic',
          personalInfo: {
            fullName: '',
            email: '',
            phone: '',
            location: '',
            jobTitle: '',
            linkedin: '',
            github: '',
            website: ''
          },
          summary: '',
          experience: [],
          education: [],
          projects: [],
          skills: [],
          certifications: [],
          languages: [],
          status: 'draft'
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create resume')
      }

      return String(data.data.id)
    } catch (error) {
      throw error
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">{tr("Creating your resume...")}</p>
      </div>
    </main>
  )
}