'use client'

import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { sourceIndex, templateIndex } from '@/locales/source-index'

export const LANGUAGES = ['en', 'hi', 'mr'] as const
export type Language = typeof LANGUAGES[number]
export const validLanguage = (value: unknown): value is Language => typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
export const locale = () => ({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[i18n.resolvedLanguage as Language] || 'en-IN')

/** Lookup app-authored presentation copy. Unknown text and user content remain intact. */
export function tr(value: unknown, variables?: Record<string, unknown>): string {
  if (value === null || value === undefined) return ''
  const raw = String(value), normalized = raw.trim().replace(/\s+/g, ' ')
  const entry = Object.prototype.hasOwnProperty.call(sourceIndex, normalized) ? sourceIndex[normalized] : Object.prototype.hasOwnProperty.call(sourceIndex, normalized.toLowerCase()) ? sourceIndex[normalized.toLowerCase()] : undefined
  if (entry) return raw.replace(raw.trim(), String(i18n.t(entry.key, { ns: entry.ns, ...variables })))
  // Labels often add a colon, bullet or ellipsis around an existing message.
  const match = normalized.match(/^([+•✓📅📍🎉]?\s*)(.*?)([:…]|\.\.\.)?$/u)
  if (match && match[2] && Object.prototype.hasOwnProperty.call(sourceIndex, match[2])) return `${match[1]}${tr(match[2], variables)}${match[3] || ''}`
  const notices = normalized.match(/^(.*?) Emails sent: (\d+)\. Failed: (\d+)\.(.*)$/)
  if (notices && Object.prototype.hasOwnProperty.call(sourceIndex, notices[1])) return tr(notices[1]) + ' ' + tr('Emails sent: {{value0}}. Failed: {{value1}}.{{value2}}', { value0: notices[2], value1: notices[3], value2: notices[4] ? ' ' + tr(notices[4].trim()) : '' })
  for (const template of normalized.length <= 4000 ? templateIndex : []) {
    const result = template.pattern.exec(normalized)
    if (result) return String(i18n.t(template.key, { ns: template.ns, ...Object.fromEntries(template.names.map((name, index) => [name, result[index + 1]])), ...variables }))
  }
  return raw
}

/** React subscription: language changes update labels without remounting forms. */
export function useLocale() {
  const { i18n: instance } = useTranslation()
  return { language: instance.resolvedLanguage as Language || 'en', locale: locale(), tr }
}

/** Known application errors keep their detail; unexpected technical errors use safe localized copy. */
export function trError(value: unknown): string {
  if (!value) return ''
  const raw = String(value), normalized = raw.trim().replace(/\s+/g, ' ')
  const known = Object.prototype.hasOwnProperty.call(sourceIndex, normalized) || (normalized.length <= 4000 && templateIndex.some(template => template.pattern.test(normalized)))
  return known ? tr(raw) : tr('Unable to complete request')
}
