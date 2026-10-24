const { fail } = require('./adminPolicy');
const transitions = { draft: ['sent', 'cancelled'], sent: ['paid', 'overdue', 'cancelled'], overdue: ['paid', 'cancelled'], paid: [], cancelled: [] };
function validateTransition(invoice, status, now = new Date()) {
  if (!Object.hasOwn(transitions, status)) fail('Invalid invoice status');
  if (invoice.status === status) return;
  if (!transitions[invoice.status]?.includes(status)) fail('This invoice status change is not allowed', 409);
  if (status === 'overdue' && String(invoice.dueDate).slice(0,10) >= now.toISOString().slice(0,10)) fail('The invoice is not overdue yet', 409);
}
module.exports = { validateTransition };
