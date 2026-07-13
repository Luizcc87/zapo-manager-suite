import { expect, test, type Page } from '@playwright/test';

import { createTestInstance, deleteTestInstance, GLOBAL_API_KEY, LOCAL_API_URL, tmpName } from './helpers/manager-fixtures';

const LANG_LABELS = [
  { label: /Portugu(ê|e)s|Portuguese/i, dashboard: /Inst[aâ]ncias|Instances/i, create: /^Inst[aâ]ncia$|^Instance$/i },
  { label: /English/i, dashboard: /Instances/i, create: /^Instance$/i },
  { label: /Español|Spanish/i, dashboard: /Instancias|Instances/i, create: /^Instancia$/i },
  { label: /Français|French/i, dashboard: /Instances/i, create: /^Instance$/i },
];

const UI_REAL_PREFIX = 'ui-real-';
const trackedInstances: string[] = [];

async function cleanupUiRealInstances(request: Parameters<typeof test.beforeAll>[0]['request']) {
  const response = await request.get(`${LOCAL_API_URL}/instance/fetchInstances`, {
    headers: { apikey: GLOBAL_API_KEY },
  });
  if (!response.ok()) return;

  const instances = (await response.json()) as Array<{ name?: string; instanceName?: string }>;
  for (const instance of instances) {
    const name = instance.name || instance.instanceName || '';
    if (!name.startsWith(UI_REAL_PREFIX)) continue;
    await deleteTestInstance(request, name);
  }
}

async function openAuthenticatedDashboard(page: Page) {
  await page.goto('/manager/');
  await expect(page.getByRole('heading', { name: /Inst[aâ]ncias|Instances/i })).toBeVisible();
}

async function loginWithRealBackend(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/manager/login');
  await expect(page.locator('#login-serverUrl')).toBeVisible();
  await page.locator('#login-serverUrl').fill(LOCAL_API_URL);
  await page.locator('#login-apiKey').fill(GLOBAL_API_KEY);
  await page.getByRole('button', { name: /Conectar|Login/i }).click();
  await expect(page).toHaveURL(/\/manager\/$/);
}

