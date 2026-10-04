'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ResumePreview from '@/components/resume/ResumePreview'
import { resumeCatalog } from '@/lib/resume'
export default function SamplePage() {
  const { id } = useParams()
  const sample = resumeCatalog.samples.find(item => item.id === id)
  const [message, setMessage] = useState('')
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage('Sample link copied.') } catch { setMessage('Copy the page address to share this sample.') }
  }
  if (!sample) return <main className="p-10 pt-24"><h1>Sample not found</h1><Link href="/resume/samples">Browse samples</Link></main>
  return <main className="min-h-screen bg-gray-100 px-5 py-24"><div className="mx-auto max-w-5xl"><Link href="/resume/samples" className="text-blue-600">← All samples</Link><h1 className="my-3 text-2xl font-bold">{sample.title}</h1><p className="mb-4">Fictional example — do not present these qualifications or work history as your own.</p><div className="mb-5 flex flex-wrap gap-4"><button onClick={share} className="rounded-xl border bg-white px-5 py-3">Copy sample link</button><Link className="rounded-xl bg-blue-600 px-5 py-3 text-white" href={`/resume/new?sector=${sample.sector}`}>Use this layout with my profile</Link></div>{message && <p role="status" className="mb-4">{message}</p>}<div className="overflow-x-auto"><ResumePreview resume={sample} /></div></div></main>
}
