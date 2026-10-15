const ExcelJS = require('exceljs');

async function attendanceTemplate(period) {
  if (typeof period !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) {
    throw Object.assign(new Error('Choose a valid payroll month'), { status: 400 });
  }
  const [year, month] = period.split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Insta-HR';
  const sheet = workbook.addWorksheet('Attendance', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  });
  const last = 4 + days;
  const band = (row, text, fill, size = 11) => {
    sheet.mergeCells(row, 1, row, last);
    const cell = sheet.getCell(row, 1); cell.value = text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { name: 'Calibri', size, color: { argb: fill === 'FF1D4ED8' ? 'FFFFFFFF' : 'FF1F2937' }, bold: row === 1 };
    cell.alignment = { vertical: 'middle', wrapText: true }; sheet.getRow(row).height = row === 1 ? 30 : 26;
  };
  band(1, `Monthly attendance — ${period}`, 'FF1D4ED8', 16);
  band(2, 'Fill one row per employee. Keep IDs unique and retain every date column. Add rows below the blank entry area when needed.', 'FFEFF6FF');
  band(3, 'Codes: P, PH (or H), WO, A, CL, CO, LWP, OD, PL, SL, HD. Leave a cell blank only when attendance is unknown. See Instructions.', 'FFF1F5F9');
  ['Employee ID', 'Name of Employee', 'Location', 'Designation'].forEach((label, index) => {
    sheet.mergeCells(5, index + 1, 6, index + 1); sheet.getCell(5, index + 1).value = label;
    sheet.getColumn(index + 1).width = [18, 28, 22, 22][index];
  });
  for (let day = 1; day <= days; day++) {
    const column = day + 4, date = new Date(Date.UTC(year, month - 1, day));
    sheet.getCell(5, column).value = date; sheet.getCell(5, column).numFmt = 'ddd';
    sheet.getCell(6, column).value = date; sheet.getCell(6, column).numFmt = 'dd-mmm';
    sheet.getColumn(column).width = 9;
  }
  for (let row = 5; row <= 6; row++) {
    sheet.getRow(row).height = 26;
    for (let col = 1; col <= last; col++) {
      const cell = sheet.getCell(row, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      cell.alignment = { vertical: 'middle', horizontal: col > 4 ? 'center' : 'left', wrapText: true };
    }
  }
  for (let row = 7; row <= 56; row++) {
    sheet.getRow(row).height = 22;
    for (let col = 1; col <= last; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1D4ED8' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row % 2 ? 'FFFFFFFF' : 'FFF8FAFC' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      cell.alignment = { vertical: 'middle', horizontal: col > 4 ? 'center' : 'left' };
      cell.numFmt = '@';
      if (col > 4) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"P,PH,H,WO,A,CL,CO,LWP,OD,PL,SL,HD"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Invalid attendance code', error: 'Choose an attendance code from the list.' };
    }
  }
  sheet.pageSetup.printTitlesRow = '1:6';
  const help = workbook.addWorksheet('Instructions');
  help.columns = [{ width: 22 }, { width: 95 }];
  help.addRow(['Attendance template', period]);
  help.addRow(['How to fill', 'Enter employee ID and name, then location/designation if needed. Fill one daily code per employee. No sample employees are included.']);
  help.addRow(['Employee IDs', 'Use stable unique IDs. The ID column is text so leading zeroes are retained. Employees do not need portal accounts.']);
  help.addRow(['Month', 'Download a new template for each payroll month. Do not edit, remove or replace the real date headers with text or formulas.']);
  help.addRow(['More employees', '50 blank rows are supplied. Add rows below them if needed. Maximum 500 employees and 1,000 worksheet rows.']);
  help.addRow(['Payable days', 'The current wage policy counts P + PH only. H is converted to PH. Weekly offs and leave codes do not add payable days.']);
  for (const [code, label] of [['P', 'Present'], ['PH / H', 'Public holiday'], ['WO', 'Weekly off'], ['A', 'Absent'], ['CL', 'Casual leave'], ['CO', 'Compensatory off'], ['LWP', 'Leave without pay'], ['OD', 'On duty'], ['PL', 'Privilege leave'], ['SL', 'Sick leave'], ['HD', 'Half day']]) help.addRow([code, label]);
  help.addRow(['Upload', 'Save as .xlsx, select the same payroll month and site in the employer wage-register page, preview, then confirm import. Enter wage rates in the portal.']);
  help.eachRow((row, index) => { row.height = index <= 6 || index === 18 ? 42 : 24; row.eachCell(cell => { cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1F2937' }, bold: index === 1 }; cell.alignment = { wrapText: true, vertical: 'middle' }; }); });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
module.exports = { attendanceTemplate };
