'use client'

import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { usePathname } from 'next/navigation'
import i18n from '@/i18n'
import { tr } from '@/lib/localization'
import { validationMessage, type ValidationControl } from '@/lib/formValidation'

const supported = (value: string | null) => value && ['en', 'hi', 'mr'].includes(value) ? value : 'en'

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useEffect(() => {
    const sections: Record<string, string> = { jobs: 'Jobs', login: 'Login', register: 'Create Account', auth: 'Verify Email', 'verify-otp': 'Verify Email', dashboard: 'Dashboard', employer: 'Employer Dashboard', trainer: 'Training workspace', training: 'Training', admin: 'Admin dashboard', 'super-admin': 'Super admin dashboard', resume: 'Resume Builder', subscription: 'Subscription plan', profile: 'My Profile', applications: 'Applications', referrals: 'Referrals & Loyalty', 'saved-jobs': 'Saved Jobs' }
    const updateTitle = () => { document.title = `${tr(sections[pathname.split('/')[1]] || 'InstaHire - AI Powered Job Portal')} | Insta-HR` }
    updateTitle()
    i18n.on('languageChanged', updateTitle)
    return () => { i18n.off('languageChanged', updateTitle) }
  }, [pathname])
  useEffect(() => {
    const marked = new Set<ValidationControl>()
    const isControl = (value: EventTarget | null): value is ValidationControl => value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement
    const localizeInvalid = (control: ValidationControl) => {
      if (control.validity.customError && !marked.has(control)) return
      control.setCustomValidity('')
      const message = validationMessage(control)
      if (message) { control.setCustomValidity(tr(message.key, message.values)); marked.add(control) }
    }
    const invalid = (event: Event) => { if (isControl(event.target)) localizeInvalid(event.target) }
    const clear = (event: Event) => { if (isControl(event.target) && marked.has(event.target)) { event.target.setCustomValidity(''); marked.delete(event.target) } }
    document.addEventListener('invalid', invalid, true)
    document.addEventListener('input', clear, true)
    document.addEventListener('change', clear, true)
    const updateDocument = (language: string) => {
      document.documentElement.lang = supported(language)
      document.documentElement.dir = 'ltr'
      for (const control of marked) { if (control.isConnected) localizeInvalid(control); else marked.delete(control) }
    }
    const restore = () => {
      let language = 'en'
      try { language = supported(localStorage.getItem('lang')) } catch { /* Storage may be disabled. */ }
      void i18n.changeLanguage(language)
      updateDocument(language)
    }
    const sync = (event: StorageEvent) => { if (event.key === 'lang' || event.key === null) restore() }
    restore()
    i18n.on('languageChanged', updateDocument)
    window.addEventListener('storage', sync)
    return () => { i18n.off('languageChanged', updateDocument); window.removeEventListener('storage', sync); document.removeEventListener('invalid', invalid, true); document.removeEventListener('input', clear, true); document.removeEventListener('change', clear, true); for (const control of marked) control.setCustomValidity('') }
  }, [])
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
