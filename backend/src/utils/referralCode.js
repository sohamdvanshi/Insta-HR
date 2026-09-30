const crypto = require('crypto')

const CODE_PREFIX = 'INSTA'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generateRandomPart = (length = 7) => {
  const bytes = crypto.randomBytes(length)
  let result = ''

  for (let index = 0; index < length; index += 1) {
    result += CODE_CHARS[bytes[index] % CODE_CHARS.length]
  }

  return result
}

const generateReferralCode = () => {
  return `${CODE_PREFIX}${generateRandomPart(7)}`
}

module.exports = generateReferralCode