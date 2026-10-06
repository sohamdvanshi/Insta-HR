export const ADMIN_API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')
export async function adminRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  if (!token) { window.location.assign('/login'); throw new Error('Please sign in') }
  const response = await fetch(`${ADMIN_API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${token}` } })
  const result = await response.json()
  if (response.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.assign('/login') }
  if (!response.ok || !result.success) throw new Error(result.message || 'Unable to complete request')
  return result
}
export const mutation = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
