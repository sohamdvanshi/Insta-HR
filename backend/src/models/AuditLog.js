const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    actorRole: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    targetUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('success', 'failure'),
      allowNull: false,
      defaultValue: 'success',
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    indexes: [
      { fields: ['actorId'] },
      { fields: ['action'] },
      { fields: ['entityType'] },
      { fields: ['entityId'] },
      { fields: ['targetUserId'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = AuditLog;