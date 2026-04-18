'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' }
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [lang, setLang] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem('lang') || i18n.resolvedLanguage || 'en'
    setLang(saved)
    if (i18n.resolvedLanguage !== saved) {
      i18n.changeLanguage(saved)
    }
  }, [i18n])

  const changeLanguage = async (value: string) => {
    setLang(value)
    localStorage.setItem('lang', value)
    await i18n.changeLanguage(value)
  }

  return (
    <select
      value={lang}
      onChange={(e) => changeLanguage(e.target.value)}
      className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none"
      aria-label="Select language"
    >
      {LANGUAGES.map((item) => (
        <option key={item.code} value={item.code}>
          {item.label}
        </option>
      ))}
    </select>
  )
}