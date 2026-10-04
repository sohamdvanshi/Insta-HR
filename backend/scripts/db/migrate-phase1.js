// Explicit deployment step; never auto-alter a live database on server startup.
const sequelize = require('../../src/config/database');
const Sequelize = require('sequelize');
async function run() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    await require('../../migrations/20260724000100-add-sector-and-visibility-to-resumes').up(queryInterface, Sequelize);
    await require('../../migrations/20261002000100-add-human-resources-resume-sector').up(queryInterface, Sequelize);
    console.log('Phase 1 resume schema is ready.');
  } finally { await sequelize.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
