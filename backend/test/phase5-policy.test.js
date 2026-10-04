const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSession, parseCourse, canJoin } = require('../src/services/trainingPolicy');
test('session dates require explicit timezone and end after start; meeting links cannot execute scripts', () => {
  const good = { title: 'Session', mode: 'online', startsAt: '2027-01-01T10:00:00+05:30', endsAt: '2027-01-01T11:00:00+05:30', meetingUrl: 'https://meet.example/session' };
  assert.equal(parseSession(good).startsAt.toISOString(), '2027-01-01T04:30:00.000Z');
  assert.throws(() => parseSession({ ...good, startsAt: '2027-01-01T10:00' }));
  assert.throws(() => parseSession({ ...good, endsAt: good.startsAt }));
  assert.throws(() => parseSession({ ...good, meetingUrl: 'javascript:alert(1)' }));
  assert.throws(() => parseSession({ ...good, meetingUrl: 'https://user:pass@meet.example' }));
});
test('closed or expired classes cannot be joined; string booleans and curriculum parse consistently', () => {
  const session = { mode: 'online', status: 'live', batchId: 'a', endsAt: new Date(Date.now() + 60000) };
  const member = { status: 'active', batchId: 'a' };
  assert.equal(canJoin(session, member), true);
  assert.equal(canJoin({ ...session, status: 'cancelled' }, member), false);
  assert.equal(canJoin({ ...session, endsAt: new Date(0) }, member), false);
  assert.equal(canJoin(session, { ...member, batchId: 'b' }), false);
  assert.equal(canJoin(session, { ...member, status: 'cancelled' }), false);
  assert.equal(parseCourse({ isFree: 'false', price: '99', curriculum: '[{"title":"Basics"}]' }).isFree, false);
  assert.equal(parseCourse({ isFree: 'true', price: '99' }).price, 0);
});
