import entries from './source-index.json'

export const sourceIndex: Record<string, { ns: string; key: string }> = entries
export const templateIndex = Object.entries(sourceIndex).filter(([value]) => value.includes('{{')).map(([value, entry]) => {
  const names: string[] = []
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let last = 0, pattern = '^'
  for (const match of value.matchAll(/{{(\w+)}}/g)) {
    pattern += escape(value.slice(last, match.index)) + '(.+?)'
    names.push(match[1]); last = (match.index || 0) + match[0].length
  }
  pattern += escape(value.slice(last)) + '$'
  return { ...entry, names, pattern: new RegExp(pattern) }
})
