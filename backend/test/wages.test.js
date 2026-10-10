const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { calculate, normalizeRows } = require('../src/services/wageCalculation');
const { parse } = require('../src/services/attendanceWorkbook');
const { exported } = require('../src/services/wageExport');
const days = Array.from({length:31},(_,i)=>({date:`2024-07-${String(i+1).padStart(2,'0')}`,code:i<25?'P':i===25?'PH':i<30?'WO':'A'}));
const row = () => ({employeeId:'0001',name:'Test employee',days,rate:595});
async function workbook(change) {
  const wb = new ExcelJS.Workbook(), s=wb.addWorksheet('JULY2024');
  s.getCell('B4').value='Emp ID';s.getCell('C4').value='Name of Employees';s.mergeCells('C4:C5');
  days.forEach((d,i)=>{s.getCell(5,i+6).value=new Date(d.date+'T00:00:00Z');s.getCell(6,i+6).value=d.code;});
  s.getCell('B6').value='0001';s.getCell('C6').value='Test employee';s.getCell('AK6').value={formula:'999',result:999};
  s.mergeCells('A7:E7');s.getCell('A7').value='TOTAL ON MUSTER';s.getCell('F7').value={formula:'SUM(F6)',result:1};
  if(change)change(s);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
test('supplied wage example matches basic, PF, ESIC, deductions and net exactly',()=>{
  const r=normalizeRows([row()])[0];assert.equal(r.payableDays,26);
  assert.equal(r.basic,15470);assert.equal(r.pf,1800);assert.equal(r.esic,116);assert.equal(r.deductions,1916);assert.equal(r.net,13554);
});
test('overtime, all earnings/deductions and employer contribution remain separate',()=>{
  const r=calculate({rate:595,payableDays:20,overtimeHours:8,specialBasic:100,da:50,hra:200,otherEarnings:25,society:10,incomeTax:20,insurance:30,otherDeductions:40,recoveries:50,employerContribution:800});
  assert.equal(r.overtime,1190);assert.equal(r.earnings,13465);assert.equal(r.pf,1428);assert.equal(r.esic,101);assert.equal(r.deductions,1679);assert.equal(r.net,11786);assert.equal(r.employerContribution,800);
});
test('only P + PH/H count, leave and weekly off excluded; client totals ignored',()=>{
  const r=normalizeRows([{...row(),days:[{date:'2024-07-01',code:'p'},{date:'2024-07-02',code:'H'},{date:'2024-07-03',code:'WO'},{date:'2024-07-04',code:'PL'}],payableDays:31,basic:999999}])[0];
  assert.equal(r.payableDays,2);assert.equal(r.basic,1190);assert.equal(r.days[1].code,'PH');
});
test('invalid inputs, employee duplicates and unknown attendance codes rejected',()=>{
  for(const rate of [-1,'NaN','1e4',{},'1.123']) assert.throws(()=>calculate({rate}));
  assert.throws(()=>normalizeRows([row(),row()]),/unique/);
  assert.throws(()=>normalizeRows([{...row(),days:[{date:'2024-07-01',code:'XX'}]}]),/Unknown/);
  assert.throws(()=>normalizeRows([{...row(),uan:'123'}]),/UAN/);
});
test('Excel import preserves employee ID, ignores summaries, handles merged headings/footer',async()=>{
  const r=await parse(await workbook(),'2024-07');assert.equal(r.rows.length,1);assert.equal(r.rows[0].employeeId,'0001');assert.equal(r.rows[0].payableDays,26);
});
test('wrong months, incomplete dates, daily formulas and invalid archives rejected',async()=>{
  await assert.rejects(parse(await workbook(),'2024-08'),/month/);
  await assert.rejects(parse(await workbook(s=>s.getCell('AJ5').value=null),'2024-07'),/every date/);
  await assert.rejects(parse(await workbook(s=>s.getCell('F6').value={formula:'"P"',result:'P'}),'2024-07'),/not formulas/);
  await assert.rejects(parse(Buffer.from('not Excel'),'2024-07'),/xlsx/);
});
test('export contains cross-sheet attendance formulas and matching cached wage totals',async()=>{
  const r=normalizeRows([row()])[0];const wb=exported({period:'2024-07',site:'Test',employerId:'test',status:'draft',rows:[r]});
  const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await wb.xlsx.writeBuffer());const s=loaded.getWorksheet('FORM B - WAGE');
  assert.match(s.getCell('F5').value.formula,/FORM D- ATTENDENCE/);assert.equal(s.getCell('W5').value.result,13554);assert.equal(s.getCell('W6').value.result,13554);assert.equal(s.getCell('B5').value,'0001');
  assert.match(s.getCell('P5').value.formula,/ROUND.*0.75%/);assert.equal(loaded.getWorksheet('FORM D- ATTENDENCE').getCell('AH2').value.result,26);
});
