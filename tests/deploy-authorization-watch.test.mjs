import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLD_MS, classifyPending, PENDING_LABEL } from '../scripts/deploy-authorization-watch.mjs';

const issue = { number: 196 };
const labeled = (created_at) => [{ event: 'labeled', label: { name: PENDING_LABEL }, created_at }];

test('waits below the one-hour authorisation threshold', () => {
  const now = Date.parse('2026-09-21T12:59:59Z');
  const row = classifyPending(issue, labeled('2026-09-21T12:00:01Z'), now);
  assert.equal(row.state, 'waiting');
  assert.equal(row.ageMs, THRESHOLD_MS - 2000);
});

test('POSITIVE CONTROL — an hour-old pending label becomes overdue', () => {
  const now = Date.parse('2026-09-21T13:00:00Z');
  const row = classifyPending(issue, labeled('2026-09-21T12:00:00Z'), now);
  assert.equal(row.state, 'overdue');
});

test('fails closed when the pending-label event is absent', () => {
  const row = classifyPending(issue, [{ event: 'labeled', label: { name: 'unrelated' }, created_at: '2026-09-21T12:00:00Z' }]);
  assert.equal(row.state, 'could-not-look');
  assert.equal(row.since, null);
});
