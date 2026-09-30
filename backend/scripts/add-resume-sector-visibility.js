require('dotenv').config();

const sequelize = require('../src/config/database');

const addColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const table = await queryInterface.describeTable('resumes');

    if (!table.sector) {
      await queryInterface.addColumn('resumes', 'sector', {
        type: sequelize.Sequelize.ENUM(
          'general',
          'information_technology',
          'sales_marketing',
          'finance',
          'healthcare',
          'manufacturing',
          'retail',
          'hospitality',
          'logistics'
        ),
        allowNull: false,
        defaultValue: 'general'
      });

      console.log('Added "sector" column.');
    } else {
      console.log('"sector" column already exists. Skipping.');
    }

    if (!table.visibility) {
      await queryInterface.addColumn('resumes', 'visibility', {
        type: sequelize.Sequelize.ENUM('private', 'link'),
        allowNull: false,
        defaultValue: 'private'
      });

      console.log('Added "visibility" column.');
    } else {
      console.log('"visibility" column already exists. Skipping.');
    }

    console.log('Resume schema update completed successfully.');
  } catch (error) {
    console.error('Resume schema update failed:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

addColumns();