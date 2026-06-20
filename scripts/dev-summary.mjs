import http from 'node:http';

const backendPort = Number(process.env.BACKEND_PORT || process.env.PORT || 8080);
const frontendBasePort = Number(process.env.FRONTEND_PORT || 5173);
const globalKey = process.env.GLOBAL_API_KEY || 'global_key';
const connectedInstance = process.env.TEST_CONNECTED_INSTANCE || 'test-4';

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy(new Error(`Timeout calling ${url}`));
    });
  });
}

async function findFrontendUrl() {
  for (let port = frontendBasePort; port < frontendBasePort + 10; port += 1) {
    try {
      const result = await requestJson(`http://localhost:${port}/`);
      if (result.statusCode === 200) {
        return {
          url: `http://localhost:${port}`,
          port,
          usedFallbackPort: port !== frontendBasePort,
        };
      }
    } catch {
      // continue searching
    }
  }
  return null;
}

async function findBackendUrl() {
  for (let port = backendPort; port < backendPort + 10; port += 1) {
    try {
      const result = await requestJson(`http://localhost:${port}/`);
      if (result.statusCode === 200) {
        return {
          url: `http://localhost:${port}`,
          port,
          usedFallbackPort: port !== backendPort,
        };
      }
    } catch {
      // continue searching
    }
  }
  return null;
}

async function main() {
  let backendInfo = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    backendInfo = await findBackendUrl();
    if (backendInfo) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const frontendInfo = await findFrontendUrl();
  let connected = 'nenhuma';
  if (backendInfo) {
    try {
      const result = await requestJson(`${backendInfo.url}/instance/fetchInstances`, {
        apikey: globalKey,
      });
      if (result.statusCode === 200) {
        const instances = JSON.parse(result.body);
        const open = instances.filter((i) => i.connectionStatus === 'open').map((i) => i.name);
        connected = open.length ? open.join(', ') : 'nenhuma';
      }
    } catch {
      connected = 'indisponível';
    }
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║            Zapo Manager — Dev Summary           ║');
  console.log('╚══════════════════════════════════════════════════╝');
  if (backendInfo) {
    const fallbackNote = backendInfo.usedFallbackPort
      ? ` (porta alternativa por conflito em ${backendPort})`
      : '';
    console.log(`  Backend : ${backendInfo.url}${fallbackNote}`);
  } else {
    console.log('  Backend : não encontrado');
  }
  if (frontendInfo) {
    const fallbackNote = frontendInfo.usedFallbackPort
      ? ` (porta alternativa por conflito em ${frontendBasePort})`
      : '';
    console.log(`  Frontend : ${frontendInfo.url}${fallbackNote}`);
  } else {
    console.log('  Frontend : não encontrado');
  }
  console.log(`  Instâncias conectadas: ${connected}`);
  console.log(`  Instância alvo do smoke: ${connectedInstance}`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(`[dev-summary] ${err.message}`);
  process.exitCode = 1;
});
