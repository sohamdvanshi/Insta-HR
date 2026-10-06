'use strict';
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const options = { transaction }, tables = await q.showAllTables(options);
      if (!tables.includes('training_batches')) throw new Error('Run migrate:phase5 before Phase 6');
      if (!tables.includes('admin_phase6_migrations')) await q.createTable('admin_phase6_migrations', { name: { type: S.STRING, primaryKey: true }, createdAt: { type: S.DATE, allowNull: false } }, options);
      const [applied] = await q.sequelize.query("SELECT name FROM admin_phase6_migrations WHERE name = '20261005000100'", options);
      if (applied.length) return;
      const timestamps = () => ({ createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false } });
      const primary = () => ({ type: S.UUID, primaryKey: true, allowNull: false });
      if (!tables.includes('subscription_plans')) {
        await q.createTable('subscription_plans', {
          id: { type: S.STRING(30), primaryKey: true }, name: { type: S.STRING(100), allowNull: false }, amountPaise: { type: S.INTEGER, allowNull: false }, currency: { type: S.STRING(3), allowNull: false, defaultValue: 'INR' }, durationDays: { type: S.INTEGER, allowNull: false, defaultValue: 30 }, features: { type: S.JSON, allowNull: false, defaultValue: [] }, isActive: { type: S.BOOLEAN, allowNull: false, defaultValue: true }, ...timestamps()
        }, options);
        const defaults = [
          ['free', 'Free', 0, ['3 job postings/month', 'Basic candidate search', 'Standard support', '5 resume views/month']],
          ['standard', 'Standard', 199900, ['Unlimited job postings', 'Resume database access', 'Basic AI screening', '100 resume views/month', 'Email support', 'Application analytics']],
          ['premium', 'Premium', 399900, ['Everything in Standard', 'Featured job listings', 'AI resume ranking', 'Unlimited resume views', 'Priority candidate reach', 'Social promotion', 'Dedicated support', 'Custom branding']],
          ['enterprise', 'Enterprise', 999900, ['Everything in Premium', 'Job branding campaigns', 'Social media promotion', 'Recruitment support team', 'Custom AI matching', 'Bulk hiring tools', 'Account manager', 'API access']]
        ];
        await q.bulkInsert('subscription_plans', defaults.map(([id, name, amountPaise, features]) => ({ id, name, amountPaise, features: JSON.stringify(features), currency: 'INR', durationDays: 30, isActive: true, createdAt: new Date(), updatedAt: new Date() })), options);
      }
      if (!tables.includes('feature_flags')) {
        await q.createTable('feature_flags', { key: { type: S.STRING(50), primaryKey: true }, enabled: { type: S.BOOLEAN, allowNull: false, defaultValue: true }, ...timestamps() }, options);
        await q.bulkInsert('feature_flags', ['training', 'ai_screening', 'referrals', 'bulk_email'].map(key => ({ key, enabled: true, createdAt: new Date(), updatedAt: new Date() })), options);
      }
      const paymentColumns = await q.describeTable('Payments', options);
      if (!paymentColumns.planDurationDays) await q.addColumn('Payments', 'planDurationDays', { type: S.INTEGER, allowNull: true }, options);
      // Some earlier installations have the models but never created these tables.
      if (!tables.includes('internal_threads')) await q.createTable('internal_threads', {
        id: primary(), subject: { type: S.STRING(200), allowNull: false }, category: { type: S.STRING(40), allowNull: false, defaultValue: 'general' }, priority: { type: S.STRING(20), allowNull: false, defaultValue: 'normal' }, status: { type: S.STRING(20), allowNull: false, defaultValue: 'open' }, createdBy: { type: S.UUID, allowNull: false }, assignedTo: { type: S.UUID, allowNull: true }, relatedEntityType: { type: S.STRING(40), allowNull: true }, relatedEntityId: { type: S.UUID, allowNull: true }, ...timestamps()
      }, options);
      if (!tables.includes('internal_messages')) await q.createTable('internal_messages', { id: primary(), threadId: { type: S.UUID, allowNull: false }, senderId: { type: S.UUID, allowNull: false }, body: { type: S.TEXT, allowNull: false }, ...timestamps() }, options);
      if (!tables.includes('internal_notes')) await q.createTable('internal_notes', { id: primary(), authorId: { type: S.UUID, allowNull: false }, entityType: { type: S.STRING(40), allowNull: false }, entityId: { type: S.UUID, allowNull: false }, body: { type: S.TEXT, allowNull: false }, ...timestamps() }, options);
      if (!tables.includes('audit_logs')) await q.createTable('audit_logs', { id: primary(), actorId: { type: S.UUID, allowNull: true }, actorRole: { type: S.STRING }, action: { type: S.STRING, allowNull: false }, entityType: { type: S.STRING, allowNull: false }, entityId: { type: S.UUID, allowNull: true }, targetUserId: { type: S.UUID, allowNull: true }, status: { type: S.STRING, allowNull: false, defaultValue: 'success' }, ipAddress: { type: S.STRING }, userAgent: { type: S.TEXT }, metadata: { type: S.JSON, defaultValue: {} }, ...timestamps() }, options);
      await q.sequelize.query('CREATE INDEX IF NOT EXISTS phase6_internal_thread_updated ON internal_threads ("updatedAt")', options);
      await q.sequelize.query('CREATE INDEX IF NOT EXISTS phase6_internal_thread_entity ON internal_threads ("relatedEntityType", "relatedEntityId")', options);
      await q.sequelize.query('CREATE INDEX IF NOT EXISTS phase6_internal_message_thread ON internal_messages ("threadId", "createdAt")', options);
      await q.sequelize.query('CREATE INDEX IF NOT EXISTS phase6_internal_note_entity ON internal_notes ("entityType", "entityId")', options);
      await q.sequelize.query('CREATE INDEX IF NOT EXISTS phase6_audit_created ON audit_logs ("createdAt")', options);
      await q.bulkInsert('admin_phase6_migrations', [{ name: '20261005000100', createdAt: new Date() }], options);
    });
  },
  async down() { throw new Error('Administrative history must be preserved. Restore a database backup to roll back.'); }
};
