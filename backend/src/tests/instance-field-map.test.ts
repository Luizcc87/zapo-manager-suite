import assert from 'node:assert/strict';
import test from 'node:test';

import { updateFieldsMap, InvalidFieldError, updateLead, getLeadRaw, getFieldsMap } from '../services/instanceFieldMap';
import { prisma } from '../lib/prisma';

// ponytail: PrismaClient mantém pool de conexão aberta e trava node:test sem $disconnect explícito.
test.after(async () => {
  await prisma.$disconnect();
});

test('updateFieldsMap rejects invalid field types before touching the database', async () => {
  await assert.rejects(
    () => updateFieldsMap('inst-1', [{ slotKey: 'test', label: 'Test', fieldType: 'invalid' as any }]),
    InvalidFieldError
  );
});

test('updateFieldsMap rejects invalid slot keys', async () => {
  await assert.rejects(
    () => updateFieldsMap('inst-1', [{ slotKey: 'invalid-key@#', label: 'Test', fieldType: 'text' }]),
    InvalidFieldError
  );
});

test('InvalidFieldError message contains the key and reason', () => {
  const err = new InvalidFieldError('invalid-key@#', 'reason here');
  assert.match(err.message, /invalid-key@#/);
  assert.match(err.message, /reason here/);
});
