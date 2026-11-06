'use strict';
module.exports={async up(q,S){await q.sequelize.transaction(async transaction=>{
 const o={transaction},columns=await q.describeTable('wage_registers',o);
 if(!columns.invoices)await q.addColumn('wage_registers','invoices',{type:S.JSONB,allowNull:false,defaultValue:[]},o);
 const defaults={jobPostingLimit:null,resumeViewLimit:null,aiScreening:true,aiScreeningLevel:'basic',socialPromotion:false,dedicatedSupport:false,accountManager:false,apiAccess:false};
 for(const id of ['free','standard','premium','enterprise']){
 const values={...defaults,jobPostingLimit:id==='free'?3:null,resumeViewLimit:id==='free'?5:id==='standard'?100:null,aiScreening:id!=='free',aiScreeningLevel:id==='enterprise'?'custom':id==='premium'?'advanced':'basic',socialPromotion:['premium','enterprise'].includes(id),dedicatedSupport:['premium','enterprise'].includes(id),accountManager:id==='enterprise',apiAccess:id==='enterprise'};
 // Existing configured values win. Reruns only fill missing settings.
 await q.sequelize.query('UPDATE subscription_plans SET "attributeValues" = CAST(:defaults AS jsonb) || "attributeValues" WHERE id = :id',{...o,replacements:{defaults:JSON.stringify(values),id}});
 }
 });},async down(){throw new Error('Preserve employee invoices; restore a backup for rollback.');}};
