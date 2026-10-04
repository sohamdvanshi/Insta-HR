export const TRAINING_API = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')}/training`

export async function trainingRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
    throw new Error('Please log in to continue')
  }
  const response = await fetch(`${TRAINING_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${token}` }
  })
  const data = await response.json()
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
  }
  if (!response.ok || !data.success) throw new Error(data.message || 'Training request failed')
  return data
}

export function trainingReturnPath(value: string | null) {
  if (!value || !value.startsWith('/')) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && /^\/training(?:\/|$)/.test(url.pathname)
      ? `${url.pathname}${url.search}${url.hash}` : null
  } catch { return null }
}

export function loginDestination(role: string) {
  if (role === 'trainer') return '/trainer'
  if (role === 'admin') return '/admin'
  if (role === 'super_admin') return '/super-admin'
  if (role === 'employer') return '/employer'
  const target = trainingReturnPath(new URLSearchParams(window.location.search).get('next')) || trainingReturnPath(sessionStorage.getItem('trainingReturnTo'))
  sessionStorage.removeItem('trainingReturnTo')
  return target || '/dashboard'
}
