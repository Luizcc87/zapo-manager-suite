import fs from 'node:fs';
import path from 'node:path';
import { FakeWaServer, parsePairingQrString, seedFakeMobilePrimary } from '../../backend/node_modules/@zapo-js/fake-server';
import { createStore, WaClient } from '../../backend/node_modules/zapo-js';

const runtimeFile = path.resolve(__dirname, '../../.tmp/zapo-fake-server.json');

export type FakeServerHarness = {
  server: FakeWaServer;
  runtimeFile: string;
  stop: () => Promise<void>;
};

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

export async function startFakeWaServer(): Promise<FakeServerHarness> {
  const server = await FakeWaServer.start({ tcp: true });
  fs.mkdirSync(path.dirname(runtimeFile), { recursive: true });
  fs.writeFileSync(runtimeFile, JSON.stringify({
    chatSocketUrls: [server.url],
    tcpUrl: server.tcpUrl,
    noiseRootCa: {
      publicKeyHex: toHex(server.noiseRootCa.publicKey),
      serial: server.noiseRootCa.serial,
    },
  }, null, 2));

  return {
    server,
    runtimeFile,
    stop: async () => {
      if (fs.existsSync(runtimeFile)) fs.unlinkSync(runtimeFile);
      await server.stop();
    },
  };
}

export async function pairManagerClientWithQr(server: FakeWaServer, qr: string, deviceJid: string) {
  const pipeline = await server.waitForAuthenticatedPipeline(10_000);
  const parsed = parsePairingQrString(qr);
  await server.runPairing(pipeline, { deviceJid }, async () => ({
    advSecretKey: parsed.advSecretKey,
    identityPublicKey: parsed.identityPublicKey,
  }));
  return server.waitForNextAuthenticatedPipeline(10_000);
}

export async function createFakeMobilePrimaryClient(server: FakeWaServer, sessionId: string, phoneNumber: string) {
  const store = createStore({});
  const primary = await seedFakeMobilePrimary(store, sessionId, { phoneNumber });
  const client = new WaClient({
    store,
    sessionId,
    mobileTransport: {
      deviceInfo: primary.deviceInfo,
      tcpUrl: server.tcpUrl,
    },
    testHooks: { noiseRootCa: server.noiseRootCa },
  });
  return { client, primary };
}
