import { test, expect } from '@playwright/test';

const GLOBAL_API_KEY = 'global_key';
const TEST_INSTANCE_NAME = `test-pw-${Math.random().toString(36).substring(7)}`;

test.describe('Zapo-Manager Integration Tests', () => {
  let instanceApiKey: string;

  test('1. Create instance should succeed with global key', async ({ request }) => {
    const response = await request.post('/instance/create', {
      headers: {
        apikey: GLOBAL_API_KEY,
      },
      data: {
        instanceName: TEST_INSTANCE_NAME,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.instance).toBeDefined();
    expect(body.instance.instanceName).toBe(TEST_INSTANCE_NAME);
    expect(body.instance.status).toBe('disconnected');
    expect(body.instance.apikey).toBeDefined();

    instanceApiKey = body.instance.apikey;
  });

  test('2. Authentication validation (Global key vs Instance key vs Invalid key)', async ({ request }) => {
    // 2.1 check connection state with global key -> should succeed
    const responseGlobal = await request.get(`/instance/connectionState/${TEST_INSTANCE_NAME}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(responseGlobal.status()).toBe(200);
    const bodyGlobal = await responseGlobal.json();
    expect(bodyGlobal.instance.instanceName).toBe(TEST_INSTANCE_NAME);
    expect(bodyGlobal.instance.status).toBe('disconnected');

    // 2.2 check connection state with instance key -> should succeed
    const responseInstance = await request.get(`/instance/connectionState/${TEST_INSTANCE_NAME}`, {
      headers: { apikey: instanceApiKey },
    });
    expect(responseInstance.status()).toBe(200);
    const bodyInstance = await responseInstance.json();
    expect(bodyInstance.instance.instanceName).toBe(TEST_INSTANCE_NAME);

    // 2.3 check connection state with invalid key -> should fail with 401
    const responseInvalid = await request.get(`/instance/connectionState/${TEST_INSTANCE_NAME}`, {
      headers: { apikey: 'invalid_key_123' },
    });
    expect(responseInvalid.status()).toBe(401);
  });

  test('3. Retrieve QR code / connect endpoint validation', async ({ request }) => {
    // connect endpoint using global key should succeed (previously failed with 401)
    const response = await request.get(`/instance/connect/${TEST_INSTANCE_NAME}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // It should either return a code (QR) or status (disconnected/connecting)
    expect(body).toBeDefined();
    if (body.code !== undefined) {
      expect(typeof body.code).toBe('string');
    } else {
      expect(body.status).toBeDefined();
    }
  });

  test('4. Delete instance should succeed with global key', async ({ request }) => {
    const response = await request.delete(`/instance/delete/${TEST_INSTANCE_NAME}`, {
      headers: {
        apikey: GLOBAL_API_KEY,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('success');
  });
});
