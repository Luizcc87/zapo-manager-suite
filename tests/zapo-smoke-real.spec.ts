/**
 * Smoke real de envio para número alvo.
 *
 * Variáveis de ambiente opcionais:
 *   GLOBAL_API_KEY          - padrão: 'global_key'
 *   TEST_CONNECTED_INSTANCE - instância conectada a usar (padrão: 'test-4')
 *   TEST_TARGET_NUMBER      - número real em formato nacional/internacional
 *
 * Esta suíte é propositalmente separada da suíte principal para deixar claro
 * que ela dispara mensagens reais para um destinatário humano.
 */

import { test, expect } from '@playwright/test';

const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'global_key';
const CONNECTED_INSTANCE = process.env.TEST_CONNECTED_INSTANCE || 'test-4';
const TARGET_NUMBER = process.env.TEST_TARGET_NUMBER || '5555999703107';

const MEDIA_URLS = {
  pdf: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  sticker: 'https://www.gstatic.com/webp/gallery/1.webp',
};

test.describe('Smoke real de envio para número alvo', () => {
  let connectedInstanceKey: string | null = null;
  let resolvedInstance: string | null = null;

  test.beforeAll(async ({ request }) => {
    const r = await request.get('/instance/fetchInstances', {
      headers: { apikey: GLOBAL_API_KEY },
    });

    if (r.status() !== 200) return;

    const list = await r.json();
    const preferred = list.find((i: any) => i.name === CONNECTED_INSTANCE && i.connectionStatus === 'open');
    const fallback = list.find((i: any) => i.connectionStatus === 'open');
    const found = preferred ?? fallback;

    if (found) {
      connectedInstanceKey = found.token;
      resolvedInstance = found.name;
      console.log(`[Smoke Real] Usando instância conectada: "${resolvedInstance}" para ${TARGET_NUMBER}`);
    } else {
      console.warn(
        `[Smoke Real] Nenhuma instância em open encontrada. ` +
        `O envio real para ${TARGET_NUMBER} será ignorado.`
      );
    }
  });

  async function ensureOpen(request: any) {
    test.skip(!connectedInstanceKey, `Nenhuma instância conectada disponível. Configure "${CONNECTED_INSTANCE}" com status "open".`);

    const stateResponse = await request.get(`/instance/connectionState/${resolvedInstance}`, {
      headers: { apikey: GLOBAL_API_KEY },
      timeout: 10_000,
    });
    expect(stateResponse.status()).toBe(200);
    const stateBody = await stateResponse.json();
    if (stateBody.instance?.state !== 'open' || stateBody.instance?.status !== 'connected') {
      console.warn(
        `[Smoke Real] Instância "${resolvedInstance}" está ${stateBody.instance?.status}/${stateBody.instance?.state}. ` +
        `Nenhum envio será realizado.`
      );
    }
    expect(stateBody.instance?.state).toBe('open');
    expect(stateBody.instance?.status).toBe('connected');
  }

  test('sendText real', async ({ request }) => {
    await ensureOpen(request);
    const r = await request.post(`/message/sendText/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: TARGET_NUMBER,
        text: '[zapo-smoke-real] sendText real',
      },
      timeout: 60_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.accepted).toBe(true);
    expect(body.key.remoteJid).toBe(`${TARGET_NUMBER}@s.whatsapp.net`);
    expect(body.message.conversation).toBeDefined();
    expect(body.status).toBe('PENDING');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const statusResponse = await request.get(`/message/status/${resolvedInstance}/${body.key.id}`, {
        headers: { apikey: connectedInstanceKey! },
        timeout: 10_000,
      });
      if (statusResponse.status() === 200) {
        const statusBody = await statusResponse.json();
        expect(statusBody.messageId).toBe(body.key.id);
        expect(statusBody.remoteJid).toBe(`${TARGET_NUMBER}@s.whatsapp.net`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Status da mensagem não ficou disponível após o envio.');
  });

  test('sendText real with linkPreview', async ({ request }) => {
    await ensureOpen(request);
    const r = await request.post(`/message/sendText/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: TARGET_NUMBER,
        text: {
          type: 'text',
          text: 'https://meli.la/2MU3MXd',
          linkPreview: true,
        },
      },
      timeout: 60_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.accepted).toBe(true);
    expect(body.key.remoteJid).toBe(`${TARGET_NUMBER}@s.whatsapp.net`);
    expect(body.message.type).toBe('text');
    expect(body.message.text).toBe('https://meli.la/2MU3MXd');
    expect(body.message.linkPreview).toBe(true);
    expect(body.status).toBe('PENDING');
  });

  test('sendMedia real', async ({ request }) => {
    await ensureOpen(request);
    const r = await request.post(`/message/sendMedia/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: TARGET_NUMBER,
        mediaUrl: MEDIA_URLS.pdf,
        mimetype: 'application/pdf',
        caption: '[zapo-smoke-real] sendMedia real',
      },
      timeout: 90_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.accepted).toBe(true);
    expect(body.key.remoteJid).toBe(`${TARGET_NUMBER}@s.whatsapp.net`);
    expect(body.message.documentMessage).toBeDefined();
    expect(body.message.documentMessage.fileName).toBeDefined();
    expect(body.status).toBe('PENDING');
  });

  test('sendSticker real', async ({ request }) => {
    await ensureOpen(request);
    const r = await request.post(`/message/sendSticker/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: TARGET_NUMBER,
        mediaUrl: MEDIA_URLS.sticker,
      },
      timeout: 90_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.accepted).toBe(true);
    expect(body.key.remoteJid).toBe(`${TARGET_NUMBER}@s.whatsapp.net`);
    expect(body.message.stickerMessage).toBeDefined();
    expect(body.status).toBe('PENDING');
  });
});
