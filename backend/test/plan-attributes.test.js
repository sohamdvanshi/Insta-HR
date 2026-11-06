const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/services/planAttributes');
let state,queue=Promise.resolve(),auditFails=false;
const clone=x=>JSON.parse(JSON.stringify(x));
function instance(row){return {...row,toJSON(){const {toJSON,update,...data}=this;return data},async update(changes){Object.assign(row,changes);Object.assign(this,changes);return this}}}
const models={
 User:{findByPk:async(id,o)=>{assert.equal(o.lock,'UPDATE');return instance(state.user)}},
 SubscriptionPlan:{findByPk:async id=>state.plans[id]?instance(state.plans[id]):null,findAll:async()=>Object.values(state.plans).map(instance)},
 PlanAttribute:{findAll:async()=>Object.values(state.defs).map(instance),findByPk:async k=>state.defs[k]?instance(state.defs[k]):null,create:async d=>{state.defs[d.key]={...d};return instance(state.defs[d.key])}},
 Resume:{count:async()=>state.resumes.length,create:async d=>{if(state.failResume)throw Error('insert failed');const row={id:String(state.resumes.length),...d};state.resumes.push(row);return row},update:async()=>{state.resumes.forEach(r=>r.isDefault=false)}},
 sequelize:{query:async(s,o)=>assert.ok(o.transaction),transaction:fn=>{const run=async()=>{const snapshot=clone(state);try{return await fn({LOCK:{UPDATE:'UPDATE'}})}catch(e){state=snapshot;throw e}};const task=queue.then(run);queue=task.catch(()=>{});return task}}
};
require.cache[require.resolve('../src/models')]={exports:models};
require.cache[require.resolve('../src/services/adminOperations')]={exports:{handle:fn=>async(req,res)=>{try{await fn(req,res)}catch(e){res.status(e.status||500).json({message:e.message})}},audit:async()=>{if(auditFails)throw Error('audit failed');state.audits++}}};
const C=require('../src/controllers/planCatalog.controller'),R=require('../src/controllers/resume.controller');
const req=(body={},params={})=>({body,params,user:{id:'candidate',role:'candidate'}});
async function call(fn,request){let status=200,data;await fn(request,{status(s){status=s;return this},json(d){data=d;return this}});return {status,data}}
beforeEach(()=>{state={user:{id:'candidate',subscriptionPlan:'premium',subscriptionExpiry:'2099-01-01'},plans:{free:{id:'free',name:'Free',amountPaise:0,yearlyAmountPaise:0,durationDays:30,loyaltyPoints:0,featuredJobs:false,isActive:true,attributeValues:{resumeLimit:1}},premium:{id:'premium',name:'Premium',amountPaise:100,yearlyAmountPaise:1200,durationDays:30,loyaltyPoints:1000,featuredJobs:true,isActive:true,attributeValues:{resumeLimit:2}}},defs:{},resumes:[],audits:0};auditFails=false});
test('typed values reject coercion, fractional and negative quotas; zero and unlimited are distinct',()=>{
 const d=P.SYSTEM.find(d=>d.key==='resumeLimit');for(const v of [-1,1.5,'2',true,{},undefined])assert.throws(()=>P.validateValue(d,v));assert.equal(P.validateValue(d,0),0);assert.equal(P.validateValue(d,null),null);
 assert.throws(()=>P.validateValue({label:'Flag',type:'boolean'},'false'));assert.throws(()=>P.parseDefinition({key:'resumeLimit',label:'Fake',type:'integer',unit:'',defaultValue:2}));
});
test('adding a definition populates all plans and publishes a single consistent schema',async()=>{
 const added=await call(C.createAttribute,req({key:'supportLevel',label:'Support level',type:'text',unit:'',defaultValue:'Email',reason:'Add support tier'}));assert.equal(added.status,201);
 assert.equal(state.plans.free.attributeValues.supportLevel,'Email');assert.equal(state.plans.premium.attributeValues.supportLevel,'Email');
 const listed=await call(C.list,req());assert.equal(listed.data.attributeDefinitions.filter(d=>d.key==='supportLevel').length,1);assert.equal(listed.data.data[1].attributes.supportLevel,'Email');
 assert.equal((await call(C.createAttribute,req({key:'supportLevel',label:'Duplicate',type:'text',unit:'',defaultValue:'x',reason:'Duplicate key'}))).status,409);
});
test('attribute edits preserve key/type and shared labels apply to every plan',async()=>{
 state.defs.support={key:'support',label:'Support',type:'text',unit:'',defaultValue:'Email'};
 assert.equal((await call(C.editAttribute,req({label:'New',unit:'',type:'integer',reason:'Change schema'},{key:'support'}))).status,400);
 assert.equal((await call(C.editAttribute,req({label:'Support channel',unit:'',reason:'Improve label'},{key:'support'}))).status,200);
 const listed=await call(C.list,req());assert.equal(listed.data.attributeDefinitions.find(d=>d.key==='support').label,'Support channel');
});
test('complete plan values save to canonical price columns and validated JSON values',async()=>{
 const defs=await P.definitions(),values=P.valuesFor(state.plans.premium,defs);values.amountPaise=2500;values.resumeLimit=5;
 const result=await call(C.save,req({name:'Premium',isActive:true,attributes:values,reason:'Adjust quota and price'},{id:'premium'}));assert.equal(result.status,200);assert.equal(state.plans.premium.amountPaise,2500);assert.equal(state.plans.premium.attributeValues.resumeLimit,5);assert.equal(state.plans.premium.attributeValues.amountPaise,undefined);
 values.featuredJobs='yes';assert.equal((await call(C.save,req({name:'Premium',isActive:true,attributes:values,reason:'Invalid field type'},{id:'premium'}))).status,400);
});
test('stale schema and stale plan versions cannot silently overwrite settings',async()=>{
 const defs=await P.definitions(),values=P.valuesFor(state.plans.premium,defs);state.defs.newFlag={key:'newFlag',label:'New flag',type:'boolean',unit:'',defaultValue:false};
 assert.equal((await call(C.save,req({name:'Premium',isActive:true,attributes:values,reason:'Old schema'},{id:'premium'}))).status,409);
 state.plans.premium.updatedAt='2026-10-24T00:00:00Z';
 assert.equal((await call(C.save,req({name:'Premium',isActive:true,expectedUpdatedAt:'2026-10-23T00:00:00Z',attributes:values,reason:'Stale plan'},{id:'premium'}))).status,409);
});
test('audit failure rolls back definition creation and all plan defaults',async()=>{
 auditFails=true;assert.equal((await call(C.createAttribute,req({key:'flag',label:'Flag',type:'boolean',unit:'',defaultValue:false,reason:'Test rollback'}))).status,500);assert.deepEqual(state.defs,{});assert.equal(state.plans.free.attributeValues.flag,undefined);
});
test('concurrent resume requests cannot exceed quota and cannot clear the default on rejection',async()=>{
 state.plans.premium.attributeValues.resumeLimit=1;
 const results=await Promise.all([call(R.createResume,req({title:'First',isDefault:true})),call(R.createResume,req({title:'Second',isDefault:true}))]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,403]);assert.equal(state.resumes.length,1);assert.equal(state.resumes[0].isDefault,true);
});
test('expired subscriptions use free limit; zero blocks creation and unlimited permits it',async()=>{
 state.user.subscriptionExpiry='2000-01-01';state.resumes.push({title:'Existing'});assert.equal((await call(R.createResume,req())).status,403);
 state.user.subscriptionExpiry='2099-01-01';state.plans.premium.attributeValues.resumeLimit=0;assert.equal((await call(R.createResume,req())).status,403);
 state.plans.premium.attributeValues.resumeLimit=null;assert.equal((await call(R.createResume,req())).status,201);
});
test('failed resume insert rolls back default clearing',async()=>{
 state.resumes.push({isDefault:true});state.failResume=true;assert.equal((await call(R.createResume,req({isDefault:true}))).status,500);assert.equal(state.resumes[0].isDefault,true);
});
test('migration is additive, repeatable and does not change existing limits',async()=>{
 const columns={},tables=[],S=require('sequelize'),migration=require('../migrations/20261024000100-plan-attributes');let creates=0,adds=0;
 const q={sequelize:{transaction:async fn=>fn({})},describeTable:async()=>columns,addColumn:async(t,k,d)=>{columns[k]=d;adds++},showAllTables:async()=>tables,createTable:async t=>{tables.push(t);creates++}};
 await migration.up(q,S);await migration.up(q,S);assert.equal(creates,1);assert.equal(adds,1);
});

