import { spawn } from 'node:child_process';

const children = [];
let shuttingDown = false;

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
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
      shell: true,
    });
    killer.on('exit', () => resolve());
    killer.on('error', () => resolve());
  });
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all(children.map(({ child }) => killTree(child.pid)));
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('backend', 'npm', ['run', 'dev:backend']);
start('frontend', 'npm', ['run', 'dev:frontend']);
start('summary', 'node', ['scripts/dev-summary.mjs']);
