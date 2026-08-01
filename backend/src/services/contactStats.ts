import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

function isPostgresDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
}

export async function countContactsForInstance(instanceName: string): Promise<number> {
  if (!instanceName || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) return 0;

  if (isPostgresDatabase()) {
    try {
      const result = await prisma.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
        `SELECT COUNT(*) AS count FROM "wa_mailbox_contacts" WHERE "session_id" = $1`,
        instanceName
      );
      return Number(result[0]?.count ?? 0);
    } catch (err: any) {
      console.warn(`[ZapoRouter] [Contacts] Contact count unavailable for '${instanceName}' in PostgreSQL:`, err.message);
      return 0;
    }
  }

  const sqlitePath = path.join(process.cwd(), '.auth', `${instanceName}.sqlite`);
  const resolvedPath = path.resolve(sqlitePath);
  const authRoot = path.resolve(path.join(process.cwd(), '.auth'));
  if (!resolvedPath.startsWith(authRoot) || !fs.existsSync(sqlitePath)) return 0;

  try {
    const sqlite = require('better-sqlite3');
    const db = sqlite(sqlitePath);
    const row = db.prepare('SELECT COUNT(*) AS count FROM mailbox_contacts').get();
    db.close();
    return Number(row?.count ?? 0);
  } catch (err: any) {
    console.warn(`[ZapoRouter] [Contacts] Contact count unavailable for '${instanceName}' in SQLite:`, err.message);
    return 0;
  }
}

export async function countContactsByInstance(instanceNames: string[]): Promise<Record<string, number>> {
  const uniqueNames = [...new Set(instanceNames.filter(Boolean))];
  const entries = await Promise.all(uniqueNames.map(async (name) => [name, await countContactsForInstance(name)] as const));
  return Object.fromEntries(entries);
}