test('comparison switches and limits persist in JSON while featured jobs uses its canonical column',async()=>{
 const defs=await P.definitions(),values=P.valuesFor(state.plans.premium,defs);Object.assign(values,{socialPromotion:true,dedicatedSupport:true,accountManager:true,apiAccess:true,aiScreening:true,aiScreeningLevel:'advanced',jobPostingLimit:8,resumeViewLimit:75});
 assert.equal((await call(C.save,req({name:'Premium',isActive:true,attributes:values,reason:'Configure comparison features'},{id:'premium'}))).status,200);
 assert.equal(state.plans.premium.attributeValues.jobPostingLimit,8);assert.equal(state.plans.premium.attributeValues.socialPromotion,true);assert.equal(state.plans.premium.featuredJobs,true);
 const listed=await call(C.list,req());assert.equal(listed.data.data[1].attributes.aiScreeningLevel,'advanced');
 const entitlements=await require('../src/services/planEntitlements').entitlementsFor(state.user);assert.equal(entitlements.apiAccess,true);assert.equal(entitlements.aiScreeningLevel,'advanced');
 assert.throws(()=>P.validateValue(defs.find(d=>d.key==='aiScreeningLevel'),'invalid'));
 assert.throws(()=>P.validateValue(defs.find(d=>d.key==='apiAccess'),'true'));
});
test('wage invoice migration is rerunnable, preserves invoices and seeds settings without overwriting edits',async()=>{
 const columns={},sql=[],q={sequelize:{transaction:async fn=>fn({}),query:async(s,o)=>sql.push([s,o.replacements])},describeTable:async()=>columns,addColumn:async(t,k,v)=>{assert.equal(t,'wage_registers');columns[k]=v}};
 const migration=require('../migrations/20261024000200-plan-comparison-wage-invoices'),S=require('sequelize');await migration.up(q,S);await migration.up(q,S);
 assert.ok(columns.invoices);assert.equal(sql.length,8);assert.ok(sql.every(([s])=>s.includes('|| "attributeValues"')));
 assert.equal(JSON.parse(sql[0][1].defaults).jobPostingLimit,3);assert.equal(JSON.parse(sql[1][1].defaults).resumeViewLimit,100);
});
