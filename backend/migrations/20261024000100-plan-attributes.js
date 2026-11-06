'use strict';
module.exports={async up(q,S){await q.sequelize.transaction(async transaction=>{
 const o={transaction};const cols=await q.describeTable('subscription_plans',o);
 if(!cols.attributeValues)await q.addColumn('subscription_plans','attributeValues',{type:S.JSONB,allowNull:false,defaultValue:{}},o);
 const tables=await q.showAllTables(o);if(!tables.some(t=>(typeof t==='string'?t:t.tableName)==='plan_attributes'))await q.createTable('plan_attributes',{
 key:{type:S.STRING(50),primaryKey:true},label:{type:S.STRING(100),allowNull:false},type:{type:S.STRING(10),allowNull:false},unit:{type:S.STRING(30),allowNull:false,defaultValue:''},defaultValue:{type:S.JSONB,allowNull:true},createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false}
 },o);
 // Missing resumeLimit means unlimited, preserving existing accounts on rollout.
 });},async down(){throw new Error('Preserve plan attribute data; restore a backup to roll back.');}};
