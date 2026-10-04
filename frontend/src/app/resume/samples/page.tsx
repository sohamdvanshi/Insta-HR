'use client'
import { useState } from 'react'
import Link from 'next/link'
import { resumeCatalog } from '@/lib/resume'
export default function SamplesPage() {
  const [sector, setSector] = useState('all')
  return <main className="min-h-screen bg-gray-50 px-6 py-24"><div className="mx-auto max-w-6xl"><Link href="/resume" className="text-blue-600">My resumes</Link><h1 className="my-3 text-3xl font-bold">Resume samples</h1><p className="mb-6 text-gray-600">Fictional fresher and experienced examples for ten sectors. View or share a sample without signing in. Use the structure with your own verified details.</p><label htmlFor="sample-sector" className="mr-3">Sector</label><select id="sample-sector" value={sector} onChange={event => setSector(event.target.value)} className="mb-6 rounded-lg border p-3"><option value="all">All sectors</option>{resumeCatalog.sectors.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{resumeCatalog.samples.filter(sample => sector === 'all' || sample.sector === sector).map(sample => <article key={sample.id} className="rounded-2xl border bg-white p-6"><p className="text-sm capitalize text-blue-700">{sample.level}</p><h2 className="my-2 text-xl font-semibold">{sample.title}</h2><p className="mb-5 text-gray-600">{sample.skills.join(' • ')}</p><Link href={`/resume/samples/${sample.id}`} className="font-semibold text-blue-600">View and share sample →</Link></article>)}</div></div></main>
}
