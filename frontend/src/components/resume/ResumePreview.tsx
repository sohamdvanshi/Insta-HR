import type { CSSProperties, ReactNode } from 'react'
import { getSector, resumeCatalog, type ResumeData } from '@/lib/resume'

const safeUrl = (value?: string) => {
  if (!value) return undefined
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
const textStyle: CSSProperties = { margin: '5px 0', lineHeight: 1.55, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }
export default function ResumePreview({ resume }: { resume: ResumeData }) {
  const sector = resumeCatalog.sectors.find(item => item.template === resume.template) || getSector(resume.sector)
  const modern = resume.template === 'modern'
  const color = resume.template === 'classic' ? '#111827' : sector.accent
  const info = resume.personalInfo || {}
  const list = (items: string[] = []) => items.filter(item => item.trim()).join(' • ')
  const sections: Record<string, ReactNode> = {
    summary: resume.summary?.trim() && <p style={textStyle}>{resume.summary}</p>,
    skills: list(resume.skills) && <p style={textStyle}>{list(resume.skills)}</p>,
    languages: list(resume.languages) && <p style={textStyle}>{list(resume.languages)}</p>,
    certifications: list(resume.certifications) && <p style={textStyle}>{list(resume.certifications)}</p>,
    experience: resume.experience?.filter(item => item.company || item.jobTitle || item.title || item.description || item.bullets?.some(Boolean)).map((item, index) => (
      <div key={index} className="resume-entry" style={{ marginBottom: 14, breakInside: 'avoid' }}>
        <strong>{[item.jobTitle || item.title, item.company].filter(Boolean).join(' — ')}</strong>
        <p style={{ ...textStyle, color: '#475569', fontSize: 12 }}>{[item.location, [item.startDate, item.currentlyWorking ? 'Present' : item.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' | ')}</p>
        {item.description && <p style={textStyle}>{item.description}</p>}
        {!!item.bullets?.filter(Boolean).length && <ul style={{ margin: '6px 0', paddingLeft: 20 }}>{item.bullets.filter(Boolean).map((bullet, i) => <li key={i} style={textStyle}>{bullet}</li>)}</ul>}
      </div>
    )),
    education: resume.education?.filter(item => item.institution || item.degree).map((item, index) => (
      <div key={index} className="resume-entry" style={{ marginBottom: 14, breakInside: 'avoid' }}><strong>{[item.degree, item.fieldOfStudy].filter(Boolean).join(' — ')}</strong><p style={textStyle}>{item.institution}</p><p style={{ ...textStyle, color: '#475569', fontSize: 12 }}>{[item.startDate, item.endDate].filter(Boolean).join(' – ')}</p>{item.description && <p style={textStyle}>{item.description}</p>}</div>
    )),
    projects: resume.projects?.filter(item => item.name || item.description).map((item, index) => (
      <div key={index} className="resume-entry" style={{ marginBottom: 14, breakInside: 'avoid' }}><strong>{item.name}</strong>{safeUrl(item.link) && <p style={textStyle}><a style={{ color }} href={safeUrl(item.link)} rel="noopener noreferrer" target="_blank">{item.link}</a></p>}<p style={textStyle}>{item.description}</p></div>
    ))
  }
  const order = ['classic', 'modern'].includes(resume.template || '') ? ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'languages'] : sector.sections
  return (
    <article aria-label="Resume preview" style={{ boxSizing: 'border-box', width: 794, minHeight: 1123, padding: 48, background: '#ffffff', color: '#111827', fontFamily: 'Arial, sans-serif', fontSize: 14, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
      <header style={{ padding: modern ? 24 : '0 0 20px', marginBottom: 24, borderBottom: `3px solid ${color}`, background: modern ? '#f1f5f9' : '#ffffff', breakInside: 'avoid' }}>
        <h1 style={{ fontSize: 30, margin: 0, lineHeight: 1.25, color }}>{info.fullName || 'Your Name'}</h1>
        {info.jobTitle && <p style={{ ...textStyle, fontSize: 18 }}>{info.jobTitle}</p>}
        <p style={{ ...textStyle, color: '#475569', fontSize: 12 }}>{[info.email, info.phone, info.location].filter(Boolean).join(' | ')}</p>
        {[info.linkedin, info.github, info.website].filter(value => safeUrl(value)).map((value, i) => <p key={i} style={{ ...textStyle, fontSize: 12 }}><a href={safeUrl(value)} style={{ color }} target="_blank" rel="noopener noreferrer">{value}</a></p>)}
      </header>
      {order.map(key => {
        const content = sections[key]
        if (!content || (Array.isArray(content) && !content.length)) return null
        return <section key={key} style={{ marginBottom: 24 }}><h2 style={{ margin: '0 0 10px', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1, color, borderBottom: '1px solid #cbd5e1', paddingBottom: 6, breakAfter: 'avoid' }}>{key === 'summary' ? 'Professional Summary' : key}</h2>{content}</section>
      })}
    </article>
  )
}
