/**
 * zapo.spec.ts — Suíte de Integração do Zapo Manager
 *
 * Estrutura:
 *   Suite 1 — Ciclo de vida da instância       (sem instância conectada)
 *   Suite 2 — Autenticação e autorização        (sem instância conectada)
 *   Suite 3 — Envio de mensagens                (REQUER instância conectada)
 *   Suite 4 — Validação de entradas e erros     (sem instância conectada)
 *
 * Suítes 1, 2 e 4 criam instâncias temporárias e funcionam em qualquer ambiente.
 * Suíte 3 é ignorada automaticamente (test.skip) se nenhuma instância estiver
 * conectada — não interrompe a execução das demais suítes.
 *
 * Variáveis de ambiente opcionais:
 *   GLOBAL_API_KEY          - padrão: 'global_key'
 *   TEST_CONNECTED_INSTANCE - instância conectada a usar (padrão: 'test-4')
 *   PLAYWRIGHT_BASE_URL     - URL base da API (padrão: 'http://localhost:8080')
 *
 * ACHADOS DA SESSÃO (2026-06-20):
 *   - /message/* aceita APENAS instanceKey — global_key retorna 401.
 *   - zapo-js não aceita URLs como 'media' — backend faz download antes (fix aplicado).
 *   - URLs confiáveis: picsum.photos (JPEG), w3.org (PDF), gstatic.com (WebP).
 *   - URLs bloqueadas por bot-check: upload.wikimedia.org (HTTP 400), httpbin.org.
 *   - fileName em documentos usa 'N' maiúsculo (AGENTS.md ✅ corrigido).
 *   - messageTimestamp (não timestampSeconds) no shape do response.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Constantes globais
// ---------------------------------------------------------------------------

const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'global_key';
const CONNECTED_INSTANCE = process.env.TEST_CONNECTED_INSTANCE || 'test-4';

/**
 * URLs de mídia validadas na sessão de testes de 2026-06-20.
 * Algumas CDNs bloqueiam bots — use as URLs abaixo que funcionaram.
 */
const MEDIA_URLS = {
  /** ✅ JPEG público, sem bot-block, redireciona para imagem aleatória */
  image: 'https://picsum.photos/400/300',
  /** ✅ PDF público do W3C, estável e acessível */
  pdf: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  /** ✅ WebP nativo do Google, sempre acessível */
  sticker: 'https://www.gstatic.com/webp/gallery/1.webp',
  /** ❌ Gera HTTP 400 (bot-check) — usado para testar tratamento de erro */
  invalid: 'https://url-inexistente-zapo-12345.invalid/arquivo.png',
};

