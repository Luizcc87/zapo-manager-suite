import assert from 'node:assert/strict';
import test from 'node:test';

import {
  escapeTelegramHtml,
  isTelegramAlertsEnabled,
  isTelegramConnectionAlertsEnabled,
  resetTelegramAlertDedupe,
  sendTelegramAlert,
  setTelegramChannelResolverForTests,
  shouldSendTelegramAlert,
} from '../services/telegramAlerts';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function restore() {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
  resetTelegramAlertDedupe();
  setTelegramChannelResolverForTests();
}

test.afterEach(restore);

test('telegram alerts stay disabled without complete env vars', async () => {
  delete process.env.TELEGRAM_ALERTS_ENABLED;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  let called = false;
  global.fetch = (async () => {
    called = true;
    return new Response('{}', { status: 200 });
  }) as any;

  assert.equal(isTelegramAlertsEnabled(), false);
  await sendTelegramAlert({ type: 'proxy.test_failed', severity: 'critical', title: 'x', summary: 'y' });
  assert.equal(called, false);
});

test('telegram alerts call Telegram API without exposing token in message body', async () => {
  process.env.TELEGRAM_ALERTS_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'secret-token';
  process.env.TELEGRAM_CHAT_ID = '123';

  let requestedUrl = '';
  let body: any = null;
  global.fetch = (async (url: any, init: any) => {
    requestedUrl = String(url);
    body = JSON.parse(String(init.body));
    return new Response('{}', { status: 200 });
  }) as any;

  const sent = await sendTelegramAlert({
    instanceName: 'inst-1',
    type: 'mobile_account_takeover_notice',
    severity: 'critical',
    title: 'Takeover <detected>',
    summary: 'device & platform',
  });

  assert.equal(requestedUrl, 'https://api.telegram.org/botsecret-token/sendMessage');
  assert.equal(body.chat_id, '123');
  assert.equal(sent, true);
  assert.match(body.text, /Takeover &lt;detected&gt;/);
  assert.match(body.text, /device &amp; platform/);
  assert.doesNotMatch(body.text, /secret-token/);
});

test('telegram alerts prefer configured instance channel over global env', async () => {
  process.env.TELEGRAM_ALERTS_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'global-token';
  process.env.TELEGRAM_CHAT_ID = 'global-chat';
  setTelegramChannelResolverForTests(async () => ({ botToken: 'channel-token', chatId: 'channel-chat' }));

  let requestedUrl = '';
  let body: any = null;
  global.fetch = (async (url: any, init: any) => {
    requestedUrl = String(url);
    body = JSON.parse(String(init.body));
    return new Response('{}', { status: 200 });
  }) as any;

  const sent = await sendTelegramAlert({
    instanceName: 'inst-channel',
    type: 'proxy.test_failed',
    severity: 'critical',
    title: 'Proxy',
    summary: 'failed',
  });

  assert.equal(requestedUrl, 'https://api.telegram.org/botchannel-token/sendMessage');
  assert.equal(body.chat_id, 'channel-chat');
  assert.equal(sent, true);
  assert.doesNotMatch(body.text, /channel-token/);
});

test('telegram alert dedupe honors TELEGRAM_ALERT_DEDUPE_SECONDS', () => {
  process.env.TELEGRAM_ALERT_DEDUPE_SECONDS = '1';

  assert.equal(shouldSendTelegramAlert('same-key', 1000), true);
  assert.equal(shouldSendTelegramAlert('same-key', 1500), false);
  assert.equal(shouldSendTelegramAlert('same-key', 2100), true);
});

test('connection alerts require the dedicated opt-in flag', () => {
  delete process.env.TELEGRAM_ALERT_CONNECTION_EVENTS;
  assert.equal(isTelegramConnectionAlertsEnabled(), false);

  process.env.TELEGRAM_ALERT_CONNECTION_EVENTS = 'true';
  assert.equal(isTelegramConnectionAlertsEnabled(), true);
});

test('telegram alert http failures do not throw', async () => {
  process.env.TELEGRAM_ALERTS_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'secret-token';
  process.env.TELEGRAM_CHAT_ID = '123';
  global.fetch = (async () => new Response('{}', { status: 500 })) as any;

  await assert.doesNotReject(() => sendTelegramAlert({
    type: 'connection.disconnected',
    severity: 'warning',
    title: 'Disconnected',
    summary: 'reason',
  }));
});

test('escapeTelegramHtml escapes Telegram HTML-sensitive characters', () => {
  assert.equal(escapeTelegramHtml('<a&b>'), '&lt;a&amp;b&gt;');
});
