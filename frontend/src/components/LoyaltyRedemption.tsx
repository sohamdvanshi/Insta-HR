'use client'
import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/lib/api'
import { tr, trError, useLocale, locale } from '@/lib/localization'
export default function LoyaltyRedemption({ onRedeemed }: { onRedeemed?: () => void }) {
  useLocale()
  const [data, setData] = useState<{ balance: number; plans: {id:string;name:string;points:number;durationDays:number}[] }>()
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef<{plan:string;id:string} | null>(null)
  const headers = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token'), 'Content-Type': 'application/json' })
  async function load() {
    const res = await fetch(API_BASE + '/referrals/redemption-options', { headers: headers() }); const json = await res.json()
    if (!res.ok) throw new Error(json.message || 'Unable to load rewards')
    setData(json.data)
  }
  useEffect(() => { void load().catch(e => setError(e.message)) }, [])
  async function redeem(plan:string) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    if (!request.current || request.current.plan !== plan) request.current = {plan,id:crypto.randomUUID()}
    try {
      const res = await fetch(API_BASE + '/referrals/redeem', {method:'POST',headers:headers(),body:JSON.stringify({plan,requestId:request.current.id})})
      const json = await res.json(); if (!res.ok) { if (res.status < 500) request.current=null; throw new Error(json.message || 'Redemption failed') }
      request.current=null
      setMessage(tr('Subscription activated until {{value0}}', {value0:new Date(json.data.expiresAt).toLocaleDateString(locale())}))
      await load(); onRedeemed?.()
    } catch(e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="my-6 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{tr('Redeem loyalty points')}</h2>{error && <p role="alert" className="text-red-700">{trError(error)}</p>}{message && <p role="status" className="text-green-700">{message}</p>}{data && <><p className="my-3">{tr('Available points')}: {data.balance.toLocaleString(locale())}</p>{data.plans.map(plan=><div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3"><p>{plan.name} · {tr('{{value0}} points for {{value1}} days', {value0:plan.points,value1:plan.durationDays})}</p><button disabled={busy || data.balance < plan.points} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" onClick={()=>void redeem(plan.id)}>{tr('Redeem')}</button></div>)}{!data.plans.length && <p>{tr('No rewards are available right now.')}</p>}</>}</section>
}
