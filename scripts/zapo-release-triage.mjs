#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--release-url' || arg === '--tag' || arg === '--notes-file' || arg === '--output') {
    opts[arg.slice(2)] = args[i + 1];
    i += 1;
  } else if (arg === '--evolution-api') {
    opts['evolution-api'] = true;
  } else if (arg === '--mode') {
    opts.mode = args[i + 1];
    i += 1;
  }
}

const projectRoot = process.cwd();
const syncDoc = path.join(projectRoot, 'docs', 'SYNC-UPSTREAM.md');
const changelog = path.join(projectRoot, 'CHANGELOG.md');

const localTargets = [
  'backend/src/manager.ts',
  'backend/src/routes/message.routes.ts',
  'backend/src/routes/instance.routes.ts',
  'backend/src/config/device.ts',
  'backend/src/config/fetchAndroidWaVersion.ts',
];

const checks = [
  {
    label: 'new event',
    target: 'backend/src/manager.ts',
    note: 'Verify socket/webhook emission and any event typing exposed to the UI.',
  },
  {
    label: 'message delivery / JID',
    target: 'backend/src/routes/message.routes.ts',
    note: 'Verify 1:1 sends, Brazilian JID resolution, and interactive payload wrapping.',
  },
  {
    label: 'credentials / secrets / persistence',
    target: 'backend/src/manager.ts',
    note: 'Verify store contract before enabling any persistence-related upstream change.',
  },
  {
    label: 'mobile transport / device identity',
    target: 'backend/src/config/device.ts',
    note: 'Verify runtime device resolution and Android app-version fallback behavior.',
  },
];

const implementationChecklist = [
  'Inspect the impacted backend files before changing behavior.',
  'Verify whether the upstream item changes a local contract, payload, or persistence rule.',
  'Confirm whether the current implementation already covers the release behavior.',
  'If a change is required, keep it scoped to the smallest local touchpoint.',
];

const testChecklist = [
  'Run `npx tsc --noEmit`.',
  'Run targeted backend or Playwright tests for the impacted flow.',
  'Add or update tests for any changed event, payload, or JID behavior.',
  'If persistence or secrets changed upstream, verify the store-backed path explicitly.',
];

const changelogChecklist = [
  'Add an entry when the release changes behavior, contracts, schema, or public API.',
  'Include the release tag, scope, and the exact local files affected.',
  'Update `docs/openapi.yaml` if the public API surface changed.',
];

const modeMap = {
  zapo: {
    title: 'zapo-js Upstream',
    localTargets: [
      'backend/src/manager.ts',
      'backend/src/routes/message.routes.ts',
      'backend/src/routes/instance.routes.ts',
      'backend/src/config/device.ts',
      'backend/src/config/fetchAndroidWaVersion.ts',
    ],
    quickChecks: [
      ['new event', 'backend/src/manager.ts', 'Verify socket/webhook emission and any event typing exposed to the UI.'],
      ['message delivery / JID', 'backend/src/routes/message.routes.ts', 'Verify 1:1 sends, Brazilian JID resolution, and interactive payload wrapping.'],
      ['credentials / secrets / persistence', 'backend/src/manager.ts', 'Verify store contract before enabling any persistence-related upstream change.'],
      ['mobile transport / device identity', 'backend/src/config/device.ts', 'Verify runtime device resolution and Android app-version fallback behavior.'],
    ],
  },
  baileys: {
    title: 'Baileys Upstream',
    localTargets: [
      'backend/src/routes/instance.routes.ts',
      'backend/src/manager.ts',
      'backend/src/tests/zapo-migration.test.ts',
      'backend/src/tests/chat-corrections.test.ts',
    ],
    quickChecks: [
      ['registration / OTP', 'backend/src/routes/instance.routes.ts', 'Verify requestCode and confirmCode flows plus auth mapping.'],
      ['credential mapping', 'backend/src/manager.ts', 'Verify Baileys credential conversion and persistence path.'],
      ['message event compatibility', 'backend/src/manager.ts', 'Verify event shape and message normalization stay consistent.'],
      ['primary flow tests', 'backend/src/tests/zapo-migration.test.ts', 'Verify the primary registration suite still passes.'],
    ],
  },
  evolution: {
    title: 'Evolution Manager v2 Subtree',
    localTargets: [
      'frontend/src/lib/provider/features.ts',
      'frontend/src/routes/index.tsx',
      'frontend/src/pages',
      'backend/src/main.ts',
      'docs/openapi.yaml',
    ],
    quickChecks: [
      ['frontend assumptions', 'frontend/src/lib/provider/features.ts', 'Verify feature guards and provider-specific UI behavior.'],
      ['route shape', 'backend/src/main.ts', 'Verify mocked license/auth envelopes still satisfy the manager UI.'],
      ['API contract', 'docs/openapi.yaml', 'Verify endpoints and examples still reflect the subtree expectations.'],
      ['UI sync', 'frontend/src/routes/index.tsx', 'Verify navigation and screens still match the upstream manager layout.'],
    ],
  },
};

