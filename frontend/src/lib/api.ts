export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '')
export const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE.replace(/\/api\/v1$/, '')).replace(/\/+$/, '')
