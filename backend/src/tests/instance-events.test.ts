import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatInstanceEventsSummary,
  getInstanceEventsRetentionCutoff,
  getInstanceEventsRetentionDays,
} from '../services/instanceEvents';

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('instance event retention defaults to 30 days', () => {
  delete process.env.INSTANCE_EVENTS_RETENTION_DAYS;
  assert.equal(getInstanceEventsRetentionDays(), 30);
});

test('instance event retention can be disabled with zero', () => {
  process.env.INSTANCE_EVENTS_RETENTION_DAYS = '0';
  assert.equal(getInstanceEventsRetentionDays(), 0);
  assert.equal(getInstanceEventsRetentionCutoff(new Date('2026-08-01T00:00:00.000Z')), null);
});

test('instance event retention cutoff uses whole days', () => {
  process.env.INSTANCE_EVENTS_RETENTION_DAYS = '7';
  const cutoff = getInstanceEventsRetentionCutoff(new Date('2026-08-01T12:00:00.000Z'));
  assert.equal(cutoff?.toISOString(), '2026-07-25T12:00:00.000Z');
});

test('instance event summary formatter avoids raw secrets and includes counts', () => {
  const text = formatInstanceEventsSummary({
    instanceName: 'inst-1',
    days: 7,
    since: new Date('2026-07-25T00:00:00.000Z'),
    total: 3,
    unreadCount: 1,
    severity: { info: 0, warning: 1, critical: 2 },
    topTypes: [{ type: 'proxy.test_failed', count: 2 }],
    lastCritical: {
      id: 'event-1',
      type: 'proxy.test_failed',
      title: 'Falha no proxy',
      summary: 'proxy_auth_407',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      readAt: null,
    },
  });

  assert.match(text, /Total de eventos: 3/);
  assert.match(text, /Criticos: 2/);
  assert.match(text, /proxy\.test_failed: 2/);
  assert.doesNotMatch(text, /botToken|secret/i);
});
