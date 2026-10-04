// Isolate the export from site styles (e.g. Tailwind oklch colors unsupported by html2canvas).
async function exportSurface(element: HTMLElement) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write('<!doctype html><html><head><style>body{margin:0;background:#fff}*{box-sizing:border-box}a{color:inherit}</style></head><body></body></html>')
  doc.close()
  const clone = element.cloneNode(true) as HTMLElement
  doc.body.appendChild(clone)
  await doc.fonts.ready
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  return { clone, dispose: () => frame.remove() }
}
const filename = (title: string) => title.trim().replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'resume'
export async function downloadResume(element: HTMLElement, title: string, format: 'pdf' | 'jpg') {
  const surface = await exportSurface(element)
  try {
    if (format === 'pdf') {
      const html2pdf = (await import('html2pdf.js')).default
      const options = { filename: `${filename(title)}.pdf`, margin: [8, 0, 8, 0] as [number, number, number, number], html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }, pagebreak: { mode: ['css', 'legacy'], avoid: ['.resume-entry', 'header', 'h2'] } }
      await html2pdf().set(options).from(surface.clone).save()
    } else {
      const html2canvas = (await import('html2canvas')).default
      const height = surface.clone.scrollHeight
      const canvas = await html2canvas(surface.clone, { backgroundColor: '#ffffff', scale: Math.min(2, 15000 / Math.max(height, 1)), width: 794, height, windowWidth: 794, windowHeight: height, useCORS: true })
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image export failed. Try PDF instead.')), 'image/jpeg', 0.95))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${filename(title)}.jpg`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }
  } finally { surface.dispose() }
}
