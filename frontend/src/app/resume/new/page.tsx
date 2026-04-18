'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = 'http://localhost:5000/api/v1'

export default function NewResumePage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.replace('/login')
      return
    }

    createResume()
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

      router.replace('/resume/' + data.data.id)
    } catch (error) {
      router.replace('/resume')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Creating your resume...</p>
      </div>
    </main>
  )
}