// ---------------------------------------------------------------------------
// Helper: gerar nome de instância temporária único
// ---------------------------------------------------------------------------
const tmpName = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).substring(7)}`;

// ---------------------------------------------------------------------------
// Suite 1 — Ciclo de Vida da Instância
// Não requer instância conectada. Cria e deleta sua própria instância.
// ---------------------------------------------------------------------------

test.describe('Suite 1 — Ciclo de Vida da Instância', () => {
  const instanceName = tmpName('test-lifecycle');
  let instanceApiKey: string;

  test('1.1 Criar instância — deve retornar 201 com global key', async ({ request }) => {
    const r = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: { instanceName },
    });

    expect(r.status()).toBe(201);
    const body = await r.json();

    expect(body.instance).toBeDefined();
    expect(body.instance.instanceName).toBe(instanceName);
    expect(body.instance.status).toBe('disconnected');
    expect(body.instance.apikey).toBeTruthy();
    expect(body.hash.apikey).toBeTruthy();

    instanceApiKey = body.instance.apikey;
  });

  test('1.2 fetchInstances — deve listar a instância criada', async ({ request }) => {
    const r = await request.get('/instance/fetchInstances', {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);

    const list = await r.json();
    const found = list.find((i: any) => i.name === instanceName);
    expect(found).toBeDefined();
    expect(found.token).toBeTruthy();
    expect(['open', 'connecting', 'close']).toContain(found.connectionStatus);
  });

  test('1.3 connectionState — deve retornar status válido', async ({ request }) => {
    const r = await request.get(`/instance/connectionState/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.instance.instanceName).toBe(instanceName);
    expect(['connected', 'disconnected', 'connecting']).toContain(body.instance.status);
    expect(['open', 'connecting', 'close']).toContain(body.instance.state);
  });

  test('1.4 connect — deve retornar 200 com code ou status', async ({ request }) => {
    const r = await request.get(`/instance/connect/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    // Instância nova: retorna QR (code) ou status (sem QR ainda)
    const hasCode = typeof body.code === 'string';
    const hasStatus = typeof body.status === 'string';
    expect(hasCode || hasStatus).toBe(true);
  });

  test('1.5 Deletar instância — deve retornar success', async ({ request }) => {
    const r = await request.delete(`/instance/delete/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('success');
  });

  test('1.6 Instância deletada — não deve mais aparecer no fetchInstances', async ({ request }) => {
    const r = await request.get('/instance/fetchInstances', {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const list = await r.json();
    const found = list.find((i: any) => i.name === instanceName);
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Autenticação e Autorização
// Não requer instância conectada.
//
// ACHADOS CONFIRMADOS:
//   - /instance/* aceita global_key OU instanceKey
//   - /message/* aceita SOMENTE instanceKey (global_key retorna 401)
//   - Chave inválida retorna 401 em ambos
// ---------------------------------------------------------------------------

test.describe('Suite 2 — Autenticação e Autorização', () => {
  const instanceName = tmpName('test-auth');
  let instanceApiKey: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: { instanceName },
    });
    expect(res.status()).toBe(201);
    instanceApiKey = (await res.json()).instance.apikey;
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/instance/delete/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
  });

  // --- /instance/* ---

  test('2.1 /instance/* — global_key deve ser aceita', async ({ request }) => {
    const r = await request.get(`/instance/connectionState/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
  });

  test('2.2 /instance/* — instanceKey deve ser aceita', async ({ request }) => {
    const r = await request.get(`/instance/connectionState/${instanceName}`, {
      headers: { apikey: instanceApiKey },
    });
    expect(r.status()).toBe(200);
  });

  test('2.3 /instance/* — chave inválida deve retornar 401', async ({ request }) => {
    const r = await request.get(`/instance/connectionState/${instanceName}`, {
      headers: { apikey: 'chave_invalida_xyz_123' },
    });
    expect(r.status()).toBe(401);
    const body = await r.json();
    expect(body.error).toContain('Unauthorized');
  });

  // --- /message/* (instância DESCONECTADA) ---

  test('2.4 /message/* — global_key é aceita pelo middleware checkInstanceApiKey', async ({ request }) => {
    const r = await request.post(`/message/sendText/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY, 'Content-Type': 'application/json' },
      data: { number: '5511999999999', text: 'teste' },
    });
    // O middleware checkInstanceApiKey aceita a global key nas rotas de mensagens.
    // Portanto, o status retornado não deve ser 401 (Unauthorized), mas sim 503 ou 500
    // devido à instância de teste estar desconectada.
    expect(r.status()).not.toBe(401);
    expect([500, 503]).toContain(r.status());
  });

  test('2.5 /message/* — instanceKey passa auth, mas 503 pois não está conectada', async ({ request }) => {
    const r = await request.post(`/message/sendText/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { number: '5511999999999', text: 'teste auth' },
    });
    expect(r.status()).not.toBe(401);
    expect([500, 503]).toContain(r.status());
  });

  test('2.6 /message/sendMedia — global_key é aceita pelo middleware e retorna 503 (desconectada)', async ({ request }) => {
    const r = await request.post(`/message/sendMedia/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY, 'Content-Type': 'application/json' },
      data: { number: '5511999999999', mediaUrl: MEDIA_URLS.image, mimetype: 'image/jpeg' },
    });
    expect(r.status()).not.toBe(401);
    expect([500, 503]).toContain(r.status());
  });

  test('2.7 /message/sendMedia — instanceKey passa auth, mas 503 pois não está conectada', async ({ request }) => {
    const r = await request.post(`/message/sendMedia/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { number: '5511999999999', mediaUrl: MEDIA_URLS.image, mimetype: 'image/jpeg' },
      timeout: 30_000,
    });
    expect(r.status()).not.toBe(401);
    expect([500, 503]).toContain(r.status());
  });

  // --- Instância inexistente ---

  test('2.8 connectionState de instância inexistente deve retornar 404', async ({ request }) => {
    const r = await request.get('/instance/connectionState/instancia-xyz-nao-existe', {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Envio de Mensagens (requer instância conectada)
//
// Esta suíte é IGNORADA automaticamente (test.skip) se nenhuma instância
// com status "open" for encontrada. Não interrompe as demais suítes.
//
// ACHADOS:
//   - zapo-js não aceita URLs em 'media' — backend faz download (fix aplicado)
//   - fileName usa 'N' maiúsculo em documentos (AGENTS.md)
//   - messageTimestamp é campo unix no response (não timestampSeconds)
//   - Sticker: type:'sticker' + mimetype:'image/webp'
// ---------------------------------------------------------------------------

test.describe('Suite 3 — Envio de Mensagens (requer instância conectada)', () => {
  let connectedInstanceKey: string | null = null;
  let resolvedInstance: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Tentar encontrar uma instância conectada
    const r = await request.get('/instance/fetchInstances', {
      headers: { apikey: GLOBAL_API_KEY },
    });

    if (r.status() !== 200) return;

    const list = await r.json();

    // Priorizar a instância configurada; se não, usar qualquer uma com "open"
  const preferred = list.find((i: any) => i.name === CONNECTED_INSTANCE && i.connectionStatus === 'open');
  const fallback = list.find((i: any) => i.connectionStatus === 'open');
    const found = preferred ?? fallback;

    if (found) {
      connectedInstanceKey = found.token;
      resolvedInstance = found.name;
      console.log(`[Suite 3] Usando instância conectada: "${resolvedInstance}"`);
    } else {
      console.warn(
        `[Suite 3] Nenhuma instância conectada encontrada. ` +
        `Testes de envio serão ignorados (test.skip). ` +
        `Para rodá-los, conecte "${CONNECTED_INSTANCE}" ao WhatsApp via QR code.`
      );
    }
  });

  /** Helper: pula o teste se não há instância conectada */
  function requireConnected() {
    test.skip(!connectedInstanceKey, `Nenhuma instância conectada disponível. Configure "${CONNECTED_INSTANCE}" com status "open".`);
  }

  test('3.1 connectionState — instância conectada deve ter state: "open"', async ({ request }) => {
    requireConnected();
    const r = await request.get(`/instance/connectionState/${resolvedInstance}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.instance.state).toBe('open');
    expect(body.instance.status).toBe('connected');
  });

  test('3.2 sendText — deve retornar 201 com shape correto', async ({ request }) => {
    requireConnected();
    const r = await request.post(`/message/sendText/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: '5555917896891',
        text: '[zapo.spec.ts] Teste automatizado — sendText ✅',
      },
    });
    expect(r.status()).toBe(201);
    const body = await r.json();

    // Validar shape (AGENTS.md: messageTimestamp, não timestampSeconds)
    expect(body.key.remoteJid).toMatch(/@s\.whatsapp\.net$/);
    expect(body.key.fromMe).toBe(true);
    expect(typeof body.key.id).toBe('string');
    expect(body.key.id.length).toBeGreaterThan(0);
    expect(body.message.conversation).toBeDefined();
    expect(typeof body.messageTimestamp).toBe('number');
    expect(body.messageTimestamp).toBeGreaterThan(0);
    expect(body.status).toBe('PENDING');
  });

  test('3.3 sendMedia (imagem via URL) — deve retornar 201 com imageMessage', async ({ request }) => {
    requireConnected();
    // ACHADO: zapo-js não aceita URLs — backend baixa antes de enviar (fix aplicado)
    // URL confiável: picsum.photos não bloqueia bots
    const r = await request.post(`/message/sendMedia/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: '5555917896891',
        mediaUrl: MEDIA_URLS.image,
        mimetype: 'image/jpeg',
        caption: '[zapo.spec.ts] sendMedia — imagem',
      },
      timeout: 60_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.key.fromMe).toBe(true);
    expect(body.message.imageMessage).toBeDefined();
    expect(body.message.imageMessage.caption).toBeDefined();
    expect(body.status).toBe('PENDING');
  });

  test('3.4 sendMedia (PDF via URL) — deve retornar 201 com fileName no documentMessage', async ({ request }) => {
    requireConnected();
    const r = await request.post(`/message/sendMedia/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: '5555917896891',
        mediaUrl: MEDIA_URLS.pdf,
        mimetype: 'application/pdf',
        caption: '[zapo.spec.ts] sendMedia — PDF',
      },
      timeout: 60_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.key.fromMe).toBe(true);
    expect(body.message.documentMessage).toBeDefined();
    // AGENTS.md: fileName com 'N' maiúsculo — extraído da URL quando não há upload físico
    expect(body.message.documentMessage.fileName).toBeDefined();
    expect(typeof body.message.documentMessage.fileName).toBe('string');
    expect(body.status).toBe('PENDING');
  });

  test('3.5 sendSticker (WebP via URL) — deve retornar 201 com stickerMessage', async ({ request }) => {
    requireConnected();
    // AGENTS.md: type:'sticker' + mimetype:'image/webp'
    const r = await request.post(`/message/sendSticker/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: '5555917896891',
        mediaUrl: MEDIA_URLS.sticker,
      },
      timeout: 60_000,
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.key.fromMe).toBe(true);
    expect(body.message.stickerMessage).toBeDefined();
    expect(body.status).toBe('PENDING');
  });

  test('3.6 sendMedia (multipart / arquivo físico) — deve retornar 201 com fileName', async ({ request }) => {
    requireConnected();
    const tempFile = path.join(os.tmpdir(), `zapo-test-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, `[zapo.spec.ts] multipart test — ${new Date().toISOString()}`);

    try {
      const r = await request.post(`/message/sendMedia/${resolvedInstance}`, {
        headers: { apikey: connectedInstanceKey! },
        multipart: {
          number: '5555917896891',
          caption: '[zapo.spec.ts] sendMedia — multipart',
          file: {
            name: 'zapo-test.txt',
            mimeType: 'text/plain',
            buffer: fs.readFileSync(tempFile),
          },
        },
        timeout: 60_000,
      });
      expect(r.status()).toBe(201);
      const body = await r.json();
      expect(body.key.fromMe).toBe(true);
      expect(body.message.documentMessage).toBeDefined();
      // AGENTS.md: fileName com 'N' maiúsculo
      expect(body.message.documentMessage.fileName).toBe('zapo-test.txt');
      expect(body.status).toBe('PENDING');
    } finally {
      fs.unlinkSync(tempFile);
    }
  });

  test('3.7 sendMedia com URL inválida — deve retornar 500 com mensagem de erro', async ({ request }) => {
    requireConnected();
    // Validar que falha de download é propagada corretamente
    const r = await request.post(`/message/sendMedia/${resolvedInstance}`, {
      headers: { apikey: connectedInstanceKey!, 'Content-Type': 'application/json' },
      data: {
        number: '5555917896891',
        mediaUrl: MEDIA_URLS.invalid,
        mimetype: 'image/png',
        caption: 'teste erro url invalida',
      },
      timeout: 30_000,
    });
    expect(r.status()).toBe(500);
    const body = await r.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Validação de Entradas e Campos Obrigatórios
// Não requer instância conectada.
// ---------------------------------------------------------------------------

test.describe('Suite 4 — Validação de Entradas e Erros', () => {
  const instanceName = tmpName('test-val');
  let instanceApiKey: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: { instanceName },
    });
    expect(res.status()).toBe(201);
    instanceApiKey = (await res.json()).instance.apikey;
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`/instance/delete/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
  });

  test('4.1 /instance/create — sem instanceName deve retornar 400', async ({ request }) => {
    const r = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: {},
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBeDefined();
  });

  test('4.2 /instance/create — sem global_key deve retornar 401', async ({ request }) => {
    const r = await request.post('/instance/create', {
      headers: { apikey: 'chave_errada' },
      data: { instanceName: 'deve-falhar' },
    });
    expect(r.status()).toBe(401);
  });

  test('4.3 /message/sendText — sem number deve retornar 400', async ({ request }) => {
    const r = await request.post(`/message/sendText/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { text: 'sem numero' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBeDefined();
  });

  test('4.4 /message/sendText — sem text deve retornar 400', async ({ request }) => {
    const r = await request.post(`/message/sendText/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { number: '5511999999999' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBeDefined();
  });

  test('4.5 /message/sendMedia — sem file nem mediaUrl deve retornar 400', async ({ request }) => {
    const r = await request.post(`/message/sendMedia/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { number: '5511999999999', mimetype: 'image/png' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBeDefined();
  });

  test('4.6 /message/sendSticker — sem file nem mediaUrl deve retornar 400', async ({ request }) => {
    const r = await request.post(`/message/sendSticker/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { number: '5511999999999' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBeDefined();
  });

  test('4.7 /instance/connectionState — instância inexistente deve retornar 404', async ({ request }) => {
    const r = await request.get('/instance/connectionState/instancia-inexistente-xyz-999', {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(404);
  });

  test('4.8 /message/sendText — instância desconectada retorna 503 (não 401)', async ({ request }) => {
    // Confirma que auth passa mas conexão WA falha com 503
    const r = await request.post(`/message/sendText/${instanceName}`, {
      headers: { apikey: instanceApiKey, 'Content-Type': 'application/json' },
      data: { number: '5511999999999', text: 'instancia desconectada' },
    });
    // Auth passou. Instâncias criadas no beforeAll podem retornar 500 (ainda
    // inicializando) ou 503 (desconectada estável) — ambos indicam "não conectado".
    expect(r.status()).not.toBe(401);
    expect([500, 503]).toContain(r.status());
  });
});
