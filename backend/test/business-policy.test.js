const { test } = require('node:test');
const assert = require('node:assert/strict');
const { purchaseTerms, expiryFor } = require('../src/services/subscriptionTerms');
const { validateTransition } = require('../src/services/invoicePolicy');
const { parsePlan } = require('../src/services/adminPolicy');
test('billing uses server amounts, rejects unknown cycles and extends only the same active plan',()=>{
 const p={amountPaise:199900,yearlyAmountPaise:1999900,durationDays:30};
 assert.deepEqual(purchaseTerms(p,'yearly'),{amountPaise:1999900,durationDays:365,billingCycle:'yearly'});
 assert.throws(()=>purchaseTerms(p,'weekly'));assert.throws(()=>purchaseTerms({...p,yearlyAmountPaise:0},'yearly'));
 const now=Date.parse('2026-10-17T00:00:00Z'),user={subscriptionPlan:'premium',subscriptionExpiry:new Date(now+86400000)};
 assert.equal(expiryFor(user,'premium',30,now).getTime(),now+31*86400000);
 assert.throws(()=>expiryFor(user,'standard',30,now),{status:409});
});
test('overdue requires a past due date and settled invoices cannot reopen',()=>{
 assert.throws(()=>validateTransition({status:'sent',dueDate:'2099-01-01'},'overdue'),{status:409});
 assert.throws(()=>validateTransition({status:'paid',dueDate:'2000-01-01'},'draft'),{status:409});
 validateTransition({status:'paid'},'paid');
});
test('plan configuration validates yearly prices, points and enforced benefit types',()=>{
 const p={name:'Premium',amountPaise:100,durationDays:30,features:[],isActive:true,yearlyAmountPaise:1000,loyaltyPoints:1000,featuredJobs:true};
 assert.equal(parsePlan(p,'premium').featuredJobs,true);
 for(const patch of [{loyaltyPoints:-1},{loyaltyPoints:1.5},{featuredJobs:'true'},{yearlyAmountPaise:0}])assert.throws(()=>parsePlan({...p,...patch},'premium'));
});
test('business migration is additive and does not reset administrator choices on rerun',async()=>{
 const S=require('sequelize'),migration=require('../migrations/20261017000100-business-workflows');
 const tables=Object.fromEntries(['subscription_plans','Payments','invoices','wage_registers','loyalty_point_transactions'].map(t=>[t,{}]));
 const sql=[],indexes=[];let tx=0;
 const q={sequelize:{transaction:async fn=>{tx++;return fn({id:tx})},query:async (s,o)=>{assert.ok(o.transaction);sql.push(s)}},describeTable:async t=>({...tables[t]}),addColumn:async(t,k,v,o)=>{assert.ok(o.transaction);assert.ok(!tables[t][k]);tables[t][k]=v},showIndex:async()=>indexes,addIndex:async(t,fields,o)=>indexes.push({name:o.name})};
 await migration.up(q,S);assert.equal(sql.length,3);assert.equal(indexes.length,1);
 await migration.up(q,S);assert.equal(sql.length,3);assert.equal(indexes.length,1);assert.equal(tx,2);
});
