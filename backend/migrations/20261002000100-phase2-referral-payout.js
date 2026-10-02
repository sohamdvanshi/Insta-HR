 'use strict'
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const opts = { transaction }
      const campaign = await q.describeTable('BulkEmailCampaigns', opts)
      if (!campaign.audience) await q.addColumn('BulkEmailCampaigns', 'audience', { type: S.STRING(20), allowNull: false, defaultValue: 'applicants' }, opts)
      const tables = new Set((await q.showAllTables(opts)).map(x => typeof x === 'string' ? x : x.tableName))
      const timestamps = { createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false } }
      if (!tables.has('payout_profiles')) await q.createTable('payout_profiles', {
        userId: { type: S.UUID, primaryKey: true, references: { model: 'Users', key: 'id' } },
        encryptedBank: { type: S.TEXT, allowNull: false }, bankLast4: { type: S.STRING(4), allowNull: false }, aadhaarLast4: { type: S.STRING(4), allowNull: false },
        consentAt: { type: S.DATE, allowNull: false }, revision: { type: S.INTEGER, allowNull: false, defaultValue: 1 }, reviewStatus: { type: S.STRING(30), allowNull: false, defaultValue: 'pending' },
        reviewedBy: { type: S.UUID }, reviewedAt: { type: S.DATE }, bankEvidenceRef: { type: S.STRING(200) }, identityEvidenceRef: { type: S.STRING(200) }, ...timestamps
      }, opts)
      if (!tables.has('loyalty_redemptions')) await q.createTable('loyalty_redemptions', {
        id: { type: S.UUID, primaryKey: true, allowNull: false }, userId: { type: S.UUID, allowNull: false, references: { model: 'Users', key: 'id' } },
        idempotencyKey: { type: S.UUID, allowNull: false }, points: { type: S.INTEGER, allowNull: false }, amountPaise: { type: S.BIGINT, allowNull: false },
        bankSnapshot: { type: S.TEXT, allowNull: false }, profileRevision: { type: S.INTEGER, allowNull: false }, status: { type: S.STRING(20), allowNull: false, defaultValue: 'pending' },
        transferReference: { type: S.STRING(120), unique: true }, reviewedBy: { type: S.UUID }, reviewedAt: { type: S.DATE }, reason: { type: S.STRING(255) }, ...timestamps
      }, opts)
      const indexes = await q.showIndex('loyalty_redemptions', opts)
      if (!indexes.some(x => x.name === 'redemption_user_key_unique')) await q.addIndex('loyalty_redemptions', ['userId', 'idempotencyKey'], { ...opts, unique: true, name: 'redemption_user_key_unique' })
      if (!indexes.some(x => x.name === 'redemption_user_status_idx')) await q.addIndex('loyalty_redemptions', ['userId', 'status'], { ...opts, name: 'redemption_user_status_idx' })
      if (!tables.has('payout_audits')) await q.createTable('payout_audits', { id: { type: S.UUID, primaryKey: true, allowNull: false }, actorId: { type: S.UUID, allowNull: false }, userId: { type: S.UUID, allowNull: false }, action: { type: S.STRING(40), allowNull: false }, metadata: { type: S.JSON, allowNull: false }, ...timestamps }, opts)
    })
  },
  async down() { throw new Error('Destructive rollback disabled: reconcile redemptions and securely archive payout records before a reviewed rollback.') }
}
