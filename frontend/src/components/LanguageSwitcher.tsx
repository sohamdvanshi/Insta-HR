'use client'

import { useLocale, validLanguage, tr } from '@/lib/localization'
import i18n from '@/i18n'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' }
]

export default function LanguageSwitcher() {
  const { language } = useLocale()
  const changeLanguage = async (value: string) => {
    if (!validLanguage(value)) return
    await i18n.changeLanguage(value)
    try { localStorage.setItem('lang', value) } catch { /* Switching still works in memory. */ }
  }
  return <select value={language} onChange={event => void changeLanguage(event.target.value)}
    className="max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    aria-label={tr('Select language')}>
    {LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
  </select>
}
