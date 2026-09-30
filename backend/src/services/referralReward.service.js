const {
  sequelize,
  Application,
  LoyaltyPointTransaction
} = require('../models')

const DEFAULT_REFERRAL_REWARD_POINTS = 100

const finishOwnTransaction = async (transaction, shouldCommit) => {
  if (!shouldCommit || !transaction) return
  await transaction.commit()
}

const awardReferralReward = async ({
  applicationId,
  transaction = null,
  points = DEFAULT_REFERRAL_REWARD_POINTS,
  createdBy = null,
  reason = 'Referral bonus for hired candidate'
}) => {
  let ownTransaction = false
  let completed = false
  const rewardPoints = Number(points)

  try {
    if (!applicationId) {
      const error = new Error('applicationId is required')
      error.statusCode = 400
      throw error
    }

    if (!Number.isInteger(rewardPoints) || rewardPoints <= 0) {
      const error = new Error(
        'Referral reward points must be a positive integer'
      )
      error.statusCode = 400
      throw error
    }

    if (!transaction) {
      transaction = await sequelize.transaction()
      ownTransaction = true
    }

    const application = await Application.findByPk(applicationId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    })

    if (!application) {
      const error = new Error('Application not found')
      error.statusCode = 404
      throw error
    }

    if (application.status !== 'hired') {
      await finishOwnTransaction(transaction, ownTransaction)
      completed = ownTransaction

      return {
        rewarded: false,
        alreadyRewarded: false,
        points: 0,
        reason: 'Application is not hired',
        application
      }
    }

    if (!application.referredByUserId) {
      await finishOwnTransaction(transaction, ownTransaction)
      completed = ownTransaction

      return {
        rewarded: false,
        alreadyRewarded: false,
        points: 0,
        reason: 'Application has no referrer',
        application
      }
    }

    const existingTransaction =
      await LoyaltyPointTransaction.findOne({
        where: {
          applicationId: application.id,
          type: 'earned'
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      })

    if (existingTransaction || application.referralRewarded) {
      const existingPoints = Number(
        existingTransaction?.points ||
          application.referralRewardPoints ||
          rewardPoints
      )

      if (!application.referralRewarded || !application.referralRewardedAt) {
        await application.update(
          {
            referralRewarded: true,
            referralRewardedAt:
              application.referralRewardedAt || new Date(),
            referralRewardPoints: existingPoints
          },
          { transaction }
        )
      }

      await finishOwnTransaction(transaction, ownTransaction)
      completed = ownTransaction

      return {
        rewarded: false,
        alreadyRewarded: true,
        points: existingPoints,
        reason: 'Referral reward already exists',
        transaction: existingTransaction,
        application
      }
    }

    const rewardTransaction =
      await LoyaltyPointTransaction.create(
        {
          userId: application.referredByUserId,
          applicationId: application.id,
          referralId: null,
          points: rewardPoints,
          type: 'earned',
          reason,
          createdBy
        },
        { transaction }
      )

    await application.update(
      {
        referralRewarded: true,
        referralRewardedAt: new Date(),
        referralRewardPoints: rewardPoints
      },
      { transaction }
    )

    await finishOwnTransaction(transaction, ownTransaction)
    completed = ownTransaction

    return {
      rewarded: true,
      alreadyRewarded: false,
      points: rewardPoints,
      reason: 'Referral reward awarded successfully',
      transaction: rewardTransaction,
      application
    }
  } catch (error) {
    if (ownTransaction && transaction && !completed) {
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        console.error(
          'Referral reward rollback failed:',
          rollbackError.message
        )
      }
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      const existingTransaction =
        await LoyaltyPointTransaction.findOne({
          where: {
            applicationId,
            type: 'earned'
          }
        })

      return {
        rewarded: false,
        alreadyRewarded: true,
        points: Number(existingTransaction?.points || 0),
        reason: 'Referral reward already exists',
        transaction: existingTransaction
      }
    }

    throw error
  }
}

const getReferralRewardStatus = async (applicationId) => {
  const application = await Application.findByPk(applicationId, {
    attributes: [
      'id',
      'status',
      'referredByUserId',
      'referralRewarded',
      'referralRewardedAt',
      'referralRewardPoints'
    ]
  })

  if (!application) return null

  const transaction = await LoyaltyPointTransaction.findOne({
    where: {
      applicationId,
      type: 'earned'
    }
  })

  return {
    applicationId: application.id,
    applicationStatus: application.status,
    referredByUserId: application.referredByUserId || null,
    rewarded: Boolean(application.referralRewarded || transaction),
    points: Number(
      application.referralRewardPoints ||
        transaction?.points ||
        0
    ),
    rewardedAt:
      application.referralRewardedAt ||
      transaction?.createdAt ||
      null,
    transaction
  }
}

module.exports = {
  DEFAULT_REFERRAL_REWARD_POINTS,
  awardReferralReward,
  getReferralRewardStatus
}