'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en/common.json'
import hi from './locales/hi/common.json'
import mr from './locales/mr/common.json'

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { common: en },
      hi: { common: hi },
      mr: { common: mr }
    },
    lng: typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'mr'],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false
    }
  })
}

export default i18n