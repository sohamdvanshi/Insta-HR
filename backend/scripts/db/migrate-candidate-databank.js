const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const sequelize = require('../../src/config/database');
(async () => {
  try {
    await sequelize.authenticate();
    const result = await require('../../migrations/20261010000300-candidate-databank').up(sequelize.getQueryInterface(), require('sequelize'));
    console.log('Candidate profile foreign key and databank preferences are ready.');
    if (result.orphanCount) console.warn(`${result.orphanCount} historical profiles have no matching account. They were preserved; the corrected foreign key protects new writes.`);
  } finally { await sequelize.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
