// Reproduces the supplied FORM B workbook, not a general statutory rules engine.
const INPUTS = ['rate','overtimeHours','specialBasic','da','hra','otherEarnings','society','incomeTax','insurance','otherDeductions','recoveries','employerContribution'];
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
function number(value, name, max = 10000000) {
  if (value === '' || value === undefined || value === null) return 0;
  if (!['string','number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error(`${name} must be a nonnegative number with at most two decimals`);
  const n = Number(value);
  if (!Number.isFinite(n) || n > max) throw new Error(`${name} exceeds the allowed limit`);
  return n;
}
function calculate(row) {
  const input = Object.fromEntries(INPUTS.map(k => [k, number(row[k], k, k === 'overtimeHours' ? 744 : 10000000)]));
  const payableDays = number(row.payableDays, 'payableDays', 31);
  const basic = money(input.rate * payableDays);
  const overtime = money(input.rate / 4 * input.overtimeHours);
  const earnings = money(basic + input.specialBasic + input.da + overtime + input.hra + input.otherEarnings);
  const pf = money(Math.min(basic, 15000) * 0.12);
  const esic = Math.round(earnings * 0.0075);
  const deductions = money(pf + esic + input.society + input.incomeTax + input.insurance + input.otherDeductions + input.recoveries);
  return { ...input, payableDays, basic, overtime, earnings, pf, esic, deductions, net: money(earnings - deductions) };
}
function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('A register requires 1–500 employees');
  const ids = new Set();
  return rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid employee row');
    const employeeId = String(row.employeeId || '').trim();
    if (!employeeId || employeeId.length > 80 || ids.has(employeeId)) throw new Error('Employee IDs must be present and unique within this register');
    ids.add(employeeId);
    const name = String(row.name || '').trim();
    if (!name || name.length > 200) throw new Error('Employee name is required (maximum 200 characters)');
    const days = row.days;
    if (!Array.isArray(days) || days.length > 31) throw new Error('Invalid daily attendance');
    const dateSet = new Set();
    const cleanDays = days.map(d => {
      if (!d || typeof d !== 'object') throw new Error('Invalid daily attendance');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || dateSet.has(d.date)) throw new Error('Invalid or duplicate attendance date');
      dateSet.add(d.date);
      const code = String(d.code || '').trim().toUpperCase();
      if (!['P','PH','H','WO','A','CL','CO','LWP','OD','PL','SL','HD',''].includes(code)) throw new Error(`Unknown attendance code: ${code}`);
      return { date: d.date, code: code === 'H' ? 'PH' : code };
    });
    const presentDays = cleanDays.filter(d => d.code === 'P').length;
    const holidayDays = cleanDays.filter(d => d.code === 'PH').length;
    const payableDays = presentDays + holidayDays;
    const text = k => String(row[k] || '').trim().slice(0, k === 'remarks' ? 1000 : 200);
    const result = { employeeId, name, days: cleanDays, presentDays, holidayDays, weeklyOffs: cleanDays.filter(d => d.code === 'WO').length,
      designation: text('designation'), location: text('location'), group: text('group'), uan: text('uan'), transactionId: text('transactionId'), paymentDate: text('paymentDate'), remarks: text('remarks'), ...calculate({ ...row, payableDays }) };
    if (result.uan && !/^\d{12}$/.test(result.uan)) throw new Error('UAN must contain 12 digits');
    if (result.paymentDate && (!/^\d{4}-\d{2}-\d{2}$/.test(result.paymentDate) || Number.isNaN(Date.parse(result.paymentDate)) || new Date(result.paymentDate).toISOString().slice(0,10) !== result.paymentDate)) throw new Error('Invalid payment date');
    return result;
  });
}
module.exports = { INPUTS, calculate, normalizeRows, money };
