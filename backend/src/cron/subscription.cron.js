const cron = require('node-cron');
const { Op } = require('sequelize');
const { User } = require('../models');
const {
  sendSubscriptionReminder7Days,
  sendSubscriptionReminder1Day,
  sendSubscriptionExpiredEmail
} = require('../services/email/emailService');

const startSubscriptionCron = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('⏰ Running subscription cron job...');

      const now = new Date();

      const startOf7thDay = new Date();
      startOf7thDay.setDate(now.getDate() + 7);
      startOf7thDay.setHours(0, 0, 0, 0);

      const endOf7thDay = new Date(startOf7thDay);
      endOf7thDay.setHours(23, 59, 59, 999);

      const startOfTomorrow = new Date();
      startOfTomorrow.setDate(now.getDate() + 1);
      startOfTomorrow.setHours(0, 0, 0, 0);

      const endOfTomorrow = new Date(startOfTomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);

      const users7Days = await User.findAll({
        where: {
          role: 'employer',
          subscriptionPlan: { [Op.ne]: 'free' },
          subscriptionExpiry: {
            [Op.between]: [startOf7thDay, endOf7thDay]
          },
          subscriptionReminder7Sent: false
        }
      });

      for (const user of users7Days) {
        try {
          await sendSubscriptionReminder7Days(user);
          await user.update({ subscriptionReminder7Sent: true });
          console.log(`✅ 7-day reminder sent to ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed 7-day reminder for ${user.email}:`, error.message);
        }
      }

      const users1Day = await User.findAll({
        where: {
          role: 'employer',
          subscriptionPlan: { [Op.ne]: 'free' },
          subscriptionExpiry: {
            [Op.between]: [startOfTomorrow, endOfTomorrow]
          },
          subscriptionReminder1Sent: false
        }
      });

      for (const user of users1Day) {
        try {
          await sendSubscriptionReminder1Day(user);
          await user.update({ subscriptionReminder1Sent: true });
          console.log(`✅ 1-day reminder sent to ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed 1-day reminder for ${user.email}:`, error.message);
        }
      }

      const expiredUsers = await User.findAll({
        where: {
          role: 'employer',
          subscriptionPlan: { [Op.ne]: 'free' },
          subscriptionExpiry: {
            [Op.lt]: now
          }
        }
      });

      for (const user of expiredUsers) {
        try {
          if (!user.subscriptionExpiredMailSent) {
            await sendSubscriptionExpiredEmail(user);
          }

          await user.update({
            subscriptionPlan: 'free',
            subscriptionExpiry: null,
            subscriptionExpiredMailSent: true
          });

          console.log(`✅ Expired subscription downgraded for ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed expired subscription handling for ${user.email}:`, error.message);
        }
      }

      console.log('✅ Subscription cron completed');
    } catch (error) {
      console.error('❌ Subscription cron failed:', error.message);
    }
  });
};

module.exports = { startSubscriptionCron };