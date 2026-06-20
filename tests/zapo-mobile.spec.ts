/**
 * tests/zapo-mobile.spec.ts — Mobile Instance Integration Tests
 */

import { test, expect } from '@playwright/test';

const GLOBAL_API_KEY = process.env.GLOBAL_API_KEY || 'global_key';

const tmpName = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).substring(7)}`;

test.describe('Zapo Mobile Instance Integration Tests', () => {
  const instanceName = tmpName('test-mobile-spec');
  let instanceApiKey: string;

  test('Should successfully create a mobile instance with mobileTransport=true', async ({ request }) => {
    const r = await request.post('/instance/create', {
      headers: { apikey: GLOBAL_API_KEY },
      data: {
        instanceName,
        mobileTransport: true,
      },
    });

    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.instance).toBeDefined();
    expect(body.instance.instanceName).toBe(instanceName);
    expect(body.instance.status).toBe('disconnected');
    instanceApiKey = body.instance.apikey;
  });

  test('Should fetch mobile instance connectionState successfully', async ({ request }) => {
    const r = await request.get(`/instance/connectionState/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.instance.instanceName).toBe(instanceName);
    expect(body.instance.status).toBe('disconnected');
    expect(body.instance.state).toBe('close');
  });

  test('Should call connect endpoint and return disconnected state gracefully (handles TCP connection issues without 500)', async ({ request }) => {
    const r = await request.get(`/instance/connect/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    
    // We expect 200 since connect errors are now caught and returned with HTTP 200 status: disconnected
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('disconnected');
    expect(body.code).toBe('');
  });

  test('Should clean up and delete the mobile instance successfully', async ({ request }) => {
    const r = await request.delete(`/instance/delete/${instanceName}`, {
      headers: { apikey: GLOBAL_API_KEY },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('success');
  });
});
