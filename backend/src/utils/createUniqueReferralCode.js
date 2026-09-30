const generateReferralCode = require('./referralCode')
const { User } = require('../models')

const createUniqueReferralCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const referralCode = generateReferralCode()

    const existingUser = await User.findOne({
      where: { referralCode },
      attributes: ['id']
    })

    if (!existingUser) {
      return referralCode
    }
  }

  throw new Error(
    'Could not generate a unique referral code'
  )
}

module.exports = createUniqueReferralCode