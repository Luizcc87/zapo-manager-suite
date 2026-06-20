-- Migration idempotente: cria tabela wa_chats para persistência da lista de chats
-- Sobrevive a restarts sem perder histórico de conversas.

CREATE TABLE IF NOT EXISTS "wa_chats" (
    "id"           TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "remoteJid"    TEXT NOT NULL,
    "pushName"     TEXT NOT NULL DEFAULT '',
    "profilePicUrl" TEXT NOT NULL DEFAULT '',
    "labels"       JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wa_chats_pkey" PRIMARY KEY ("id")
);

-- Índice único idempotente (instância + jid)
CREATE UNIQUE INDEX IF NOT EXISTS "wa_chats_instanceName_remoteJid_key"
    ON "wa_chats"("instanceName", "remoteJid");
