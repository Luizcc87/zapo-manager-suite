import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server as HttpServer } from 'http';
import request from 'supertest';

// Import routers and manager
import chatRouter from '../routes/chat.routes';
import messageRouter from '../routes/message.routes';
import instanceRouter from '../routes/instance.routes';
import { ZapoManager } from '../manager';
import { prisma } from '../lib/prisma';
import { proto } from 'zapo-js';

process.env.GLOBAL_API_KEY = 'test_global_key';

describe('Zapo Migration Integration Test Suite', () => {
  let app: express.Express;
  let server: HttpServer;
  const mockInstanceName = 'zapo-test-instance';
  const mockApiKey = 'zapo_test_key';

  before(async () => {
    // Stub Prisma Client findUnique
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
    app.use('/instance', instanceRouter);

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

  describe('1. Authentication Validation (Global vs Instance Keys)', () => {
    test('Instance route with Global Key should succeed', async () => {
      const res = await request(app)
        .get(`/instance/connectionState/${mockInstanceName}`)
        .set('apikey', 'test_global_key');
      assert.strictEqual(res.status, 200);
    });

    test('Instance route with Instance Key should succeed', async () => {
      const res = await request(app)
        .get(`/instance/connectionState/${mockInstanceName}`)
        .set('apikey', mockApiKey);
      assert.strictEqual(res.status, 200);
    });

    test('Instance route with invalid key should return 401', async () => {
      const res = await request(app)
        .get(`/instance/connectionState/${mockInstanceName}`)
        .set('apikey', 'invalid_key');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('2. Message Sending Validation', () => {
    test('POST /message/sendText/:instanceName -> should return 201 when client is connected', async () => {
      const originalGetActive = ZapoManager.getActive;
      
      const mockClient = {
        sessionId: mockInstanceName,
        profile: {
          getLidsByPhoneNumbers: async () => []
        },
        message: {
          send: async (jid: string, content: any, options: any) => {
            assert.strictEqual(content, 'Hello World from test');
            return { id: 'msg-text-123' };
          }
        }
      };

      ZapoManager.getActive = () => ({ client: mockClient } as any);

      const res = await request(app)
        .post(`/message/sendText/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5555999999999',
          text: 'Hello World from test'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.accepted, true);
      assert.strictEqual(res.body.key.id, 'msg-text-123');

      ZapoManager.getActive = originalGetActive;
    });

    test('POST /message/sendText/:instanceName -> supports Evolution textMessage and WAHA-style custom preview', async () => {
      const originalGetActive = ZapoManager.getActive;
      let sentContent: any;

      const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
      const mockClient = {
        sessionId: mockInstanceName,
        profile: {
          getLidsByPhoneNumbers: async () => []
        },
        message: {
          send: async (_jid: string, content: any) => {
            sentContent = content;
            return { id: 'msg-preview-123' };
          }
        }
      };

      ZapoManager.getActive = () => ({ client: mockClient } as any);

      const res = await request(app)
        .post(`/message/sendText/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5555999999999',
          textMessage: {
            text: 'Produto em oferta https://example.com/produto'
          },
          linkPreview: true,
          linkPreviewHighQuality: true,
          preview: {
            url: 'https://example.com/produto',
            title: 'Produto em oferta',
            description: 'R$1.449',
            image: {
              data: tinyPngBase64
            }
          }
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(sentContent.type, 'text');
      assert.strictEqual(sentContent.text, 'Produto em oferta https://example.com/produto');
      assert.strictEqual(sentContent.linkPreview.matchedText, 'https://example.com/produto');
      assert.strictEqual(sentContent.linkPreview.title, 'Produto em oferta');
      assert.strictEqual(sentContent.linkPreview.description, 'R$1.449');
      assert.strictEqual(sentContent.linkPreview.previewType, proto.Message.ExtendedTextMessage.PreviewType.IMAGE);
      assert.ok(sentContent.linkPreview.thumbnail.bytes instanceof Uint8Array);
      assert.strictEqual(sentContent.linkPreview.thumbnail.width, 640);
      assert.strictEqual(sentContent.linkPreview.thumbnail.height, 640);

      ZapoManager.getActive = originalGetActive;
    });

    test('POST /message/sendText/:instanceName -> keeps legacy text object linkPreview compatible when image fetch fails', async () => {
      const originalGetActive = ZapoManager.getActive;
      const originalFetch = global.fetch;
      let sentContent: any;

      const mockClient = {
        sessionId: mockInstanceName,
        profile: {
          getLidsByPhoneNumbers: async () => []
        },
        message: {
          send: async (_jid: string, content: any) => {
            sentContent = content;
            return { id: 'msg-preview-legacy-123' };
          }
        }
      };

      ZapoManager.getActive = () => ({ client: mockClient } as any);
      global.fetch = async () => {
        throw new Error('blocked in production');
      };

      const legacyText = '*Freezer Horizontal Electrolux 95L Inverter Bivolt Uma Porta Branco (HB100) Bivolt*\n\nR$1.449\n\nhttps://meli.la/2MU3MXd';
      const res = await request(app)
        .post(`/message/sendText/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5555999999999',
          text: {
            type: 'text',
            text: legacyText,
            linkPreview: {
              title: 'Freezer Horizontal Electrolux 95L Inverter Bivolt',
              description: 'R$1.449',
              image: 'https://httpbin.org/image/jpeg'
            }
          }
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(sentContent.type, 'text');
      assert.strictEqual(sentContent.text, legacyText);
      assert.strictEqual(sentContent.linkPreview.matchedText, 'https://meli.la/2MU3MXd');
      assert.strictEqual(sentContent.linkPreview.title, 'Freezer Horizontal Electrolux 95L Inverter Bivolt');
      assert.strictEqual(sentContent.linkPreview.description, 'R$1.449');
      assert.strictEqual(sentContent.linkPreview.image, undefined);
      assert.strictEqual(sentContent.linkPreview.thumbnail, undefined);

      global.fetch = originalFetch;
      ZapoManager.getActive = originalGetActive;
    });

    test('POST /message/sendMedia/:instanceName -> image via URL', async () => {
      const originalGetActive = ZapoManager.getActive;

      const mockClient = {
        sessionId: mockInstanceName,
        profile: { getLidsByPhoneNumbers: async () => [] },
        message: {
          send: async (jid: string, payload: any) => {
            assert.strictEqual(payload.type, 'image');
            assert.ok(payload.media.includes('zapo_'));
            assert.strictEqual(payload.caption, 'Test image');
            return { id: 'msg-media-123' };
          }
        }
      };

      ZapoManager.getActive = () => ({ client: mockClient } as any);

      // Stub global fetch to mock image download
      const originalFetch = global.fetch;
      global.fetch = async (url: any) => {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(8)
        } as any;
      };

      const res = await request(app)
        .post(`/message/sendMedia/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5555999999999',
          mediaUrl: 'https://example.com/image.jpg',
          mimetype: 'image/jpeg',
          caption: 'Test image'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.key.id, 'msg-media-123');
      assert.ok(res.body.message.imageMessage);

      // Restore
      global.fetch = originalFetch;
      ZapoManager.getActive = originalGetActive;
    });

    test('POST /message/sendSticker/:instanceName', async () => {
      const originalGetActive = ZapoManager.getActive;
      const mockClient = {
        sessionId: mockInstanceName,
        profile: { getLidsByPhoneNumbers: async () => [] },
        message: {
          send: async (jid: string, payload: any) => {
            assert.strictEqual(payload.type, 'sticker');
            assert.strictEqual(payload.mimetype, 'image/webp');
            return { id: 'msg-sticker-123' };
          }
        }
      };

      ZapoManager.getActive = () => ({ client: mockClient } as any);

      const originalFetch = global.fetch;
      global.fetch = async (url: any) => {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(8)
        } as any;
      };

      const res = await request(app)
        .post(`/message/sendSticker/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5555999999999',
          mediaUrl: 'https://example.com/sticker.webp'
        });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.message.stickerMessage);

      global.fetch = originalFetch;
      ZapoManager.getActive = originalGetActive;
    });
  });

  describe('3. Contact and LID Resolution', () => {
    test('Brazil JID Resolution (handling the 9 extra digit)', async () => {
      const originalGetActive = ZapoManager.getActive;
      let jidSent = '';

      const mockClient = {
        sessionId: mockInstanceName,
        profile: {
          // Simulate WhatsApp profile check indicating the JID without 9 exists
          getLidsByPhoneNumbers: async (numbers: string[]) => {
            return [
              { exists: false, phoneJid: '5511999999999@s.whatsapp.net' },
              { exists: true, phoneJid: '551188888888@s.whatsapp.net' } // matches without 9
            ];
          }
        },
        message: {
          send: async (jid: string, content: any) => {
            jidSent = jid;
            return { id: 'msg-resolved-jid' };
          }
        }
      };

      ZapoManager.getActive = () => ({ client: mockClient } as any);

      const res = await request(app)
        .post(`/message/sendText/${mockInstanceName}`)
        .set('apikey', mockApiKey)
        .send({
          number: '5511999999999', // 13 digits with '9'
          text: 'JID check'
        });

      assert.strictEqual(res.status, 201);
      // JID should have been resolved to the one without the extra '9' (which exists)
      assert.strictEqual(jidSent, '551188888888@s.whatsapp.net');

      ZapoManager.getActive = originalGetActive;
    });
  });
});
