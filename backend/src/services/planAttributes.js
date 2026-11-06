const { fail } = require('./adminPolicy');
const SYSTEM = [
 {key:'amountPaise',label:'Monthly price',type:'money',unit:'INR',defaultValue:0},
 {key:'yearlyAmountPaise',label:'Yearly price',type:'money',unit:'INR',defaultValue:0},
 {key:'durationDays',label:'Monthly duration',type:'integer',unit:'days',defaultValue:30,min:1,max:365},
 {key:'loyaltyPoints',label:'Loyalty redemption cost',type:'integer',unit:'points',defaultValue:0},
 {key:'featuredJobs',label:'Featured jobs',type:'boolean',unit:'',defaultValue:false},
 {key:'jobPostingLimit',label:'Job Postings',type:'integer',unit:'per month',defaultValue:null,unlimited:true,storage:'json',enforced:false},
 {key:'resumeViewLimit',label:'Resume Views',type:'integer',unit:'per month',defaultValue:null,unlimited:true,storage:'json',enforced:false},
 {key:'aiScreening',label:'AI Screening',type:'boolean',unit:'',defaultValue:false,storage:'json',enforced:false},
 {key:'aiScreeningLevel',label:'AI screening level',type:'choice',options:['basic','advanced','custom'],unit:'',defaultValue:'basic',storage:'json',enforced:false},
 {key:'socialPromotion',label:'Social Promotion',type:'boolean',unit:'',defaultValue:false,storage:'json',enforced:false},
 {key:'dedicatedSupport',label:'Dedicated Support',type:'boolean',unit:'',defaultValue:false,storage:'json',enforced:false},
 {key:'accountManager',label:'Account Manager',type:'boolean',unit:'',defaultValue:false,storage:'json',enforced:false},
 {key:'apiAccess',label:'API Access',type:'boolean',unit:'',defaultValue:false,storage:'json',enforced:false},
 {key:'resumeLimit',label:'Number of resumes allowed',type:'integer',unit:'resumes',defaultValue:null,unlimited:true}
].map(d=>({...d,system:true,enforced:d.enforced??true}));
const RESERVED = new Set([...SYSTEM.map(d=>d.key),'__proto__','prototype','constructor','id','name','features','isActive','currency','attributeValues']);
function validateValue(d,v) {
 if (v===null && d.type==='integer' && (d.unlimited || !d.system)) return v;
 if(d.type==='choice'){if(!d.options.includes(v))fail(`${d.label} has an invalid option`);}
 else if (d.type==='boolean') {if(typeof v!=='boolean')fail(`${d.label} must be true or false`);}
 else if(d.type==='text') {if(typeof v!=='string'||v.length>200)fail(`${d.label} must be text up to 200 characters`);}
 else if(!Number.isSafeInteger(v)||v<(d.min??0)||v>(d.max??100000000))fail(`${d.label} must be an integer within its allowed range`);
 return v;
}
function parseDefinition(body) {
 const key=body.key;
 if(typeof key!=='string'||!/^[a-z][a-zA-Z0-9_]{1,49}$/.test(key)||RESERVED.has(key))fail('Choose a unique attribute key (2–50 letters, digits or underscores, starting with a lowercase letter)');
 if(!['integer','boolean','text'].includes(body.type))fail('Choose integer, boolean or text');
 const d={key,type:body.type,...metadata(body)};
 d.defaultValue=validateValue(d,body.defaultValue);return d;
}
function metadata(body) {
 if(typeof body.label!=='string'||!body.label.trim()||body.label.trim().length>100)fail('Attribute label is required (maximum 100 characters)');
 if(typeof body.unit!=='string'||body.unit.trim().length>30)fail('Unit must be text up to 30 characters');
 return {label:body.label.trim(),unit:body.unit.trim()};
}
async function definitions(transaction) {
 const { PlanAttribute }=require('../models');
 const custom=await PlanAttribute.findAll({order:[['key','ASC']],transaction});
 return [...SYSTEM,...custom.filter(d=>!SYSTEM.some(s=>s.key===d.key)).map(d=>({...d.toJSON(),system:false,enforced:false,unlimited:d.type==='integer'}))];
}
function valuesFor(plan,defs) {
 const result={};
 for(const d of defs) {
 const stored=d.system && d.storage!=='json' && d.key!=='resumeLimit' ? plan[d.key] : plan.attributeValues?.[d.key];
 result[d.key]=validateValue(d,stored===undefined?d.defaultValue:stored);
 }return result;
}
function parseValues(values,defs,planId) {
 if(!values||typeof values!=='object'||Array.isArray(values))fail('Provide the complete plan attribute values');
 const keys=defs.map(d=>d.key);
 if(Object.keys(values).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(values,k)))fail('Plan attributes changed. Reload and try again.',409);
 const columns={},attributeValues={};
 for(const d of defs){const v=validateValue(d,values[d.key]);if(d.system && d.storage!=='json' && d.key!=='resumeLimit')columns[d.key]=v;else attributeValues[d.key]=v;}
 if(planId==='free'&&(columns.amountPaise!==0||columns.yearlyAmountPaise!==0||columns.loyaltyPoints!==0))fail('Free plan prices and redemption cost must be zero');
 if(planId!=='free'&&(columns.amountPaise<100||columns.yearlyAmountPaise<100))fail('Paid plans must cost at least INR 1');
 return {...columns,attributeValues};
}
// One PostgreSQL transaction lock serializes schema changes and plan saves.
async function lockCatalog(transaction){await require('../models').sequelize.query('SELECT pg_advisory_xact_lock(7241024)',{transaction});}
function resumeLimitFor(plan) {
 const definition=SYSTEM.find(d=>d.key==='resumeLimit');
 return validateValue(definition,plan?.attributeValues?.resumeLimit ?? definition.defaultValue);
}
module.exports={resumeLimitFor,SYSTEM,RESERVED,validateValue,parseDefinition,metadata,definitions,valuesFor,parseValues,lockCatalog};