test.describe('Zapo Manager UI real - backend vivo', () => {
  test.beforeAll(async ({ request }) => {
    await cleanupUiRealInstances(request);
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ apiUrl, globalKey }) => {
      localStorage.clear();
      localStorage.setItem('apiUrl', apiUrl);
      localStorage.setItem('token', globalKey);
      localStorage.setItem('version', '1.0.0');
      localStorage.setItem('provider', 'zapo');
      localStorage.setItem('clientName', 'zapo-manager');
      localStorage.setItem('i18nextLng', 'pt-BR');
    }, { apiUrl: LOCAL_API_URL, globalKey: GLOBAL_API_KEY });
  });

  test.afterEach(async ({ request }) => {
    while (trackedInstances.length) {
      const instanceName = trackedInstances.pop();
      if (instanceName) {
        await deleteTestInstance(request, instanceName);
      }
    }
  });

  test.afterAll(async ({ request }) => {
    await cleanupUiRealInstances(request);
  });

  test('login, dashboard e criacao de instancia funcionam com backend real', async ({ page, request }) => {
    const instanceName = tmpName('ui-real');
    try {
      await loginWithRealBackend(page);

      await expect(page.getByRole('heading', { name: /Inst[aâ]ncias|Instances/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Inst[aâ]ncia$|^Instance$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Registrar como Prim[aá]rio|Register as Primary/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Atualizar|Refresh/i })).toBeVisible();

      await page.getByRole('button', { name: /^Inst[aâ]ncia$|^Instance$/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Nova Inst[aâ]ncia|New instance/i })).toBeVisible();

      await page.getByRole('textbox', { name: /Name \*/i }).fill(instanceName);
      await page.getByRole('button', { name: /Salvar|Save/i }).click();

      await expect(page.locator('button').filter({ hasText: instanceName }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Configurações|Settings/i }).first()).toBeVisible();
      trackedInstances.push(instanceName);
    } finally {
      await deleteTestInstance(request, instanceName);
    }
  });

  test('navega entre dashboard, settings, webhook e proxy com persistencia real', async ({ page, request }) => {
    const created = await createTestInstance(request, 'ui-real');
    trackedInstances.push(created.name);
    try {
      await openAuthenticatedDashboard(page);

      await page.goto(`/manager/instance/${created.id}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`/manager/instance/${created.id}/dashboard$`));
      await expect(page.getByRole('button', { name: /Atualizar|Refresh/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: new RegExp(created.name, 'i') })).toBeVisible();

      await page.goto(`/manager/instance/${created.id}/settings`);
      await expect(page.getByRole('heading', { name: /Comportamento|Settings/i })).toBeVisible();
      await expect(page.getByRole('switch', { name: /Ignorar Grupos|Ignore Groups/i })).toBeVisible();

      await page.goto(`/manager/instance/${created.id}/webhook`);
      await expect(page.getByRole('heading', { name: /Webhook/i })).toBeVisible();
      await expect(page.getByRole('switch', { name: /Webhook Base64/i })).toBeVisible();
      await expect(page.getByRole('switch', { name: /Webhook por Eventos|Webhook by Events/i })).toBeVisible();

      await page.goto(`/manager/instance/${created.id}/proxy`);
      await expect(page.locator('main')).toContainText(/Proxy/i);
    } finally {
      await deleteTestInstance(request, created.name);
    }
  });

  test('settings e webhook persistem toggles apos salvar e recarregar', async ({ page, request }) => {
    const created = await createTestInstance(request, 'ui-real');
    trackedInstances.push(created.name);
    try {
      await openAuthenticatedDashboard(page);

      await page.goto(`/manager/instance/${created.id}/dashboard`);
      const sidebar = page.locator('aside');

      await sidebar.getByRole('button', { name: /Configurações|Configurations/i }).click();
      await sidebar.getByRole('link', { name: /Comportamento|Settings/i }).click();
      const ignoreGroups = page.getByRole('switch', { name: /Ignorar Grupos|Ignore Groups/i });
      const alwaysOnline = page.getByRole('switch', { name: /Sempre Online|Always Online/i });
      await ignoreGroups.click();
      await alwaysOnline.click();
      await page.getByRole('button', { name: /Salvar|Save/i }).click();
      await expect(page.getByText(/aplicado com sucesso|applied successfully/i)).toBeVisible();
      await page.reload();
      await expect(page.getByRole('switch', { name: /Ignorar Grupos|Ignore Groups/i })).toBeChecked();
      await expect(page.getByRole('switch', { name: /Sempre Online|Always Online/i })).toBeChecked();

      await sidebar.getByRole('button', { name: /Eventos|Events/i }).click();
      await sidebar.getByRole('link', { name: /Webhook/i }).click();
      const enabled = page.getByRole('switch', { name: /Ativo|Enabled/i });
      const base64 = page.getByRole('switch', { name: /Webhook Base64/i });
      const byEvents = page.getByRole('switch', { name: /Webhook por Eventos|Webhook by Events/i });
      await enabled.click();
      await base64.click();
      await byEvents.click();
      await page.getByLabel(/^URL$/i).fill('https://example.com/webhook');
      await page.getByRole('button', { name: /Salvar|Save/i }).click();
      await expect(page.getByText(/aplicado com sucesso|applied successfully/i)).toBeVisible();
      await page.reload();
      await expect(page.getByRole('switch', { name: /Ativo|Enabled/i })).toBeChecked();
      await expect(page.getByRole('switch', { name: /Webhook Base64/i })).toBeChecked();
      await expect(page.getByRole('switch', { name: /Webhook por Eventos|Webhook by Events/i })).toBeChecked();
      await expect(page.getByLabel(/^URL$/i)).toHaveValue('https://example.com/webhook');
    } finally {
      await deleteTestInstance(request, created.name);
    }
  });

  test.skip('troca de idioma altera textos visiveis em 4 idiomas', async ({ page, request }) => {
    const created = await createTestInstance(request, 'ui-real');
    trackedInstances.push(created.name);
    try {
      await openAuthenticatedDashboard(page);
      await page.goto(`/manager/instance/${created.id}/dashboard`);

      for (const lang of LANG_LABELS) {
        let menuOpened = false;
        for (const index of [0, 1]) {
          await page.locator('header button').nth(index).click();
          const menuItem = page.getByRole('menuitem', { name: lang.label });
          if (await menuItem.count()) {
            menuOpened = true;
            await menuItem.click();
            break;
          }
          await page.keyboard.press('Escape');
        }
        expect(menuOpened).toBe(true);
        await expect(page.getByRole('button', { name: /Sair|Sign out|Cerrar sesi[oó]n|Se d[eé]connecter/i })).toBeVisible();
        await expect(page.locator('aside')).toContainText(lang.dashboard);
      }
    } finally {
      await deleteTestInstance(request, created.name);
    }
  });

  test('menu da instância renderiza abas reais sem depender de WhatsApp conectado', async ({ page, request }) => {
    const created = await createTestInstance(request, 'ui-real');
    trackedInstances.push(created.name);
    try {
      await openAuthenticatedDashboard(page);
      await page.goto(`/manager/instance/${created.id}/dashboard`);

      const sidebar = page.locator('aside');
      await expect(sidebar).toContainText(/Vis[aã]o Geral|Dashboard/i);
      await expect(sidebar).toContainText(/Chat/i);
      await expect(sidebar).toContainText(/Contatos|Contacts/i);
      await expect(sidebar).toContainText(/Configurações|Configurations/i);
      await expect(sidebar).toContainText(/Eventos|Events/i);
    } finally {
      await deleteTestInstance(request, created.name);
    }
  });
});
