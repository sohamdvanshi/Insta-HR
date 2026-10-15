const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const express = require('express');
const jwt = require('jsonwebtoken');
const { attendanceTemplate } = require('../src/services/attendanceTemplate');
const { parse } = require('../src/services/attendanceWorkbook');

test('monthly template has real complete date headers, code validation and no sample employees', async () => {
  for (const [period, days] of [['2024-02', 29], ['2025-02', 28], ['2026-04', 30], ['2026-12', 31]]) {
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await attendanceTemplate(period));
    const sheet = book.getWorksheet('Attendance');
    assert.equal(sheet.getCell('B5').value, 'Name of Employee');
    const dates = [];
    for (let column = 5; column <= 4 + days; column++) dates.push(sheet.getCell(6, column).value.toISOString().slice(0, 10));
    assert.equal(dates[0], period + '-01'); assert.equal(dates.at(-1), `${period}-${days}`);
    assert.equal(new Set(dates).size, days); assert.equal(sheet.columnCount, 4 + days);
    assert.equal(sheet.getCell('A7').numFmt, '@'); assert.equal(sheet.getCell('B7').value, null);
    assert.equal(sheet.getCell('E7').dataValidation.type, 'list');
    assert.ok(sheet.getCell('E7').dataValidation.formulae[0].includes('PH'));
    assert.equal(sheet.views[0].xSplit, 4); assert.equal(sheet.views[0].ySplit, 6);
    assert.ok(book.getWorksheet('Instructions'));
  }
});
test('downloaded template filled by an employer round-trips through the existing attendance importer', async () => {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await attendanceTemplate('2024-02'));
  const sheet = book.getWorksheet('Attendance');
  sheet.getCell('A7').value = '00001'; sheet.getCell('B7').value = 'Test Employee';
  sheet.getCell('C7').value = 'Site A'; sheet.getCell('D7').value = 'Operator';
  sheet.getCell('E7').value = 'P'; sheet.getCell('F7').value = 'H'; sheet.getCell('G7').value = 'WO';
  const buffer = Buffer.from(await book.xlsx.writeBuffer()), result = await parse(buffer, '2024-02');
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].employeeId, '00001');
  assert.equal(result.rows[0].location, 'Site A'); assert.equal(result.rows[0].designation, 'Operator');
  assert.equal(result.rows[0].days.length, 29); assert.equal(result.rows[0].payableDays, 2); assert.equal(result.rows[0].weeklyOffs, 1);
  await assert.rejects(parse(buffer, '2024-03'), /Selected month does not match/);
});
test('template refuses missing, malformed and out-of-range payroll months', async () => {
  for (const period of [undefined, '', '2026-13', '2026-2', '1999-12', '2100-01', ['2026-10']]) await assert.rejects(attendanceTemplate(period), /Choose a valid payroll month/);
});

const users = Object.fromEntries(['employer', 'super_admin', 'admin', 'candidate', 'trainer'].map(role => [role, { id: role, role, isActive: true }]));
const modelPath = require.resolve('../src/models/index');
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: { User: { findByPk: async id => users[id] } } };
process.env.JWT_SECRET = 'template-test-only-secret';
test('real template route requires employer auth and returns a named XLSX before the dynamic ID route', async () => {
  const app = express(); app.use('/api/v1/wage-registers', require('../src/routes/wageRegister.routes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/wage-registers/template`;
  const headers = role => ({ Authorization: 'Bearer ' + jwt.sign({ id: role }, process.env.JWT_SECRET) });
  try {
    assert.equal((await fetch(base + '?period=2026-10')).status, 401);
    for (const role of ['candidate', 'admin', 'trainer', 'super_admin']) assert.equal((await fetch(base + '?period=2026-10', { headers: headers(role) })).status, 403);
    assert.equal((await fetch(base, { headers: headers('employer') })).status, 400);
    const response = await fetch(base + '?period=2026-10', { headers: headers('employer') });
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /spreadsheetml/);
    assert.ok(response.headers.get('content-disposition').includes('attendance-template-2026-10.xlsx'));
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.equal(book.getWorksheet('Attendance').getCell('E6').value.toISOString().slice(0, 10), '2026-10-01');
  } finally { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
});
