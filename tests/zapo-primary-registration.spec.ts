/**
 * tests/zapo-primary-registration.spec.ts — Primary Registration E2E Tests
 *
 * Testa o fluxo de registro primário via SMS/Voz OTP.
 *
 * Grupos:
 *   Suite A — Contract & Error Validation (sem telefone real, CI-safe)
 *   Suite B — Happy Path e código inválido com OTP real (requer TEST_PRIMARY_PHONE e opcionalmente TEST_OTP_CODE)
 *
 * Variáveis de ambiente:
 *   GLOBAL_API_KEY        — padrão: 'global_key'
 *   TEST_PRIMARY_PHONE    — ex: '+5511999990000' (obrigatório para Suite B)
 *   TEST_OTP_CODE         — código SMS de 6 dígitos (obrigatório para Happy Path de B.2)
 */

import { test, expect } from '@playwright/test';

const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'global_key';

// Helper para gerar nome único para instâncias de testes
const tmpName = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).substring(7)}`;

test.describe('Zapo Primary Registration E2E Tests', () => {
  // Lista para rastrear instâncias criadas e garantir limpeza completa ao final
  const createdInstances: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const instName of createdInstances) {
      try {
        const r = await request.delete(`/instance/delete/${instName}`, {
          headers: { apikey: GLOBAL_API_KEY },
        });
        if (r.status() === 200) {
          console.log(`[Cleanup] Instância temporária deletada: ${instName}`);
        }
      } catch (e) {
        console.error(`[Cleanup] Erro ao deletar instância ${instName}:`, e);
      }
    }
  });

  // Helper para criar instâncias de teste e registrar para limpeza posterior
  async function createTestInstance(request: any, mobileTransport = false) {
    const instanceName = tmpName('test-reg-spec');
    const r = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: {
        instanceName,
        mobileTransport,
      },
    });

    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.instance).toBeDefined();
    createdInstances.push(instanceName);
    return { name: instanceName, apiKey: body.instance.apikey };
  }

  // =========================================================================
  // Suite A — Contract & Error Validation (Sem telefone real, CI-safe)
  // =========================================================================
  test.describe('Suite A — Validação de Contratos e Erros (CI-safe)', () => {

    test('1.1 requestCode deve retornar 400 se instanceName estiver ausente', async ({ request }) => {
      const r = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { phoneNumber: '+5511999999999', method: 'sms' },
      });
      expect(r.status()).toBe(400);
      const body = await r.json();
      expect(body.error).toContain('instanceName and phoneNumber are required');
    });

    test('1.2 requestCode deve retornar 400 se phoneNumber estiver ausente', async ({ request }) => {
      const r = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: 'test-inst', method: 'sms' },
      });
      expect(r.status()).toBe(400);
      const body = await r.json();
      expect(body.error).toContain('instanceName and phoneNumber are required');
    });

    test('2.1 requestCode deve retornar 404 se a instância não existir no DB', async ({ request }) => {
      const nonExistent = tmpName('non-existent');
      const r = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: nonExistent, phoneNumber: '+5511999999999', method: 'sms' },
      });
      expect(r.status()).toBe(404);
      const body = await r.json();
      expect(body.error).toContain('Instance not found');
    });

    test('3.1 requestCode deve retornar erro 500 se o formato do número de telefone for inválido ("abc")', async ({ request }) => {
      const { name } = await createTestInstance(request, true);
      const r = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, phoneNumber: 'abc', method: 'sms' },
      });
      expect(r.status()).toBe(500);
      const body = await r.json();
      expect(body.error).toBeDefined();
    });

    test('4.1 requestCode deve retornar 400 se a instância não estiver configurada com mobileTransport', async ({ request }) => {
      const { name } = await createTestInstance(request, false);
      const r = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, phoneNumber: '+5511999999999', method: 'sms' },
      });
      expect(r.status()).toBe(400);
      const body = await r.json();
      expect(body.error).toContain('Instance is not configured for mobile transport');
    });

    test('5.1 confirmCode deve retornar 400 se for chamado sem sessão ativa (sem requestCode prévio)', async ({ request }) => {
      const { name } = await createTestInstance(request, true);
      const r = await request.post('/instance/register/confirmCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, code: '123456' },
      });
      expect(r.status()).toBe(400);
      const body = await r.json();
      expect(body.error).toContain('Sessão de registro expirada ou não encontrada');
    });

    test('6.1 fetchInstances deve retornar o instanceType correto dependendo das flags', async ({ request }) => {
      // Cria uma instância padrão (Web)
      const webInst = await createTestInstance(request, false);
      // Cria uma instância mobile sem registro de telefone (Mobile)
      const mobileInst = await createTestInstance(request, true);

      const r = await request.get('/instance/fetchInstances', {
        headers: { apikey: GLOBAL_API_KEY },
      });
      expect(r.status()).toBe(200);
      const instances = await r.json();

      const foundWeb = instances.find((i: any) => i.name === webInst.name);
      expect(foundWeb).toBeDefined();
      expect(foundWeb.instanceType).toBe('web');
      expect(foundWeb.mobileTransport).toBe(false);

      const foundMobile = instances.find((i: any) => i.name === mobileInst.name);
      expect(foundMobile).toBeDefined();
      expect(foundMobile.instanceType).toBe('mobile');
      expect(foundMobile.mobileTransport).toBe(true);
    });
  });

  // =========================================================================
  // Suite B — Happy Path e código inválido com telefone real
  // =========================================================================
  test.describe('Suite B — Operações com Telefone Real (Requer infra e número real)', () => {
    // Pula toda a Suite B se não for fornecido número de telefone para teste real
    test.skip(!process.env.TEST_PRIMARY_PHONE, 'Requer TEST_PRIMARY_PHONE definido para executar');

    test('B.1 confirmCode com código inválido de 6 dígitos para instância existente', async ({ request }) => {
      const primaryPhone = process.env.TEST_PRIMARY_PHONE!;
      const { name } = await createTestInstance(request, true);

      // 1. Solicita código com número real. Deve retornar 200.
      const rRequest = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, phoneNumber: primaryPhone, method: 'sms' },
      });
      expect(rRequest.status()).toBe(200);

      // 2. Confirma com código de 6 dígitos inválido ("000000").
      const rConfirm = await request.post('/instance/register/confirmCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, code: '000000' },
      });
      // Deve retornar 500 porque os servidores do WhatsApp rejeitam o código errado.
      expect(rConfirm.status()).toBe(500);

      // 3. Valida no fetchInstances que o registeredPhone foi salvo (type "primary") e status não está conectado.
      const rFetch = await request.get('/instance/fetchInstances', {
        headers: { apikey: GLOBAL_API_KEY },
      });
      expect(rFetch.status()).toBe(200);
      const instances = await rFetch.json();

      const found = instances.find((i: any) => i.name === name);
      expect(found).toBeDefined();
      expect(found.instanceType).toBe('primary'); // Pois registeredPhone foi persistido no requestCode
      expect(found.connectionStatus).not.toBe('open'); // Não pode estar conectado
    });

    test('B.2 Happy Path completo com registro primário (requer TEST_OTP_CODE)', async ({ request }) => {
      // Pula este teste se o código OTP não for explicitamente fornecido
      test.skip(!process.env.TEST_OTP_CODE, 'Requer TEST_OTP_CODE para completar o pareamento primário');

      const primaryPhone = process.env.TEST_PRIMARY_PHONE!;
      const otpCode = process.env.TEST_OTP_CODE!;
      const { name } = await createTestInstance(request, true);

      // 1. Solicita código
      const rRequest = await request.post('/instance/register/requestCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, phoneNumber: primaryPhone, method: 'sms' },
      });
      expect(rRequest.status()).toBe(200);

      // 2. Confirma código
      const rConfirm = await request.post('/instance/register/confirmCode', {
        headers: { apikey: GLOBAL_API_KEY },
        data: { instanceName: name, code: otpCode },
      });
      expect(rConfirm.status()).toBe(200);

      // 3. Valida se a instância virou 'primary' e está conectada
      const rFetch = await request.get('/instance/fetchInstances', {
        headers: { apikey: GLOBAL_API_KEY },
      });
      expect(rFetch.status()).toBe(200);
      const instances = await rFetch.json();

      const found = instances.find((i: any) => i.name === name);
      expect(found).toBeDefined();
      expect(found.instanceType).toBe('primary');
      expect(found.mobileTransport).toBe(true);
      expect(found.connectionStatus).toBe('open'); // Conectado com sucesso
      expect(found.number).toBeDefined();
    });
  });
});
