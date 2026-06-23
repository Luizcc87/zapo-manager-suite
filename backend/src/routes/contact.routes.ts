import { Router, Request, Response } from 'express';
import { checkInstanceApiKey } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

router.get('/find/:instanceName', checkInstanceApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;

    // 1. Path confinement / regex validation to prevent path traversal
    if (!instanceName || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
      return res.status(400).json({ error: 'Invalid instanceName format' });
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
    let rawContacts: any[] = [];

    if (isPostgres) {
      try {
        // Query wa_contacts directly
        rawContacts = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "wa_contacts" WHERE "session_id" = $1 ORDER BY "name" ASC`,
          instanceName
        );
      } catch (err: any) {
        // Try/catch returns [] if table does not exist or querying fails
        console.warn(`[ZapoRouter] [Contacts] Failed to query PostgreSQL wa_contacts table:`, err.message);
        rawContacts = [];
      }
    } else {
      // SQLite path confinement
      const sqlitePath = path.join(process.cwd(), '.auth', `${instanceName}.sqlite`);
      const resolvedPath = path.resolve(sqlitePath);
      if (!resolvedPath.startsWith(path.resolve(path.join(process.cwd(), '.auth')))) {
        return res.status(403).json({ error: 'Forbidden path traversal' });
      }

      if (fs.existsSync(sqlitePath)) {
        try {
          const sqlite = require('better-sqlite3');
          const db = sqlite(sqlitePath);
          rawContacts = db.prepare('SELECT * FROM mailbox_contacts ORDER BY COALESCE(display_name, push_name, jid) ASC').all();
          db.close();
        } catch (err: any) {
          console.warn(`[ZapoRouter] [Contacts] Failed to query SQLite mailbox_contacts table:`, err.message);
          rawContacts = [];
        }
      }
    }

    // Normalize keys (PostgreSQL snake_case/camelCase/SQLite compatibility)
    const contacts = rawContacts.map((c: any) => ({
      id: c.id || c.jid || '',
      name: c.name || c.display_name || c.notify || c.push_name || c.verifiedName || c.verified_name || '',
      notify: c.notify || c.push_name || '',
      verifiedName: c.verifiedName || c.verified_name || ''
    }));

    return res.json(contacts);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
