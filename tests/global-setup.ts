/**
 * tests/global-setup.ts
 *
 * Executado pelo Playwright ANTES de qualquer teste e ANTES do webServer iniciar.
 *
 * Responsabilidades:
 *   1. Limpar locks Redis (lock:zapo:*) que processos anteriores possam ter deixado.
 *      Sem isso, o backend novo não consegue adquirir o lock e não reconecta as instâncias.
 *   2. Logar o ambiente que será usado nos testes para facilitar diagnóstico de falhas.
 *
 * APRENDIZADOS DA SESSÃO (2026-06-20):
 *   - Locks Redis são TTL=30s, renovados a cada 10s (ver manager.ts).
 *   - Quando o processo node morre abruptamente, o lock expira em até 30s.
 *   - Para testes locais, limpar antes é mais rápido e confiável do que esperar o TTL.
 *   - ioredis já está disponível em backend/node_modules — não precisa instalar separado.
 */

import * as path from 'path';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
const BASE_URL  = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

export default async function globalSetup(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       Zapo Manager — Playwright Global Setup     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Backend URL : ${BASE_URL}`);
  console.log(`  Redis URL   : ${REDIS_URL}`);
  console.log(`  Global Key  : ${process.env.GLOBAL_API_KEY || 'global_key'}`);

  await clearRedisLocks();

  console.log('══════════════════════════════════════════════════\n');
}

/**
 * Remove todos os locks Redis no padrão lock:zapo:*.
 *
 * Usa ioredis do backend/node_modules — já instalado como dependência do projeto.
 * Em caso de falha (Redis inacessível), apenas loga um aviso e continua —
 * os testes podem ainda funcionar se os locks expiraram naturalmente.
 */
async function clearRedisLocks(): Promise<void> {
  // Importar ioredis do node_modules do backend para não precisar de dependência extra no root
  const ioredisPath = path.resolve(__dirname, '../backend/node_modules/ioredis');

  let redis: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require(ioredisPath);
    redis = new Redis(REDIS_URL, {
      // Timeout rápido: se Redis não estiver disponível, falha rápido em vez de travar
      connectTimeout: 3000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await redis.connect();

    const lockKeys: string[] = await redis.keys('lock:zapo:*');

    if (lockKeys.length === 0) {
      console.log('  [Redis] ✅ Nenhum lock encontrado.');
    } else {
      await redis.del(...lockKeys);
      console.log(`  [Redis] 🗑️  Removidos ${lockKeys.length} lock(s):`);
      lockKeys.forEach(k => console.log(`           - ${k}`));
    }
  } catch (err: any) {
    console.warn(`  [Redis] ⚠️  Não foi possível limpar locks: ${err.message}`);
    console.warn('           Continuando — locks expirarão naturalmente em até 30s.');
  } finally {
    if (redis) {
      try { await redis.quit(); } catch { /* silencioso */ }
    }
  }
}
