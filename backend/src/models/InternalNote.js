const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const InternalNote = sequelize.define(
  'InternalNote',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    entityType: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    entityId: {
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
    tableName: 'internal_notes',
    timestamps: true
  }
)

module.exports = InternalNote
