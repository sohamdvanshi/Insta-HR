import { API_BASE } from '@/lib/api'
export async function downloadInvoiceFile(path: string, id: string) {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  const response = await fetch(API_BASE + path, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Unable to download invoice') }
  const url = URL.createObjectURL(await response.blob()), a = document.createElement('a')
  a.href = url; a.download = `invoice-${id}.pdf`; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
