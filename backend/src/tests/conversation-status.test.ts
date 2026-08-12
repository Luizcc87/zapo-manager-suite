import assert from 'node:assert/strict';
import test from 'node:test';

import { setConversationStatus, InvalidStatusError, BotBlockedError } from '../services/conversationStatus';
import { prisma } from '../lib/prisma';

// ponytail: PrismaClient mantém pool de conexão aberta e trava node:test sem $disconnect explícito.
test.after(async () => {
  await prisma.$disconnect();
});

test('setConversationStatus rejects invalid status before touching the database', async () => {
  await assert.rejects(
    () => setConversationStatus('inst-1', '5511@s.whatsapp.net', 'bogus', { type: 'human', id: 'luiz' }),
    InvalidStatusError
  );
});

test('BotBlockedError message names instance, jid and current status', () => {
  const err = new BotBlockedError('inst-1', '5511@s.whatsapp.net', 'open');
  assert.match(err.message, /inst-1/);
  assert.match(err.message, /5511@s\.whatsapp\.net/);
  assert.match(err.message, /'open'/);
  assert.match(err.message, /'pending'/);
});

test('InvalidStatusError lists the valid statuses', () => {
  const err = new InvalidStatusError('bogus');
  assert.match(err.message, /pending, open, resolved/);
});
