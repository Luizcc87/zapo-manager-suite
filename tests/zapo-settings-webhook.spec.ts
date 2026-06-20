/**
 * zapo-settings-webhook.spec.ts — Suíte de Testes Reutilizáveis de Configurações e Webhooks
 *
 * Esta suíte valida de forma isolada e reaproveitável:
 *   1. A busca e a persistência das configurações de comportamento da instância.
 *   2. A busca e a persistência de configurações de webhook e seleção de eventos.
 *
 * Utiliza instâncias temporárias para garantir que os testes rodem limpos e de forma
 * isolada em qualquer ambiente sem necessidade de WhatsApp ativo.
 */

import { test, expect } from '@playwright/test';

const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'global_key';

// Helper para gerar nome único para instâncias de testes
const tmpName = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).substring(7)}`;

test.describe('Zapo Settings & Webhook Reuse Suite', () => {
  const instanceName = tmpName('test-reuse');
  let instanceApiKey: string;

  // Criação da instância de testes isolada
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: { instanceName },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    instanceApiKey = body.instance.apikey;
  });

  // Limpeza da instância ao terminar
  test.afterAll(async ({ request }) => {
    await request.delete(`/instance/delete/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
  });

  // --- Seção 1: Configurações de Comportamento (Settings) ---

  test('1.1 Buscar configurações padrão da instância', async ({ request }) => {
    const r = await request.get(`/settings/find/${instanceName}`, {
      headers: { apikey: instanceApiKey },
    });
    expect(r.status()).toBe(200);
    const settings = await r.json();

    expect(settings.rejectCall).toBe(false);
    expect(settings.groupsIgnore).toBe(false);
    expect(settings.alwaysOnline).toBe(false);
    expect(settings.readMessages).toBe(false);
    expect(settings.readStatus).toBe(false);
  });

  test('1.2 Modificar e persistir configurações de comportamento', async ({ request }) => {
    const updatedPayload = {
      rejectCall: true,
      msgCall: 'Desculpe, não aceitamos ligações no WhatsApp.',
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: true,
      readStatus: true,
      syncFullHistory: false,
    };

    const rSet = await request.post(`/settings/set/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: updatedPayload,
    });
    expect(rSet.status()).toBe(200);

    // Valida se as alterações foram salvas fazendo um novo fetch
    const rGet = await request.get(`/settings/find/${instanceName}`, {
      headers: { apikey: instanceApiKey },
    });
    expect(rGet.status()).toBe(200);
    const settings = await rGet.json();

    expect(settings.rejectCall).toBe(true);
    expect(settings.msgCall).toBe(updatedPayload.msgCall);
    expect(settings.groupsIgnore).toBe(true);
    expect(settings.alwaysOnline).toBe(true);
    expect(settings.readMessages).toBe(true);
    expect(settings.readStatus).toBe(true);
  });

  // --- Seção 2: Webhooks ---

  test('2.1 Buscar webhook padrão da instância', async ({ request }) => {
    const r = await request.get(`/webhook/find/${instanceName}`, {
      headers: { apikey: instanceApiKey },
    });
    expect(r.status()).toBe(200);
    const webhook = await r.json();

    expect(webhook.enabled).toBe(false);
    expect(webhook.url).toBe('');
    expect(webhook.events).toBeDefined();
    expect(Array.isArray(webhook.events)).toBe(true);
  });

  test('2.2 Configurar, ativar e persistir webhook com múltiplos eventos', async ({ request }) => {
    const updatedPayload = {
      webhook: {
        enabled: true,
        url: 'http://example.com/zapo-test-webhook',
        events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
        webhookBase64: false,
        webhookByEvents: true,
      }
    };

    const rSet = await request.post(`/webhook/set/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: updatedPayload,
    });
    expect(rSet.status()).toBe(200);

    // Valida persistência dos dados de webhook no banco de dados
    const rGet = await request.get(`/webhook/find/${instanceName}`, {
      headers: { apikey: instanceApiKey },
    });
    expect(rGet.status()).toBe(200);
    const webhook = await rGet.json();

    expect(webhook.enabled).toBe(true);
    expect(webhook.url).toBe(updatedPayload.webhook.url);
    expect(webhook.webhookByEvents).toBe(true);
    expect(webhook.events).toContain('MESSAGES_UPSERT');
    expect(webhook.events).toContain('CONNECTION_UPDATE');
    expect(webhook.events.length).toBe(3);
  });
});
