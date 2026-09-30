const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const InternalMessage = sequelize.define(
  'InternalMessage',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    threadId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 10000]
      }
    }
  },
  {
    tableName: 'internal_messages',
    timestamps: true
  }
)

module.exports = InternalMessage
