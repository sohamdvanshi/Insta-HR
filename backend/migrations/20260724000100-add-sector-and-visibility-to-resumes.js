'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction =
      await queryInterface.sequelize.transaction()

    try {
      const tableDescription =
        await queryInterface.describeTable(
          'resumes'
        )

      if (!tableDescription.sector) {
        await queryInterface.addColumn(
          'resumes',
          'sector',
          {
            type: Sequelize.ENUM(
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
          },
          { transaction }
        )
      }

      if (!tableDescription.visibility) {
        await queryInterface.addColumn(
          'resumes',
          'visibility',
          {
            type: Sequelize.ENUM(
              'private',
              'link'
            ),
            allowNull: false,
            defaultValue: 'private'
          },
          { transaction }
        )
      }

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },

  async down(queryInterface) {
    const transaction =
      await queryInterface.sequelize.transaction()

    try {
      const tableDescription =
        await queryInterface.describeTable(
          'resumes'
        )

      if (tableDescription.visibility) {
        await queryInterface.removeColumn(
          'resumes',
          'visibility',
          { transaction }
        )
      }

      if (tableDescription.sector) {
        await queryInterface.removeColumn(
          'resumes',
          'sector',
          { transaction }
        )
      }

      await transaction.commit()

      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_resumes_visibility";'
      )

      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_resumes_sector";'
      )
    } catch (error) {
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        console.error(
          'Migration rollback failed:',
          rollbackError.message
        )
      }

      throw error
    }
  }
}