const { test,before,after,beforeEach }=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');const {randomUUID}=require('crypto');const ExcelJS=require('exceljs');
process.env.JWT_SECRET='wages-test-only';
const users=Object.fromEntries(['employer','otherEmployer','super_admin','admin','candidate','trainer'].map(k=>[k,{id:randomUUID(),role:k==='otherEmployer'?'employer':k,isActive:true}]));
let records=[],audits=[],auditFail=false;
const model={
 async findOne({where}){const r=records.find(r=>Object.entries(where).every(([k,v])=>r[k]===v));if(!r)return null;return Object.assign({...r},{async update(changes){Object.assign(r,changes);Object.assign(this,changes);return this;}});},
 async create(d){if(records.some(r=>r.employerId===d.employerId&&r.period===d.period&&r.site===d.site))throw Object.assign(new Error(),{name:'SequelizeUniqueConstraintError'});const r={id:randomUUID(),status:'draft',version:1,...d};records.push(r);return r;},
 async findAndCountAll({where}){const r=records.filter(r=>Object.entries(where).every(([k,v])=>r[k]===v));return {rows:r,count:r.length};}
};
require.cache[require.resolve('../src/models/index')]={exports:{User:{findByPk:async id=>Object.values(users).find(u=>u.id===id)}}};
require.cache[require.resolve('../src/models/WageRegister')]={exports:model};
require.cache[require.resolve('../src/models/AuditLog')]={exports:{create:async d=>{if(auditFail)throw new Error('Audit unavailable');audits.push(d);}}};
require.cache[require.resolve('../src/config/database')]={exports:{transaction:async fn=>{const snapshot=JSON.parse(JSON.stringify({records,audits}));try{return await fn({LOCK:{UPDATE:'UPDATE'}});}catch(e){records=snapshot.records;audits=snapshot.audits;throw e;}}}};
const app=express();app.use(express.json());app.use('/api/v1/wage-registers',require('../src/routes/wageRegister.routes'));let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/v1/wage-registers`;});after(()=>new Promise(r=>server.close(r)));beforeEach(()=>{records=[];audits=[];auditFail=false;});
async function req(role,path='',method='GET',body){const form=body instanceof FormData;const r=await fetch(base+path,{method,headers:{...(role?{Authorization:'Bearer '+jwt.sign({id:users[role].id},process.env.JWT_SECRET)}:{}),...(!form&&body?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:form?body:JSON.stringify(body)});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.arrayBuffer()};}
async function form(){const wb=new ExcelJS.Workbook(),s=wb.addWorksheet('Attendance');s.getCell('C4').value='Name of Employees';s.getCell('B6').value='001';s.getCell('C6').value='Employee';for(let i=1;i<=31;i++){s.getCell(5,i+5).value=new Date(`2024-07-${String(i).padStart(2,'0')}T00:00:00Z`);s.getCell(6,i+5).value=i<=26?'P':'WO';}const f=new FormData();f.append('file',new Blob([await wb.xlsx.writeBuffer()]),'attendance.xlsx');f.append('period','2024-07');f.append('site','Test');return f;}
async function imported(){const r=await req('employer','','POST',await form());assert.equal(r.status,201);return r.data.data;}
test('real JWT routes reject public, candidate, admin and trainer; super admin is read only',async()=>{
 assert.equal((await req(null)).status,401);for(const role of ['candidate','admin','trainer'])assert.equal((await req(role)).status,403);
 assert.equal((await req('super_admin')).status,200);assert.equal((await req('super_admin','','POST',await form())).status,403);
});
test('preview does not persist; duplicate month/site rejected; employer data isolation and super visibility',async()=>{
 assert.equal((await req('employer','/preview','POST',await form())).status,200);assert.equal(records.length,0);const r=await imported();
 assert.equal((await req('employer','','POST',await form())).status,409);assert.equal((await req('otherEmployer','/'+r.id)).status,404);assert.equal((await req('otherEmployer')).data.data.length,0);assert.equal((await req('super_admin','/'+r.id)).status,200);
});
test('save recalculates totals, detects stale edits and prohibits attendance changes',async()=>{
 const r=await imported();r.rows[0].rate=595;r.rows[0].net=999999;
 const saved=await req('employer','/'+r.id,'PUT',{version:1,rows:r.rows});assert.equal(saved.status,200);assert.equal(saved.data.data.rows[0].net,13554);
 assert.equal((await req('employer','/'+r.id,'PUT',{version:1,rows:r.rows})).status,409);
 r.rows[0].days[0].code='A';assert.equal((await req('employer','/'+r.id,'PUT',{version:2,rows:r.rows})).status,400);
});
test('approval validates rates, locks edits and is not repeatable; super can export not mutate',async()=>{
 let r=await imported();assert.equal((await req('employer','/'+r.id+'/approve','POST',{version:1})).status,400);
 r.rows[0].rate=595;r=(await req('employer','/'+r.id,'PUT',{version:1,rows:r.rows})).data.data;
 assert.equal((await req('super_admin','/'+r.id,'PUT',{version:2,rows:r.rows})).status,403);
 const approved=await req('employer','/'+r.id+'/approve','POST',{version:2});assert.equal(approved.status,200);assert.equal(approved.data.data.status,'approved');
 assert.equal((await req('employer','/'+r.id,'PUT',{version:3,rows:r.rows})).status,409);assert.equal((await req('employer','/'+r.id+'/approve','POST',{version:3})).status,409);
 assert.equal((await req('super_admin','/'+r.id+'/export')).status,200);assert.equal(audits.length,3);
});
test('audit failure rolls back imports and wage changes',async()=>{
 auditFail=true;assert.equal((await req('employer','','POST',await form())).status,500);assert.equal(records.length,0);
 auditFail=false;const r=await imported();r.rows[0].rate=595;auditFail=true;await req('employer','/'+r.id,'PUT',{version:1,rows:r.rows});assert.equal(records[0].version,1);assert.equal(records[0].rows[0].rate,0);
});

test('attendance replacement keeps matched wage values and rejects stale/approved replacements',async()=>{
 let r=await imported();r.rows[0].rate=595;r=(await req('employer','/'+r.id,'PUT',{version:1,rows:r.rows})).data.data;
 let f=await form();f.append('version','2');const result=await req('employer','/'+r.id+'/attendance','POST',f);assert.equal(result.status,200);assert.equal(result.data.data.rows[0].rate,595);assert.equal(result.data.data.version,3);
 f=await form();f.append('version','2');assert.equal((await req('employer','/'+r.id+'/attendance','POST',f)).status,409);
 await req('employer','/'+r.id+'/approve','POST',{version:3});f=await form();f.append('version','4');assert.equal((await req('employer','/'+r.id+'/attendance','POST',f)).status,409);
});

test('JSONB property ordering does not reject unchanged attendance during wage edits',async()=>{
 const importedRow=await imported();
 // PostgreSQL JSONB can return code before date regardless of insertion order.
 records[0].rows[0].days=records[0].rows[0].days.map(d=>({code:d.code,date:d.date}));
 let r=(await req('employer','/'+importedRow.id)).data.data;
 r.rows[0].rate=500;
 const saved=await req('employer','/'+r.id,'PUT',{version:1,rows:r.rows});
 assert.equal(saved.status,200);assert.equal(saved.data.data.rows[0].basic,13000);
 r=saved.data.data;r.rows[0].days[0].code='A';
 assert.equal((await req('employer','/'+r.id,'PUT',{version:2,rows:r.rows})).status,400);
});
