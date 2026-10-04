const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { catalog, getEntitlement, profileDefaults, validateResume } = require('../src/services/resumePolicy');
const { canBuyPlan, validSignature, validateGatewayPayment } = require('../src/services/subscriptionPaymentPolicy');

test('free, expired, and Standard plans allow one saved resume; active Premium/Enterprise allow more', () => {
  for (const user of [{}, { subscriptionPlan: 'standard', subscriptionExpiry: '2099-01-01' }, { subscriptionPlan: 'premium', subscriptionExpiry: '2020-01-01' }]) {
    assert.equal(getEntitlement(user, 0).canCreate, true);
    assert.equal(getEntitlement(user, 1).canCreate, false);
    assert.equal(getEntitlement(user, 5).canCreate, false);
  }
  for (const plan of ['premium', 'enterprise']) assert.equal(getEntitlement({ subscriptionPlan: plan, subscriptionExpiry: '2099-01-01' }, 5).canCreate, true);
});
test('profile import normalizes optional data without inventing experience', () => {
  const draft = profileDefaults({ email: 'candidate@example.com' }, { firstName: 'Sam', lastName: 'Test', experience: [{ title: 'Engineer', startDate: null }], education: [{ institution: 'College', degree: null }] });
  assert.equal(draft.personalInfo.fullName, 'Sam Test');
  assert.equal(draft.experience[0].jobTitle, 'Engineer');
  assert.equal(draft.experience[0].startDate, '');
  assert.equal(validateResume(draft), null);
  assert.deepEqual(profileDefaults({}).experience, []);
});
test('all ten sectors have renderable structured samples and unique identifiers', () => {
  assert.equal(catalog.sectors.length, 10);
  assert.equal(catalog.samples.length, 20);
  assert.equal(new Set(catalog.samples.map(item => item.id)).size, 20);
  for (const sector of catalog.sectors) {
    assert.ok(sector.hints.length);
    for (const level of ['fresher', 'experienced']) {
      const sample = catalog.samples.find(item => item.sector === sector.id && item.level === level);
      assert.ok(sample.fictional);
      assert.equal(validateResume(sample), null);
      assert.equal(sample.template, sector.template);
    }
  }
});
test('invalid resume structures, templates, visibility, and URLs cannot inject rendering objects', () => {
  for (const value of [{ skills: {} }, { template: 'unknown' }, { sector: 'unknown' }, { visibility: 'public' }, { personalInfo: { fullName: {} } }, { experience: [{ bullets: [123] }] }, { isDefault: 'true' }]) assert.ok(validateResume(value));
});
test('candidate upgrade uses existing Premium/Enterprise, not employer-only Standard', () => {
  assert.equal(canBuyPlan({ role: 'candidate' }, 'premium'), true);
  assert.equal(canBuyPlan({ role: 'candidate' }, 'standard'), false);
  assert.equal(canBuyPlan({ role: 'employer' }, 'standard'), true);
});
test('payment proof rejects forged signatures, wrong accounts, plan substitution, and uncaptured payments', () => {
  const secret = 'test-only-secret';
  const signature = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
  assert.equal(validSignature({ orderId: 'order_1', paymentId: 'pay_1', signature, secret }), true);
  assert.equal(validSignature({ orderId: 'other', paymentId: 'pay_1', signature, secret }), false);
  assert.equal(validSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'bad', secret }), false);
  const proof = { user: { id: 'u1', role: 'candidate' }, order: { id: 'order_1', notes: { userId: 'u1', plan: 'premium' }, amount: 399900, currency: 'INR' }, payment: { order_id: 'order_1', status: 'captured', amount: 399900, currency: 'INR' }, requestedPlan: 'premium' };
  assert.equal(validateGatewayPayment(proof).plan, 'premium');
  assert.equal(validateGatewayPayment({ ...proof, user: { id: 'u2', role: 'candidate' } }), null);
  assert.equal(validateGatewayPayment({ ...proof, requestedPlan: 'enterprise' }), null);
  assert.equal(validateGatewayPayment({ ...proof, payment: { ...proof.payment, amount: 1 } }), null);
  assert.equal(validateGatewayPayment({ ...proof, payment: { ...proof.payment, status: 'authorized' } }), null);
  assert.equal(validateGatewayPayment({ ...proof, payment: { ...proof.payment, order_id: 'other' } }), null);
});