function inferModeFromReleaseUrl(input) {
  const ref = parseReleaseUrl(input);
  if (!ref?.owner || !ref?.repo) return null;
  const ownerRepo = `${ref.owner}/${ref.repo}`.toLowerCase();
  if (ownerRepo === 'vinikjkkj/zapo') return 'zapo';
  if (ownerRepo === 'whiskeysockets/baileys') return 'baileys';
  if (ownerRepo === 'evolution-foundation/evolution-manager-v2') return 'evolution';
  return null;
}

const evolutionApiChecklist = [
  'Validate the local API emulation against the Evolution API v2 contract for any changed endpoint.',
  'Check whether the frontend assumptions in `frontend/src/lib/provider/features.ts` still match the backend response shape.',
  'Verify that mocked license, auth, and response envelopes still satisfy the Manager UI.',
  'Update `docs/openapi.yaml` if the public contract changed or if the compatibility note needs to be explicit.',
];

const evolutionApiEndpoints = [
  'GET /',
  'GET /license/status',
  'GET /license/register',
  'GET /license/activate',
  'POST /verify-creds',
  'GET /instance/fetchInstances',
  'POST /instance/create',
  'GET /instance/connect/:instanceName',
  'GET /instance/connectionState/:instanceName',
  'POST /instance/register/requestCode',
  'POST /instance/register/confirmCode',
  'POST /instance/syncProfile/:instanceName',
  'DELETE /instance/logout/:instanceName',
  'DELETE /instance/delete/:instanceName',
  'GET /message/status/:instanceName/:messageId',
  'POST /message/sendText/:instanceName',
  'POST /message/sendMedia/:instanceName',
  'POST /message/sendWhatsAppAudio/:instanceName',
  'POST /message/sendSticker/:instanceName',
  'POST /message/sendButtons/:instanceName',
  'POST /message/sendList/:instanceName',
  'POST /message/sendCarousel/:instanceName',
  'GET /chat/findChats/:instanceName',
  'POST /chat/findMessages/:instanceName',
  'GET /contact/find/:instanceName',
  'GET /webhook/find/:instanceName',
  'POST /webhook/set/:instanceName',
  'GET /settings/find/:instanceName',
  'POST /settings/set/:instanceName',
  'GET /proxy/find/:instanceName',
  'POST /proxy/set/:instanceName',
  'GET /proxy/status/:instanceName',
  'POST /proxy/replace/:instanceName',
];

function parseReleaseUrl(input) {
  if (!input) return null;
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/releases\/tag\/([^/]+)/);
    return {
      owner: url.pathname.split('/')[1],
      repo: url.pathname.split('/')[2],
      tag: match?.[1] || null,
      href: input,
    };
  } catch {
    return null;
  }
}

function classifyLine(line) {
  const lower = line.toLowerCase();
  if (/fix|bug|patch/.test(lower)) return 'bug fix';
  if (/feat|add|new capability|feature/.test(lower)) return 'new capability';
  if (/breaking|remove|drop|deprecat/.test(lower)) return 'breaking';
  if (/doc|readme|changelog/.test(lower)) return 'documentation only';
  return 'compatibility';
}

async function fetchReleaseNotes() {
  const ref = parseReleaseUrl(opts['release-url']);
  if (!ref?.owner || !ref?.repo || !ref?.tag) return null;

  const apiUrl = `https://api.github.com/repos/${ref.owner}/${ref.repo}/releases/tags/${ref.tag}`;
  const res = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'zapo-release-triage',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: data.name || data.tag_name || ref.tag,
    body: data.body || '',
    htmlUrl: data.html_url || ref.href,
    publishedAt: data.published_at || null,
  };
}

function extractBullets(body) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = [];
  for (const line of lines) {
    const bullet = line.match(/^[-*+]\s+(.*)$/)?.[1];
    if (bullet) {
      bullets.push(bullet);
    }
  }
  return bullets.slice(0, 12);
}

function parseOpenApiPaths(specText) {
  const lines = String(specText || '').split(/\r?\n/);
  const paths = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^\/[^\s:]+:/);
    if (m) paths.push(m[0].slice(0, -1));
  }
  return paths;
}

async function loadOpenApiPaths() {
  try {
    const spec = await fs.readFile(path.join(projectRoot, 'docs', 'openapi.yaml'), 'utf8');
    return parseOpenApiPaths(spec);
  } catch {
    return [];
  }
}

function rel(file) {
  return path.relative(projectRoot, file).replace(/\\/g, '/');
}

