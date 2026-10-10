'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './locales/resources'

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    // Server output and the first browser render agree; saved selection is applied after hydration.
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'mr'],
    defaultNS: 'common',
    ns: ['common', 'jobs', 'auth', 'dashboard', 'payroll', 'training', 'resume', 'subscription', 'admin', 'errors'],
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false }, // React renders strings safely; never insert translated HTML.
    react: { useSuspense: false }
  })
}

export default i18n
