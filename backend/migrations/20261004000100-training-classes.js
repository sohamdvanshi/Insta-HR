'use strict';
const { randomUUID } = require('crypto');
const { httpUrl } = require('../src/services/trainingPolicy');

module.exports = {
  async up(q, S) {
    // Existing deployments may still use a PostgreSQL enum for Users.role.
    const [enums] = await q.sequelize.query(`SELECT t.typname FROM pg_type t JOIN pg_attribute a ON a.atttypid = t.oid JOIN pg_class c ON c.oid = a.attrelid WHERE c.relname = 'Users' AND a.attname = 'role' AND t.typtype = 'e'`);
    for (const row of enums) await q.sequelize.query(`ALTER TYPE "${row.typname.replace(/"/g, '""')}" ADD VALUE IF NOT EXISTS 'trainer'`);
    return q.sequelize.transaction(async transaction => {
      const options = { transaction };
      const tables = await q.showAllTables(options);
      if (!tables.includes('training_phase5_migrations')) await q.createTable('training_phase5_migrations', { name: { type: S.STRING, primaryKey: true }, createdAt: { type: S.DATE, allowNull: false } }, options);
      const [applied] = await q.sequelize.query(`SELECT name FROM training_phase5_migrations WHERE name = '20261004000100'`, options);
      if (applied.length) return;
      const id = () => ({ type: S.UUID, primaryKey: true, allowNull: false });
      const timestamps = () => ({ createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false } });
      const reference = (model, onDelete = 'CASCADE', allowNull = false) => ({ type: S.UUID, allowNull, references: { model, key: 'id' }, onDelete, onUpdate: 'CASCADE' });
      await q.createTable('training_batches', {
        id: id(), trainingId: reference('Trainings'), trainerId: reference('Users', 'SET NULL', true),
        name: { type: S.STRING(200), allowNull: false }, status: { type: S.STRING(20), allowNull: false, defaultValue: 'active' }, ...timestamps()
      }, options);
      await q.addColumn('course_enrollments', 'batchId', reference('training_batches', 'SET NULL', true), options);
      await q.addIndex('course_enrollments', ['batchId'], options);
      await q.createTable('training_sessions', {
        id: id(), trainingId: reference('Trainings'), batchId: reference('training_batches', 'CASCADE', true), createdBy: reference('Users', 'RESTRICT'),
        title: { type: S.STRING(200), allowNull: false }, mode: { type: S.STRING(20), allowNull: false },
        startsAt: { type: S.DATE, allowNull: false }, endsAt: { type: S.DATE, allowNull: false },
        location: { type: S.TEXT, allowNull: true }, meetingUrl: { type: S.TEXT, allowNull: true }, notes: { type: S.TEXT, defaultValue: '' },
        status: { type: S.STRING(20), allowNull: false, defaultValue: 'scheduled' }, notificationLog: { type: S.JSON, defaultValue: {} }, ...timestamps()
      }, options);
      await q.addIndex('training_sessions', ['trainingId', 'startsAt'], options);
      await q.addIndex('training_sessions', ['batchId'], options);
      await q.createTable('training_attendance', {
        id: id(), sessionId: reference('training_sessions'), userId: reference('Users'), markedBy: reference('Users', 'RESTRICT'),
        status: { type: S.STRING(20), allowNull: false }, notes: { type: S.STRING(1000), defaultValue: '' }, ...timestamps()
      }, options);
      await q.addIndex('training_attendance', ['sessionId', 'userId'], { ...options, unique: true });
      // Preserve legacy live classes as separate sessions. Unconfigured legacy
      // courses stay intact for staff to finish scheduling manually.
      const [legacy] = await q.sequelize.query(`SELECT * FROM "Trainings" WHERE type = 'live'`, options);
      const [users] = await q.sequelize.query('SELECT id FROM \"Users\"', options);
      const validProviders = new Set(users.map(user => user.id));
      for (const course of legacy) {
        if (!course.liveSchedule || !course.liveLink || !httpUrl(course.liveLink) || !validProviders.has(course.providerId)) continue;
        const startsAt = new Date(course.liveSchedule); const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        await q.bulkInsert('training_sessions', [{ id: randomUUID(), trainingId: course.id, createdBy: course.providerId, title: course.title.slice(0, 200), mode: 'online', startsAt, endsAt, meetingUrl: course.liveLink, status: endsAt < new Date() ? 'completed' : 'scheduled', notes: 'Migrated from the previous live course schedule.', notificationLog: '{}', createdAt: new Date(), updatedAt: new Date() }], options);
        await q.sequelize.query(`UPDATE "Trainings" SET type = 'video', "liveLink" = NULL, "liveSchedule" = NULL WHERE id = :id`, { ...options, replacements: { id: course.id } });
      }
      await q.bulkInsert('training_phase5_migrations', [{ name: '20261004000100', createdAt: new Date() }], options);
    });
  },
  async down() { throw new Error('Training attendance and class history must be preserved. Restore a database backup to roll back this migration.'); }
};
