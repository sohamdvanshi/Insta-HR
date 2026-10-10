export function readStoredUser(): Record<string, any> {
  try {
    const value = JSON.parse(localStorage.getItem('user') || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}
