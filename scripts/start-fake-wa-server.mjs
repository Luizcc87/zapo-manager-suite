import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FakeWaServer } from '../backend/node_modules/@zapo-js/fake-server/dist/esm/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const runtimeFile = path.join(projectRoot, '.tmp', 'zapo-fake-server.json');
const toHex = (bytes) => Buffer.from(bytes).toString('hex');

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

console.log('[FakeWaServer] running');
console.log(`  ws      : ${server.url}`);
console.log(`  tcp     : ${server.tcpUrl}`);
console.log(`  runtime : ${runtimeFile}`);
console.log('');
console.log('Start/restart the backend after this command, then use the Manager UI normally.');
console.log('Press Ctrl+C to stop and remove the runtime file.');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    if (fs.existsSync(runtimeFile)) fs.unlinkSync(runtimeFile);
  } catch {}
  await server.stop();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
