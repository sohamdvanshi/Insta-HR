const fs = require('node:fs'), path = require('node:path')
const root = path.resolve(__dirname, '../src/locales')
const namespaces = ['common', 'jobs', 'auth', 'dashboard', 'payroll', 'training', 'resume', 'subscription', 'admin', 'errors']
const normalize = value => value.trim().replace(/\s+/g, ' ')
const entries = Object.create(null)
for (const ns of namespaces) {
  const en = JSON.parse(fs.readFileSync(path.join(root, 'en', `${ns}.json`)))
  for (const [key, value] of Object.entries(en)) {
    if (/_(one|other)$/.test(key)) continue
    entries[normalize(key)] ||= { ns, key }
    entries[normalize(value)] ||= { ns, key }
  }
}
for (const raw of ['candidate', 'employer', 'trainer', 'admin', 'super_admin', 'draft', 'active', 'closed', 'pending', 'open', 'in_progress', 'resolved', 'cancelled', 'completed', 'scheduled', 'present', 'absent', 'late', 'excused', 'full-time', 'part-time', 'contract', 'internship', 'remote', 'permanent', 'temporary', 'project', 'physical', 'online', 'low', 'medium', 'high', 'urgent', 'support', 'operations', 'fraud', 'general', 'unassigned', 'created', 'success', 'failed', 'paid', 'unpaid', 'processing', 'approved', 'rejected', 'shortlisted', 'hired', 'interviewed', 'deployed', 'free', 'standard', 'premium', 'enterprise']) {
  if (entries[raw]) for (const alias of [raw.toUpperCase(), raw.replaceAll('_', ' '), raw.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())]) entries[alias] ||= entries[raw]
}
for (const [key, entry] of Object.entries(entries)) {
  entries[key.toLowerCase()] ||= entry
  if (/^[a-z]+(?:[_-][a-z]+)*$/.test(key)) {
    entries[key.replaceAll('_', ' ')] ||= entry
    entries[key.toUpperCase()] ||= entry
  }
}
entries['Job results'] = { ns: 'jobs', key: 'Job results' }
fs.writeFileSync(path.join(root, 'source-index.json'), JSON.stringify(entries, null, 2) + '\n')
console.log(`Indexed ${Object.keys(entries).length} translations across ${namespaces.length} namespaces.`)
