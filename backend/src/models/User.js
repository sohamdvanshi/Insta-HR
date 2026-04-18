const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  authProvider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'local'
  },
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('candidate', 'employer', 'admin'),
    defaultValue: 'candidate'
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  otp: {
    type: DataTypes.STRING
  },
  otpExpiry: {
    type: DataTypes.DATE
  },
  lastLogin: {
    type: DataTypes.DATE
  },
  subscriptionExpiry: {
    type: DataTypes.DATE,
  },
  subscriptionPlan: {
    type: DataTypes.STRING,
    allowNull: true
  },
  subscriptionReminder7Sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  subscriptionReminder1Sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  subscriptionExpiredMailSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['phone'],
      where: {
        phone: {
          [Op.ne]: null
        }
      }
    },
    {
      unique: true,
      fields: ['googleId'],
      where: {
        googleId: {
          [Op.ne]: null
        }
      }
    }
  ]
});

User.prototype.comparePassword = async function(password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

module.exports = User;