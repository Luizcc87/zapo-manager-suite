/**
 * companion.routes.ts
 * Rotas para gerenciamento de Companions (Mobile Primary host) e E-mail de segurança.
 *
 * Bloco A — Companions:
 *   GET    /instance/companion/list/:instanceName
 *   POST   /instance/companion/link/:instanceName      { mode: "qr"|"code", value: string }
 *   DELETE /instance/companion/revoke/:instanceName    { deviceJid: string }
 *   DELETE /instance/companion/revoke-all/:instanceName  ?excludeHostedCompanion=true
 *   POST   /instance/companion/reconcile/:instanceName
 *
 * Bloco B — E-mail:
 *   GET    /instance/email/status/:instanceName
 *   POST   /instance/email/set/:instanceName           { email: string }
 *   POST   /instance/email/request-code/:instanceName  { languageCode: string, localeCode: string }
 *   POST   /instance/email/verify-code/:instanceName   { code: string }
 *   POST   /instance/email/confirm/:instanceName
 */
import { Router, Request, Response } from 'express';
import { ZapoManager } from '../manager';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Extrai o código IQ (ex: "403") de mensagens no formato "<context> iq failed (403: forbidden)"
// lançadas por assertIqResult (zapo-js). Sem isso, toda rejeição do servidor WhatsApp
// vira 500 genérico mesmo quando é um estado esperado (feature não elegível para a conta).
function extractIqErrorCode(message: string): number | null {
  const match = /iq failed \((\d+):/.exec(message);
  return match ? parseInt(match[1], 10) : null;
}

function handleRouteError(err: any, res: Response, instanceName: string, action: string) {
  console.error(`[CompanionRoutes] Erro ao ${action} para ${instanceName}:`, err);
  const iqCode = extractIqErrorCode(err.message || '');
  if (iqCode === 403) {
    res.status(403).json({ error: 'A conta não possui elegibilidade para este recurso no WhatsApp.' });
    return;
  }
  res.status(500).json({ error: err.message });
}

function getActiveClient(instanceName: string, res: Response, requiresMobile = false) {
  const active = ZapoManager.getActive(instanceName);
  if (!active) {
    res.status(404).json({ error: `Instance '${instanceName}' not found or not connected.` });
    return null;
  }
  
  if (requiresMobile && (!active.client.mobile || !active.client.email)) {
    res.status(400).json({ 
      error: "Este recurso requer uma conexão Mobile Primary (Mobile Transport) ativa e não está disponível em sessões Web/Companion." 
    });
    return null;
  }

  return active;
}

// ─── Bloco A: Companions ──────────────────────────────────────────────────────

/**
 * GET /instance/companion/list/:instanceName
 * Lista os companions atualmente pareados a esta instância Mobile Primary.
 */
router.get('/companion/list/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    const companions = await active.client.mobile.listCompanions();
    res.json({ companions });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'listar companions');
  }
});

/**
 * POST /instance/companion/link/:instanceName
 * Body: { mode: "qr" | "code", value: string }
 *
 * mode "qr"   → client.mobile.linkCompanion(qr)
 * mode "code" → client.mobile.linkCompanionByCode(pairingCode)
 *               Requer que o companion_hello já tenha sido gravado antes.
 */
router.post('/companion/link/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { mode, value } = req.body as { mode?: string; value?: string };

  if (!mode || !value) {
    return res.status(400).json({ error: 'Body must contain { mode: "qr" | "code", value: string }.' });
  }
  if (mode !== 'qr' && mode !== 'code') {
    return res.status(400).json({ error: 'mode must be "qr" or "code".' });
  }

  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    const result =
      mode === 'qr'
        ? await active.client.mobile.linkCompanion(value)
        : await active.client.mobile.linkCompanionByCode(value);

    res.json({ result });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'parear companion');
  }
});

/**
 * DELETE /instance/companion/revoke/:instanceName
 * Body: { deviceJid: string, reason?: string }
 */
router.delete('/companion/revoke/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { deviceJid, reason } = req.body as { deviceJid?: string; reason?: string };

  if (!deviceJid) {
    return res.status(400).json({ error: 'Body must contain { deviceJid: string }.' });
  }

  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    await active.client.mobile.revokeCompanion(deviceJid, reason);
    res.json({ success: true });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, `revogar companion ${deviceJid}`);
  }
});

/**
 * DELETE /instance/companion/revoke-all/:instanceName
 * Query: ?excludeHostedCompanion=true  (opcional)
 */
router.delete('/companion/revoke-all/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const excludeHostedCompanion = req.query.excludeHostedCompanion === 'true';

  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    await active.client.mobile.revokeAllCompanions(undefined, { excludeHostedCompanion });
    res.json({ success: true });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'revogar todos os companions');
  }
});

/**
 * POST /instance/companion/reconcile/:instanceName
 * Força sincronização da lista local de companions contra o servidor (usync).
 * Seguro de chamar manualmente a qualquer momento.
 */
router.post('/companion/reconcile/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    const removed = await active.client.mobile.reconcileCompanions();
    res.json({ removed });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'reconciliar companions');
  }
});

// ─── Bloco B: E-mail de Segurança ────────────────────────────────────────────

/**
 * GET /instance/email/status/:instanceName
 * Retorna { email: string | null, verified: boolean, confirmed: boolean }
 */
router.get('/email/status/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    const status = await active.client.email.getStatus();
    res.json(status);
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'obter status do e-mail');
  }
});

/**
 * POST /instance/email/set/:instanceName
 * Body: { email: string }
 * context (WaEmailContext) é deixado como undefined (default da lib).
 */
router.post('/email/set/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ error: 'Body must contain { email: string }.' });
  }

  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    const status = await active.client.email.setEmail(email);
    res.json(status);
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'definir e-mail');
  }
});

/**
 * POST /instance/email/request-code/:instanceName
 * Body: { languageCode: string, localeCode: string }
 * Shape de BuildRequestEmailVerificationCodeInput (zapo-js/dist/.../email.d.ts)
 */
router.post('/email/request-code/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { languageCode, localeCode } = req.body as { languageCode?: string; localeCode?: string };

  if (!languageCode || !localeCode) {
    return res.status(400).json({ error: 'Body must contain { languageCode: string, localeCode: string }.' });
  }

  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    await active.client.email.requestVerificationCode({ languageCode, localeCode });
    res.json({ success: true });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'solicitar código de e-mail');
  }
});

/**
 * POST /instance/email/verify-code/:instanceName
 * Body: { code: string }
 * Retorna { verified: boolean, autoVerifyFailed: boolean, email: string | null }
 */
router.post('/email/verify-code/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const { code } = req.body as { code?: string };

  if (!code) {
    return res.status(400).json({ error: 'Body must contain { code: string }.' });
  }

  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    const result = await active.client.email.verifyCode(code);
    res.json(result);
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'verificar código de e-mail');
  }
});

/**
 * POST /instance/email/confirm/:instanceName
 * Handshake final pós-verificação. context deixado como undefined (default da lib).
 */
router.post('/email/confirm/:instanceName', async (req: Request, res: Response) => {
  const { instanceName } = req.params;
  const active = getActiveClient(instanceName, res, true);
  if (!active) return;

  try {
    await active.client.email.confirm();
    res.json({ success: true });
  } catch (err: any) {
    handleRouteError(err, res, instanceName, 'confirmar e-mail');
  }
});

export default router;
