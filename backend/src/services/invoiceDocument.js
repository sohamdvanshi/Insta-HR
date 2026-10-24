const PDFDocument = require('pdfkit');
function subscriptionSnapshot(payment, user, paidAt = new Date()) {
  return { number: `SUB-${payment.id}`, date: paidAt.toISOString(), seller: process.env.BILLING_SELLER_NAME || 'Insta-HR', sellerAddress: process.env.BILLING_SELLER_ADDRESS || '', sellerTaxId: process.env.BILLING_SELLER_TAX_ID || '', buyer: user.email, description: `${payment.planName || payment.plan} subscription (${payment.billingCycle || 'monthly'}, ${payment.planDurationDays} days)`, currency: payment.currency, total: Number(payment.amount), subtotal: Number(payment.amount), tax: null, paymentId: payment.paymentId, orderId: payment.orderId, expiresAt: payment.expiresAt ? new Date(payment.expiresAt).toISOString() : null };
}
function renderInvoice(res, snapshot, status) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${String(snapshot.number).replace(/[^a-zA-Z0-9-]/g, '')}.pdf"`);
  doc.on('error', error => res.destroy(error));
  doc.pipe(res);
  const money = v => `${snapshot.currency || 'INR'} ${Number(v).toFixed(2)}`;
  const date = value => value ? new Date(value).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' }) : '-';
  const line = (label, value) => {
    if (value !== null && value !== undefined && value !== '') doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`${label}: ${value}`, { width: 495 }).moveDown(0.5);
  };
  doc.rect(0, 0, 612, 108).fill('#172554');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text(snapshot.seller || 'Insta-HR', 50, 32, {width:360});
  doc.fontSize(11).text(status === 'draft' ? 'DRAFT INVOICE' : status === 'cancelled' ? 'CANCELLED INVOICE' : 'INVOICE', 50, 73);
  doc.fontSize(11).text(String(status).toUpperCase(), 440, 76, {width:100,align:'right'});
  doc.x = 50; doc.y = 135;
  line('Invoice number', snapshot.number); line('Issued', date(snapshot.date));
  line('Supplier address', snapshot.sellerAddress); line('Supplier tax ID', snapshot.sellerTaxId);
  doc.moveDown(); doc.font('Helvetica-Bold').fontSize(11).fillColor('#172554').text('BILL TO').moveDown(0.5);
  doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(snapshot.buyer || '-', {width:495}).moveDown(1.5);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#172554').text('DESCRIPTION').moveDown(0.5);
  doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(snapshot.description || '-', {width:495}).moveDown(1.5);
  const y = doc.y;
  doc.moveTo(50,y).lineTo(545,y).strokeColor('#cbd5e1').stroke();
  doc.x=50;doc.y=y+16;
  line('Subtotal', money(snapshot.subtotal));
  if (snapshot.tax !== null) line('Tax', money(snapshot.tax));
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#172554').text(`Total: ${money(snapshot.total)}`).moveDown(1.3);
  line('Due date', snapshot.dueDate ? date(snapshot.dueDate) : null);
  line('Payment reference', snapshot.paymentId); line('Order reference', snapshot.orderId);
  line('Valid until', snapshot.expiresAt ? date(snapshot.expiresAt) : null); line('Terms', snapshot.terms);
  if (snapshot.tax === null) doc.moveDown().font('Helvetica').fontSize(9).fillColor('#64748b').text('No tax breakdown has been recorded for this subscription.', {width:495});
  doc.end();
}
module.exports = { subscriptionSnapshot, renderInvoice };
