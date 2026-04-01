'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window { Razorpay: any }
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '₹0',
    period: 'forever',
    color: 'gray',
    badge: '',
    features: [
      '3 job postings/month',
      'Basic candidate search',
      'Standard support',
      '5 resume views/month',
    ],
    missing: [
      'AI resume screening',
      'Featured listings',
      'Bulk email',
      'Priority support',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 1999,
    priceLabel: '₹1,999',
    period: '/month',
    color: 'blue',
    badge: 'Popular',
    features: [
      'Unlimited job postings',
      'Resume database access',
      'Basic AI screening',
      '100 resume views/month',
      'Email support',
      'Application analytics',
    ],
    missing: [
      'Featured listings',
      'Priority candidate reach',
      'Social promotion',
    ],
    cta: 'Get Standard',
    disabled: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 3999,
    priceLabel: '₹3,999',
    period: '/month',
    color: 'purple',
    badge: 'Best Value',
    features: [
      'Everything in Standard',
      'Featured job listings',
      'AI resume ranking',
      'Unlimited resume views',
      'Priority candidate reach',
      'Social promotion',
      'Dedicated support',
      'Custom branding',
    ],
    missing: [],
    cta: 'Get Premium',
    disabled: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    priceLabel: '₹9,999',
    period: '/month',
    color: 'gold',
    badge: 'Enterprise',
    features: [
      'Everything in Premium',
      'Job branding campaigns',
      'Social media promotion',
      'Recruitment support team',
      'Custom AI matching',
      'Bulk hiring tools',
      'Account manager',
      'API access',
    ],
    missing: [],
    cta: 'Get Enterprise',
    disabled: false,
  },
];