function render() {
  const bullets = Array.isArray(render.releaseBullets) ? render.releaseBullets : [];
  const releaseInfo = render.releaseInfo || null;
  const inferredMode = inferModeFromReleaseUrl(opts['release-url']);
  const modeKey = modeMap[opts.mode] ? opts.mode : (opts.mode === 'auto' || !opts.mode ? (inferredMode || 'zapo') : 'zapo');
  const mode = modeMap[modeKey];
  const openApiPaths = Array.isArray(render.openApiPaths) ? render.openApiPaths : [];
  const lines = [];
  lines.push(`# ${mode.title} Release Triage`);
  lines.push('');
  lines.push(`- Mode: ${modeKey}`);
  lines.push(`- Release URL: ${opts['release-url'] || '(not provided)'}`);
  lines.push(`- Tag: ${opts.tag || '(not provided)'}`);
  lines.push(`- Notes file: ${opts['notes-file'] || '(not provided)'}`);
  if (releaseInfo) {
    lines.push(`- Upstream title: ${releaseInfo.title}`);
    if (releaseInfo.publishedAt) {
      lines.push(`- Published at: ${releaseInfo.publishedAt}`);
    }
  }
  lines.push('');
  lines.push('## Release Summary');
  if (bullets.length) {
    for (const bullet of bullets.slice(0, 5)) {
      lines.push(`- ${bullet}`);
    }
  } else {
    lines.push('- Summarize the upstream release note here.');
  }
  lines.push('');
  lines.push('## Implementation Checklist');
  for (const item of implementationChecklist) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Test Checklist');
  for (const item of testChecklist) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## CHANGELOG.md Update');
  for (const item of changelogChecklist) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  if (opts['evolution-api']) {
    lines.push('## Evolution API Compatibility Check');
    for (const item of evolutionApiChecklist) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('### Endpoint Coverage');
    for (const endpoint of evolutionApiEndpoints) {
      lines.push(`- ${endpoint}`);
    }
    if (openApiPaths.length) {
      lines.push('');
      lines.push('### OpenAPI Coverage');
      for (const endpoint of openApiPaths) {
        lines.push(`- ${endpoint}`);
      }
    }
    lines.push('');
  }
  lines.push('## Local Impact Map');
  if (bullets.length) {
    for (const bullet of bullets.slice(0, 8)) {
      lines.push(`- [${classifyLine(bullet)}] ${bullet}`);
    }
  } else {
    lines.push('- Classify each upstream item as breaking, compatibility, bug fix, new capability, or docs only.');
  }
  lines.push('');
  lines.push('## Likely Code Touchpoints');
  for (const target of mode.localTargets) {
    lines.push(`- ${rel(path.join(projectRoot, target))}`);
  }
  lines.push('');
  lines.push('## Tests to Run');
  lines.push('- `npx tsc --noEmit`');
  lines.push('- Targeted Playwright / backend tests for the impacted flow');
  lines.push('');
  lines.push('## Docs to Update');
  lines.push(`- ${rel(syncDoc)}`);
  lines.push(`- ${rel(changelog)}`);
  lines.push('');
  lines.push('## Decision');
  lines.push('- Decide whether to implement, defer, or ignore each item.');
  lines.push('');
  lines.push('## Quick Checkpoints');
  for (const check of mode.quickChecks) {
    lines.push(`- ${check[0]}: ${check[1]} — ${check[2]}`);
  }
  lines.push('');
  lines.push('## Formal Workflow');
  lines.push('1. Triagem da release');
  lines.push('2. Checklist de implementação');
  lines.push('3. Checklist de testes');
  lines.push('4. Atualização sugerida de `CHANGELOG.md`');
  if (opts['evolution-api']) {
    lines.push('5. Validação de compatibilidade com a Evolution API v2');
  }
  lines.push(`6. Mode-specific review: ${modeKey}`);
  lines.push('7. Next Actions');
  if (modeKey === 'zapo') {
    lines.push('   - `npx tsc --noEmit`');
    lines.push('   - Run targeted backend tests for `backend/src/manager.ts` and `backend/src/routes/message.routes.ts`');
    lines.push('   - Update `CHANGELOG.md` and `docs/openapi.yaml` if the API surface changed');
  } else if (modeKey === 'baileys') {
    lines.push('   - Run primary-registration and migration tests');
    lines.push('   - Verify `backend/src/routes/instance.routes.ts` and `backend/src/manager.ts` against the new Baileys behavior');
    lines.push('   - Confirm whether the Baileys API change affects the SMS/OTP flow');
  } else {
    lines.push('   - Compare the subtree release note with frontend assumptions and `backend/src/main.ts` envelopes');
    lines.push('   - Validate `docs/openapi.yaml` against the current contract');
    lines.push('   - Run the UI smoke tests that cover the changed manager flow');
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const releaseInfo = await fetchReleaseNotes();
  const bullets = extractBullets(releaseInfo?.body);
  const openApiPaths = opts['evolution-api'] ? await loadOpenApiPaths() : [];
  render.releaseInfo = releaseInfo;
  render.releaseBullets = bullets;
  render.openApiPaths = openApiPaths;
  const output = render();
  if (opts.output) {
    await fs.writeFile(path.resolve(projectRoot, opts.output), output, 'utf8');
    console.log(`Wrote ${opts.output}`);
    return;
  }
  process.stdout.write(output);
}

main().catch((err) => {
  console.error(`[zapo-release-triage] ${err.message}`);
  process.exitCode = 1;
});
