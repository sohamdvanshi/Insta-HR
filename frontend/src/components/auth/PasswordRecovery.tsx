'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { API_BASE } from '@/lib/api'
import { tr, trError, useLocale } from '@/lib/localization'

export default function PasswordRecovery({ mode }: { mode: 'forgot' | 'reset' }) {
  useLocale()
  const reset = mode === 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [token, setToken] = useState('')
  const [ready, setReady] = useState(!reset)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (reset) {
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      setToken(/^[a-f0-9]{64}$/.test(value) ? value : '')
      setReady(true)
    }
  }, [reset])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setMessage('')
    if (reset && password !== confirm) { setError('Passwords do not match.'); return }
    if (reset && (password.length < 8 || new TextEncoder().encode(password).length > 72)) {
      setError('Use at least 8 characters and no more than 72 UTF-8 bytes for your password.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/auth/${reset ? 'reset-password' : 'forgot-password'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { token, password } : { email: email.trim().toLowerCase() })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to complete request')
      setMessage(data.message)
      if (reset) {
        setDone(true)
        setPassword('')
        setConfirm('')
        setToken('')
        window.history.replaceState(null, '', '/reset-password')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete request')
    } finally { setBusy(false) }
  }

  const input = 'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50'
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 pb-12 pt-28 text-gray-900">
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" aria-labelledby="recovery-title">
      <p className="mb-6 text-center text-xl font-bold text-blue-700">{tr('InstaHire')}</p>
      <h1 id="recovery-title" className="text-center text-2xl font-bold">{tr(reset ? 'Reset your password' : 'Forgot your password?')}</h1>
      <p className="mb-6 mt-2 text-center text-sm text-gray-600">{tr(reset ? 'Choose a new password for your account.' : 'Enter your email and we will send you a password reset link.')}</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{trError(error)}</p>}
      {message && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{tr(message)}</p>}
      {!ready ? <p role="status">{tr('Checking reset link…')}</p> : reset && !token && !done ? <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{tr('This password reset link is invalid or expired. Request a new link.')}</p> : !done && <form onSubmit={submit} className="space-y-5">
        {!reset ? <div>
          <label htmlFor="recovery-email" className="mb-2 block text-sm font-medium">{tr('Email Address')}</label>
          <input id="recovery-email" type="email" autoComplete="email" required maxLength={255} disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className={input} />
        </div> : <>
          <div><label htmlFor="new-password" className="mb-2 block text-sm font-medium">{tr('New password')}</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className={input} aria-describedby="password-help" />
            <p id="password-help" className="mt-2 text-xs text-gray-600">{tr('Use at least 8 characters and no more than 72 UTF-8 bytes for your password.')}</p>
          </div>
          <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">{tr('Confirm new password')}</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={busy} value={confirm} onChange={event => setConfirm(event.target.value)} className={input} />
          </div>
        </>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{tr(busy ? 'Please wait…' : reset ? 'Save new password' : 'Send reset link')}</button>
      </form>}
      {!reset && <p className="mt-4 text-xs text-gray-600">{tr('The link expires in 15 minutes. Wait one minute before requesting another link. If you use Google sign-in, continue with Google on the login page.')}</p>}
      <nav className="mt-6 flex flex-wrap justify-center gap-4 text-sm" aria-label={tr('Account recovery navigation')}>
        <Link href="/login" className="font-medium text-blue-700 hover:underline">{tr('Back to login')}</Link>
        {reset && !done && <Link href="/forgot-password" className="font-medium text-blue-700 hover:underline">{tr('Request a new reset link')}</Link>}
      </nav>
    </section>
  </main>
}
