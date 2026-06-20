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

start('backend', process.execPath, [npmCli, 'run', 'dev:backend']);
start('frontend', process.execPath, [npmCli, 'run', 'dev:frontend']);
start('summary', 'node', ['scripts/dev-summary.mjs']);
