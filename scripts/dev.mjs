import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const children = [];
let shuttingDown = false;
function resolveNpmCli() {
  if (process.env.npm_execpath) return process.env.npm_execpath;

  const where = spawnSync('where', ['npm'], { encoding: 'utf8' });
  if (where.status === 0) {
    const first = where.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first) {
      const npmCmd = first.toLowerCase().endsWith('.cmd') ? first : `${first}.cmd`;
      return path.resolve(path.dirname(npmCmd), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    }
  }

  throw new Error('npm_execpath not found and unable to resolve npm-cli.js');
}

// Mata processos que estejam ouvindo em determinada porta (libera lock do DLL do Prisma no Windows)
async function killPort(port) {
  const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: false });
  if (netstat.status !== 0) return;
  const pids = new Set();
  for (const line of netstat.stdout.split(/\r?\n/)) {
    if (line.includes(`:${port}`) && line.includes('LISTENING')) {
      const pid = line.trim().split(/\s+/).at(-1);
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
  }
  if (pids.size === 0) return;
  console.log(`[dev] Liberando porta ${port} (pids: ${[...pids].join(', ')})...`);
  await Promise.all([...pids].map(pid =>
    new Promise(resolve => {
      const k = spawn('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore', shell: false });
      k.on('exit', resolve);
      k.on('error', resolve);
    })
  ));
  // Aguarda o OS liberar o handle do arquivo (DLL lock)
  await new Promise(r => setTimeout(r, 500));
}

const npmCli = resolveNpmCli();

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  children.push({ name, child });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code && code !== 0) {
      console.error(`[dev] ${name} exited with code ${code}${signal ? ` signal ${signal}` : ''}`);
      shutdown(1);
    }
  });
  return child;
}

function killTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
    });
    killer.on('exit', () => resolve());
    killer.on('error', () => resolve());
  });
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[dev] Encerrando processos filhos...');
  for (const { name, child } of children) {
    if (child.pid) {
      console.log(`[dev] Parando ${name} (pid ${child.pid})...`);
    }
  }
  await Promise.all(children.map(({ child }) => killTree(child.pid)));
  console.log('[dev] Encerramento concluído.');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// Mata processos em todo o range de portas que o backend pode ocupar (main.ts tenta 8080-8089)
for (let p = 8080; p <= 8089; p++) await killPort(p);

// Mata todos os processos node.exe restantes (exceto este processo e seu pai) para garantir
// que o DLL lock do Prisma seja liberado antes do predev: prisma generate rodar (Windows EPERM)
await new Promise(resolve => {
  const killer = spawn('powershell', [
    '-Command',
    `Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} -and $_.Id -ne ${process.ppid} } | Stop-Process -Force`
  ], { stdio: 'ignore', shell: false });
  killer.on('exit', resolve);
  killer.on('error', resolve);
});
await new Promise(r => setTimeout(r, 800));

start('backend', process.execPath, [npmCli, 'run', 'dev:backend']);
start('frontend', process.execPath, [npmCli, 'run', 'dev:frontend']);
start('summary', 'node', ['scripts/dev-summary.mjs']);
