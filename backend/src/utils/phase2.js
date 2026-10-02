const crypto = require('crypto')
const staff = user => ['admin', 'super_admin'].includes(user?.role)
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const positiveInt = (value, max = 1000000) => {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n <= 0 || n > max) throw fail('Invalid positive integer')
  return n
}
const key = () => {
  const value = process.env.PAYOUT_ENCRYPTION_KEY || ''
  if (!/^[a-f0-9]{64}$/i.test(value)) throw fail('Payout encryption is not configured', 503)
  return Buffer.from(value, 'hex')
}
const encrypt = (value, userId) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(String(userId)))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map(x => x.toString('base64')).join('.')
}
const decrypt = (value, userId) => {
  const [iv, tag, data] = value.split('.').map(x => Buffer.from(x, 'base64'))
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(String(userId)))
  cipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'))
}
const render = (text, values) => String(text).replace(/\{\{(\w+)\}\}/g, (_, name) => {
  if (!Object.prototype.hasOwnProperty.call(values, name)) throw fail(`Unknown template field: ${name}`)
  return String(values[name] ?? '')
})
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
module.exports = { staff, fail, positiveInt, encrypt, decrypt, render, escapeHtml }
