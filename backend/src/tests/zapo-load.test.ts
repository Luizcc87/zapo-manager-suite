import express from 'express';
import { Server as HttpServer } from 'http';
import request from 'supertest';
import assert from 'node:assert';
import { test, describe, before, after } from 'node:test';

// Import routers and manager
import chatRouter from '../routes/chat.routes';
import messageRouter from '../routes/message.routes';
import { ZapoManager } from '../manager';
import { prisma } from '../lib/prisma';

process.env.GLOBAL_API_KEY = 'test_global_key';

describe('Zapo API Load and Performance Test Suite', () => {
  let app: express.Express;
  let server: HttpServer;
  const mockInstanceName = 'zapo-load-instance';
  const mockApiKey = 'zapo_load_key';

  before(async () => {
    // Stub Prisma
    (prisma.instance.findUnique as any) = async (args: any) => {
      if (args.where.instanceName === mockInstanceName) {
        return {
          instanceName: mockInstanceName,
          apiKey: mockApiKey,
          status: 'connected',
          mobileTransport: false,
          deviceInfo: null,
          settingsConfig: {},
          proxyConfig: {},
          webhookConfig: {},
        };
      }
      return null;
    };

    // Setup Express
    app = express();
    app.use(express.json());
    app.use('/chat', chatRouter);
    app.use('/message', messageRouter);

    server = new HttpServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        resolve();
      });
    });
  });

  after(() => new Promise<void>((resolve) => {
    server.close(() => resolve());
  }));

  test('Simulate concurrent load of 100 message sends', async () => {
    const originalGetActive = ZapoManager.getActive;

    // Fast mock client
    const mockClient = {
      sessionId: mockInstanceName,
      profile: { getLidsByPhoneNumbers: async () => [] },
      message: {
        send: async (jid: string, content: any) => {
          // Simulate a small network delay of 10ms
          await new Promise((r) => setTimeout(r, 10));
          return { id: `msg-load-${Math.random().toString(36).substring(7)}` };
        }
      }
    };
    ZapoManager.getActive = () => ({ client: mockClient } as any);

    const totalRequests = 100;
    const concurrencyLimit = 10;
    const startTime = Date.now();

    const runRequest = async (i: number) => {
      const res = await request(app)
        .post(`/message/sendText/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5555999999999',
          text: `Load Test Message ${i}`
        });
      return res.status;
    };

    // Run requests in batches to mimic actual concurrent behavior
    const results: number[] = [];
    for (let i = 0; i < totalRequests; i += concurrencyLimit) {
      const batch = Array.from({ length: Math.min(concurrencyLimit, totalRequests - i) }, (_, index) =>
        runRequest(i + index)
      );
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter((status) => status === 201).length;
    const failureCount = results.length - successCount;
    const avgResponseTime = duration / totalRequests;
    const throughput = (totalRequests / (duration / 1000)).toFixed(2);

    console.log('\n--- PERFORMANCE RESULTS ---');
    console.log(`Total Requests:    ${totalRequests}`);
    console.log(`Success Count:     ${successCount}`);
    console.log(`Failure Count:     ${failureCount}`);
    console.log(`Total Duration:    ${duration} ms`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)} ms`);
    console.log(`Throughput:        ${throughput} req/sec`);
    console.log('---------------------------\n');

    assert.strictEqual(successCount, totalRequests, 'All requests under load should succeed (201)');
    assert.ok(avgResponseTime < 100, 'Average response time should be well under 100ms under mock settings');

    ZapoManager.getActive = originalGetActive;
  });
});
