const {
  DataTypes,
  Op
} = require('sequelize')

const sequelize = require(
  '../config/database'
)

const LoyaltyPointTransaction =
  sequelize.define(
    'LoyaltyPointTransaction',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },

      userId: {
        type: DataTypes.UUID,
        allowNull: false
      },

      referralId: {
        type: DataTypes.UUID,
        allowNull: true
      },

      applicationId: {
        type: DataTypes.UUID,
        allowNull: true
      },

      points: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: {
            msg: 'Points are required'
          },
          isInt: {
            msg: 'Points must be an integer'
          }
        }
      },

      type: {
        type: DataTypes.ENUM(
          'earned',
          'reversed',
          'adjusted',
          'redeemed'
        ),
        allowNull: false,
        validate: {
          isIn: {
            args: [[
              'earned',
              'reversed',
              'adjusted',
              'redeemed'
            ]],
            msg: 'Invalid loyalty transaction type'
          }
        }
      },

      reason: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: 'Transaction reason is required'
          }
        }
      },

      createdBy: {
        type: DataTypes.UUID,
        allowNull: true
      }
    },
    {
      tableName:
        'loyalty_point_transactions',

      timestamps: true,

      indexes: [
        {
          name:
            'loyalty_transactions_user_id_idx',
          fields: ['userId']
        },

        {
          name:
            'loyalty_transactions_referral_id_idx',
          fields: ['referralId']
        },

        {
          name:
            'loyalty_transactions_application_id_idx',
          fields: ['applicationId']
        },

        {
          name:
            'loyalty_transactions_type_idx',
          fields: ['type']
        },

        {
          name:
            'loyalty_transactions_unique_earned_application',
          unique: true,
          fields: [
            'applicationId',
            'type'
          ],
          where: {
            applicationId: {
              [Op.ne]: null
            },
            type: 'earned'
          }
        }
      ]
    }
  )

module.exports =
  LoyaltyPointTransaction