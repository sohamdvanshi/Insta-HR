import catalog from '../../../shared/resumeCatalog.json'

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')
export const resumeCatalog = catalog
export type Experience = { company?: string; jobTitle?: string; title?: string; location?: string; startDate?: string; endDate?: string; currentlyWorking?: boolean; description?: string; bullets?: string[] }
export type Education = { institution?: string; degree?: string; fieldOfStudy?: string; startDate?: string; endDate?: string; description?: string }
export type ResumeData = {
  title?: string; sector?: string; template?: string; summary?: string
  personalInfo?: { fullName?: string; email?: string; phone?: string; location?: string; jobTitle?: string; linkedin?: string; github?: string; website?: string }
  experience?: Experience[]; education?: Education[]; projects?: { name?: string; description?: string; link?: string }[]
  skills?: string[]; certifications?: string[]; languages?: string[]
}
export const getSector = (id?: string) => catalog.sectors.find(sector => sector.id === id) || catalog.sectors[0]
export function candidateSession(returnTo: string) {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.replace(`/login?next=${encodeURIComponent(returnTo)}`)
    return null
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.role === 'candidate' ? token : null
  } catch { return null }
}
export async function resumeRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}/resumes${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...init.headers }
  })
  const data = await response.json()
  if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load resume')
  return data
}
