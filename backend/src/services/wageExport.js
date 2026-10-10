const ExcelJS = require('exceljs');
function exported(register) {
  const wb = new ExcelJS.Workbook(); wb.calcProperties.fullCalcOnLoad = true;
  const a = wb.addWorksheet('FORM D- ATTENDENCE');
  a.addRow(['Employee ID','Name', ...register.rows[0].days.map(d => d.date),'P + PH']);
  register.rows.forEach((row, index) => {
    a.addRow([row.employeeId,row.name,...row.days.map(d => d.code),row.payableDays]);
    const end = a.getColumn(row.days.length + 2).letter;
    a.getCell(index + 2, row.days.length + 3).value = { formula: `COUNTIF(C${index+2}:${end}${index+2},"P")+COUNTIF(C${index+2}:${end}${index+2},"PH")`, result: row.payableDays };
  });
  const s = wb.addWorksheet('FORM B - WAGE');
  s.addRow(['FORM B — WAGE REGISTER']);
  s.addRow(['Wage period',register.period,'Site',register.site,'Status',register.status]);
  s.addRow(['Employer ID',register.employerId]);
  s.addRow(['S.No','Employee ID','UAN','Name','Rate of Wage','No. of Days worked','Overtime hours worked','Basic','Special Basic','DA','Payments Overtime','HRA','Other Earnings','Total Earnings','PF','ESIC','Society','Income Tax','Insurance','Other Deductions','Recoveries','Total Deductions','Net Payment','Employer Share PF Welfare Fund','Receipt / Bank transaction ID','Date of payment','Remarks']);
  register.rows.forEach((r, i) => {
    const n = i + 5;
    s.addRow([i+1,r.employeeId,r.uan,r.name,r.rate,r.payableDays,r.overtimeHours,r.basic,r.specialBasic,r.da,r.overtime,r.hra,r.otherEarnings,r.earnings,r.pf,r.esic,r.society,r.incomeTax,r.insurance,r.otherDeductions,r.recoveries,r.deductions,r.net,r.employerContribution,r.transactionId,r.paymentDate,r.remarks]);
    const formulas = { F: `'FORM D- ATTENDENCE'!${a.getColumn(r.days.length+3).letter}${i+2}`, H: `E${n}*F${n}`, K: `E${n}/4*G${n}`, N: `SUM(H${n}:M${n})`, O: `MIN(H${n},15000)*0.12`, P: `ROUND(N${n}*0.75%,0)`, V: `SUM(O${n}:U${n})`, W: `N${n}-V${n}` };
    Object.entries(formulas).forEach(([col, formula]) => { const cell = s.getCell(`${col}${n}`); cell.value = { formula: ['H','K','N','O','V','W'].includes(col) ? `ROUND(${formula},2)` : formula, result: Number(cell.value) }; });
  });
  const end = register.rows.length + 4, total = end + 1;
  s.getCell(`D${total}`).value = 'TOTAL';
  ['F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X'].forEach(col => {
    let result = 0; for (let n=5;n<=end;n++) { const v = s.getCell(`${col}${n}`).value; result += typeof v === 'object' ? v.result : Number(v || 0); }
    s.getCell(`${col}${total}`).value = { formula: `SUM(${col}5:${col}${end})`, result: Math.round(result*100)/100 };
  });
  for (const sh of [a,s]) {
    sh.views = [{ state: 'frozen', ySplit: sh === s ? 4 : 1, xSplit: sh === s ? 4 : 2 }];
    sh.columns.forEach(c => { c.width = 18; });
    sh.getRow(sh === s ? 4 : 1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; c.alignment = { wrapText: true }; });
    sh.getRow(sh === s ? 4 : 1).height = 45;
    sh.autoFilter = { from: { row: sh === s ? 4 : 1, column: 1 }, to: { row: sh === s ? 4 : 1, column: sh.columnCount } };
  }
  for (const col of ['E','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X']) s.getColumn(col).numFmt = '#,##0.00';
  s.getColumn('B').numFmt = '@'; s.getColumn('C').numFmt = '@';
  s.pageSetup = { orientation: 'landscape', paperSize: 8, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' };
  return wb;
}
module.exports = { exported };
