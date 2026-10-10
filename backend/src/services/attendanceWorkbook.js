const ExcelJS = require('exceljs');
const { normalizeRows } = require('./wageCalculation');
function value(cell) {
  const v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if (v.formula || v.sharedFormula) throw new Error('Attendance dates, employee IDs and daily codes must be values, not formulas');
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.text) return v.text;
    return '';
  }
  return v == null ? '' : v;
}
function zipLimit(buffer) {
  // Bound expanded size before ExcelJS loads the archive.
  let total = 0, entries = 0;
  for (let i = 0; i < buffer.length - 46; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    const size = buffer.readUInt32LE(i + 24);
    total += size; entries++;
    if (size === 0xffffffff || total > 40000000 || entries > 2000) throw new Error('Workbook is too large after decompression');
    i += 45 + buffer.readUInt16LE(i + 28) + buffer.readUInt16LE(i + 30) + buffer.readUInt16LE(i + 32);
  }
  if (!entries) throw new Error('Upload an Excel .xlsx workbook');
}
function parseSheet(sheet, period) {
  let header;
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= Math.min(sheet.columnCount, 80); c++) {
      if (!header && String(row.getCell(c).value || '').toLowerCase().includes('name of employee')) header = { row: r, nameCol: c };
    }
  }
  if (!header) return null;
  const dateRow = sheet.getRow(header.row + 1), dates = [];
  for (let c = 1; c <= Math.min(sheet.columnCount, 80); c++) {
    const raw = dateRow.getCell(c).value;
    if (raw && typeof raw === 'object' && !(raw instanceof Date)) continue;
    const v = value(dateRow.getCell(c));
    if (v instanceof Date && !Number.isNaN(v.getTime())) dates.push({ col: c, date: v.toISOString().slice(0, 10) });
  }
  if (!dates.length) throw new Error('Date headers must be real Excel dates immediately below the employee header');
  if (dates.some(d => !d.date.startsWith(period + '-'))) throw new Error('Selected month does not match the attendance date headers');
  if (new Set(dates.map(d => d.date)).size !== dates.length) throw new Error('Duplicate date columns');
  const expectedDays = new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate();
  if (dates.length !== expectedDays) throw new Error('Attendance must contain every date of the selected month');
  const rows = [], warnings = ['Date headers determine the payroll month; printed month labels and Excel summary totals are ignored.', 'Payable days are recalculated from P + PH; H is treated as PH. WO and leave codes do not add payable days.'];
  for (let r = header.row + 2; r <= Math.min(sheet.rowCount, 1000); r++) {
    const row = sheet.getRow(r), name = String(value(row.getCell(header.nameCol))).trim();
    if (!name) continue;
    if (/^total\b/i.test(name)) break;
    const employeeId = String(value(row.getCell(header.nameCol - 1))).trim();
    // Exclude legends/footer rows with no employee ID and no daily codes.
    if (!employeeId && dates.every(d => !row.getCell(d.col).value)) continue;
    rows.push({ employeeId, name, location: String(value(row.getCell(header.nameCol + 1))), designation: String(value(row.getCell(header.nameCol + 2))),
      days: dates.map(d => ({ date: d.date, code: String(value(row.getCell(d.col))).trim() })) });
  }
  if (sheet.rowCount > 1000) throw new Error('Attendance sheet exceeds 1,000 rows');
  return { rows: normalizeRows(rows), warnings, sheet: sheet.name };
}
async function parse(buffer, period) {
  zipLimit(buffer);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  if (wb.worksheets.length > 20) throw new Error('Too many worksheets');
  const results = [];
  for (const sheet of wb.worksheets) { const result = parseSheet(sheet, period); if (result) results.push(result); }
  if (results.length !== 1) throw new Error('Upload a workbook with exactly one attendance sheet in the supplied template format');
  return results[0];
}
module.exports = { parse, parseSheet, zipLimit };
