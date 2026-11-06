const { SubscriptionPlan, PlanAttribute, sequelize }=require('../models');
const { handle,audit }=require('../services/adminOperations');
const { fail,reason,text }=require('../services/adminPolicy');
const P=require('../services/planAttributes');
exports.list=handle(async(req,res)=>{
 const defs=await P.definitions();
 const plans=await SubscriptionPlan.findAll({order:[['amountPaise','ASC']]});
 res.json({success:true,data:plans.map(p=>({...p.toJSON(),attributes:P.valuesFor(p,defs)})),attributeDefinitions:defs});
});
exports.save=handle(async(req,res)=>{
 if(!['free','standard','premium','enterprise'].includes(req.params.id))fail('Unknown plan');
 const why=reason(req.body.reason);
 const data=await sequelize.transaction(async transaction=>{
 await P.lockCatalog(transaction);
 const defs=await P.definitions(transaction);
 const plan=await SubscriptionPlan.findByPk(req.params.id,{transaction,lock:transaction.LOCK.UPDATE});if(!plan)fail('Plan not found',404);
 if(req.body.expectedUpdatedAt && new Date(req.body.expectedUpdatedAt).getTime()!==new Date(plan.updatedAt).getTime())fail('This plan changed. Reload before saving.',409);
 const name=text(req.body.name,'Plan name',100);if(typeof req.body.isActive!=='boolean')fail('Plan active status must be a boolean');
 const changes={...P.parseValues(req.body.attributes,defs,plan.id),name,isActive:req.body.isActive};
 const before=plan.toJSON();await plan.update(changes,{transaction});
 await audit(req,transaction,'admin.plan_updated','subscription_plan',null,{reason:why,planId:plan.id,before,after:plan.toJSON()});
 return {...plan.toJSON(),attributes:P.valuesFor(plan,defs)};
 });res.json({success:true,data});
});
exports.createAttribute=handle(async(req,res)=>{
 const d=P.parseDefinition(req.body),why=reason(req.body.reason);
 const data=await sequelize.transaction(async transaction=>{
 await P.lockCatalog(transaction);
 if(await PlanAttribute.findByPk(d.key,{transaction}))fail('Attribute key already exists',409);
 const attribute=await PlanAttribute.create(d,{transaction});
 const plans=await SubscriptionPlan.findAll({transaction,lock:transaction.LOCK.UPDATE,order:[['id','ASC']]});
 for(const p of plans)await p.update({attributeValues:{...p.attributeValues,[d.key]:d.defaultValue}},{transaction});
 await audit(req,transaction,'admin.plan_attribute_created','plan_attribute',null,{reason:why,definition:d});return attribute;
 });res.status(201).json({success:true,data});
});
exports.editAttribute=handle(async(req,res)=>{
 const why=reason(req.body.reason),changes=P.metadata(req.body);
 // Keys, types and defaults are immutable once assigned to plans.
 if(['key','type','defaultValue','system','enforced'].some(k=>Object.hasOwn(req.body,k)))fail('Attribute keys, types and defaults cannot be changed');
 const data=await sequelize.transaction(async transaction=>{
 await P.lockCatalog(transaction);const d=await PlanAttribute.findByPk(req.params.key,{transaction,lock:transaction.LOCK.UPDATE});if(!d)fail('Custom attribute not found',404);
 const before=d.toJSON();await d.update(changes,{transaction});await audit(req,transaction,'admin.plan_attribute_updated','plan_attribute',null,{reason:why,before,after:d.toJSON()});return d;
 });res.json({success:true,data});
});
