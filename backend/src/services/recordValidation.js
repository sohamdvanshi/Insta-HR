const invalid = message => { const error = new Error(message); error.status = 400; throw error; };
const monthRange = value => {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) invalid('Please enter a valid pay period month');
  const [year, month] = value.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { startDate: `${value}-01`, endDate: `${value}-${last}` };
};
const dateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Please enter a valid date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('Please enter a valid date');
  return value;
};
const money = (value, optional = false) => {
  if (optional && (value === undefined || value === null || value === '')) return 0;
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 9999999999.99) invalid('Amounts must be valid non-negative numbers');
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  if (Math.abs(rounded - Number(value)) > 0.000001) invalid('Amounts must have at most two decimal places');
  return rounded;
};
const dateRange = (start, end) => {
  dateOnly(start);
  if (end) { dateOnly(end); if (end < start) invalid('End date cannot be before start date'); }
};
module.exports = { monthRange, dateOnly, money, dateRange, invalid };
