'use strict';
// Additive and rerunnable. No existing payments, registers or loyalty entries are removed.
module.exports = { async up(q, S) {
  await q.sequelize.transaction(async transaction => {
    const o = { transaction };
    const add = async (table, fields) => {
      const columns = await q.describeTable(table, o);
      for (const [name, definition] of Object.entries(fields)) if (!columns[name]) await q.addColumn(table, name, definition, o);
      return columns;
    };
    const plans = await add('subscription_plans', {
      yearlyAmountPaise: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      loyaltyPoints: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      featuredJobs: { type: S.BOOLEAN, allowNull: false, defaultValue: false }
    });
    // Set defaults only on first migration. Reruns preserve administrator edits.
    if (!plans.yearlyAmountPaise) await q.sequelize.query('UPDATE subscription_plans SET "yearlyAmountPaise" = LEAST("amountPaise"::bigint * 12, 100000000)', o);
    if (!plans.loyaltyPoints) await q.sequelize.query(`UPDATE subscription_plans SET "loyaltyPoints" = 1000 WHERE id = 'premium'`, o);
    if (!plans.featuredJobs) await q.sequelize.query(`UPDATE subscription_plans SET "featuredJobs" = true WHERE id IN ('premium', 'enterprise')`, o);
    await add('Payments', { billingCycle: { type: S.STRING(10), allowNull: false, defaultValue: 'monthly' }, invoiceSnapshot: { type: S.JSONB, allowNull: true } });
    await add('invoices', { invoiceSnapshot: { type: S.JSONB, allowNull: true } });
    await add('wage_registers', { submittedAt: { type: S.DATE, allowNull: true }, reviewedAt: { type: S.DATE, allowNull: true }, reviewedBy: { type: S.UUID, allowNull: true }, reviewNotes: { type: S.TEXT, allowNull: true } });
    await add('loyalty_point_transactions', { redemptionKey: { type: S.UUID, allowNull: true }, redemptionDetails: { type: S.JSONB, allowNull: true } });
    const indexes = await q.showIndex('loyalty_point_transactions', o);
    if (!indexes.some(i => i.name === 'loyalty_redemption_request_unique')) await q.addIndex('loyalty_point_transactions', ['userId', 'redemptionKey'], { ...o, unique: true, name: 'loyalty_redemption_request_unique' });
  });
}, async down() { throw new Error('Business records must be preserved. Restore a backup for rollback.'); } };
