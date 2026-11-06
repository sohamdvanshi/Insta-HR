const sequelize=require('../../src/config/database');
(async()=>{try{await sequelize.authenticate();await require('../../migrations/20261024000200-plan-comparison-wage-invoices').up(sequelize.getQueryInterface(),require('sequelize'));console.log('Plan comparison and wage invoice schema is ready.');}finally{await sequelize.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