export default function SubscriptionPage() {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState('free')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) setUser(JSON.parse(userData))
    loadRazorpay()
    fetchSubscription()
  }, [])

  const loadRazorpay = () => {
    return new Promise(resolve => {
      if (window.Razorpay) { resolve(true); return }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const fetchSubscription = async () => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch('http://localhost:5000/api/v1/payments/subscription', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) {
        setCurrentPlan(data.data.plan)
        setExpiresAt(data.data.expiresAt)
      }
    } catch {}
    setLoading(false)
  }

  const fetchHistory = async () => {
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('http://localhost:5000/api/v1/payments/history', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (data.success) setPaymentHistory(data.data)
    } catch {}
    setShowHistory(true)
  }

  const handleSubscribe = async (planId: string) => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    if (user?.role !== 'employer') {
      alert('Only employers can subscribe to plans. Please login as an employer.')
      return
    }

    setProcessingPlan(planId)
    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch('http://localhost:5000/api/v1/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ plan: planId })
      })
      const orderData = await orderRes.json()
      if (!orderData.success) {
        alert(orderData.message || 'Failed to create order')
        setProcessingPlan(null)
        return
      }

      // Step 2: Open Razorpay checkout
      await loadRazorpay()
      const options = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'InstaHire',
        description: orderData.plan.name,
        image: '/logo.png',
        order_id: orderData.order.id,
        handler: async (response: any) => {
          // Step 3: Verify payment
          const verifyRes = await fetch('http://localhost:5000/api/v1/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
            })
          })
          const verifyData = await verifyRes.json()
          if (verifyData.success) {
            setCurrentPlan(planId)
            setExpiresAt(verifyData.expiresAt)
            alert('🎉 Payment successful! Your ' + planId + ' plan is now active.')
          } else {
            alert('Payment verification failed. Please contact support.')
          }
          setProcessingPlan(null)
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: { color: '#2563EB' },
        modal: {
          ondismiss: () => setProcessingPlan(null)
        }
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert('Something went wrong. Please try again.')
      setProcessingPlan(null)
    }
  }

  const colorMap: any = {
    gray: { card: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', btn: 'bg-gray-300 text-gray-500 cursor-not-allowed', header: 'bg-gray-50' },
    blue: { card: 'border-blue-400 shadow-blue-100 shadow-lg', badge: 'bg-blue-600 text-white', btn: 'bg-blue-600 hover:bg-blue-700 text-white', header: 'bg-blue-50' },
    purple: { card: 'border-purple-400 shadow-purple-100 shadow-lg', badge: 'bg-purple-600 text-white', btn: 'bg-purple-600 hover:bg-purple-700 text-white', header: 'bg-purple-50' },
    gold: { card: 'border-yellow-400 shadow-yellow-100 shadow-lg', badge: 'bg-yellow-500 text-white', btn: 'bg-yellow-500 hover:bg-yellow-600 text-white', header: 'bg-yellow-50' },
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16 px-6 text-center">
        <h1 className="text-4xl font-bold mb-3">Simple, Transparent Pricing</h1>
        <p className="text-blue-100 text-lg max-w-xl mx-auto">Choose the plan that fits your hiring needs. Upgrade or cancel anytime.</p>
        {currentPlan !== 'free' && expiresAt && (
          <div className="mt-4 inline-block bg-white/20 rounded-xl px-6 py-3">
            <p className="text-sm">Active Plan: <span className="font-bold capitalize">{currentPlan}</span> — Expires {new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map(plan => {
            const colors = colorMap[plan.color]
            const isCurrent = currentPlan === plan.id
            const isProcessing = processingPlan === plan.id

            return (
              <div key={plan.id}
                className={"relative bg-white rounded-2xl border-2 p-6 flex flex-col " + colors.card + (isCurrent ? ' ring-2 ring-green-400' : '')}>

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ✓ Active Plan
                  </div>
                )}

                {/* Popular badge */}
                {plan.badge && !isCurrent && (
                  <div className={"absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full " + colors.badge}>
                    {plan.badge}
                  </div>
                )}

                <div className={"rounded-xl p-4 mb-4 " + colors.header}>
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.priceLabel}</span>
                    <span className="text-gray-500 text-sm mb-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                  {plan.missing.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400 line-through">
                      <span className="mt-0.5 flex-shrink-0">✗</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !plan.disabled && !isCurrent && handleSubscribe(plan.id)}
                  disabled={plan.disabled || isCurrent || isProcessing}
                  className={"w-full py-3 rounded-xl font-bold text-sm transition-colors " + (isCurrent ? 'bg-green-100 text-green-700 cursor-default' : plan.disabled ? colors.btn : colors.btn) + " disabled:opacity-60"}>
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Processing...
                    </span>
                  ) : isCurrent ? '✓ Current Plan' : plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Full Feature Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-4 font-semibold text-gray-700">Feature</th>
                  <th className="text-center p-4 font-semibold text-gray-500">Free</th>
                  <th className="text-center p-4 font-semibold text-blue-600">Standard</th>
                  <th className="text-center p-4 font-semibold text-purple-600">Premium</th>
                  <th className="text-center p-4 font-semibold text-yellow-600">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Job Postings', '3/month', 'Unlimited', 'Unlimited', 'Unlimited'],
                  ['Resume Views', '5/month', '100/month', 'Unlimited', 'Unlimited'],
                  ['AI Screening', '✗', 'Basic', 'Advanced', 'Custom'],
                  ['Featured Listings', '✗', '✗', '✓', '✓'],
                  ['Social Promotion', '✗', '✗', '✓', '✓'],
                  ['Dedicated Support', '✗', '✗', '✓', '✓'],
                  ['Account Manager', '✗', '✗', '✗', '✓'],
                  ['API Access', '✗', '✗', '✗', '✓'],
                ].map(([feature, ...vals]) => (
                  <tr key={feature} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-700 font-medium">{feature}</td>
                    {vals.map((val, i) => (
                      <td key={i} className="p-4 text-center">
                        <span className={val === '✗' ? 'text-gray-300 text-lg' : val === '✓' ? 'text-green-500 text-lg font-bold' : 'text-gray-700'}>
                          {val}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        {user?.role === 'employer' && (
          <div className="mt-8 text-center">
            <button onClick={showHistory ? () => setShowHistory(false) : fetchHistory}
              className="text-blue-600 font-medium hover:underline text-sm">
              {showHistory ? 'Hide' : 'View'} Payment History
            </button>

            {showHistory && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden text-left">
                <div className="p-4 border-b border-gray-100 font-bold text-gray-900">Payment History</div>
                {paymentHistory.length === 0 ? (
                  <p className="p-6 text-gray-400 text-center">No payments yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-4 text-left text-gray-600">Plan</th>
                        <th className="p-4 text-left text-gray-600">Amount</th>
                        <th className="p-4 text-left text-gray-600">Status</th>
                        <th className="p-4 text-left text-gray-600">Date</th>
                        <th className="p-4 text-left text-gray-600">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paymentHistory.map((p: any) => (
                        <tr key={p.id}>
                          <td className="p-4 capitalize font-medium text-gray-900">{p.planName}</td>
                          <td className="p-4 text-gray-700">₹{p.amount.toLocaleString()}</td>
                          <td className="p-4">
                            <span className={"px-2 py-1 rounded-full text-xs font-bold " + (p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-gray-500">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="p-4 text-gray-500">{new Date(p.expiresAt).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-12 grid grid-cols-3 gap-6 text-center">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl mb-2">🔒</div>
            <p className="font-semibold text-gray-900 text-sm">Secure Payments</p>
            <p className="text-xs text-gray-500">256-bit SSL encryption via Razorpay</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl mb-2">🔄</div>
            <p className="font-semibold text-gray-900 text-sm">Cancel Anytime</p>
            <p className="text-xs text-gray-500">No long-term contracts or commitments</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl mb-2">📞</div>
            <p className="font-semibold text-gray-900 text-sm">24/7 Support</p>
            <p className="text-xs text-gray-500">Our team is always here to help</p>
          </div>
        </div>
      </div>
    </main>
  )
}
