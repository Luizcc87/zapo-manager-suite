-- Migration: add_wa_messages
-- Persiste mensagens quando SAVE_DATA_NEW_MESSAGE=true

CREATE TABLE IF NOT EXISTS "wa_messages" (
  "id"               TEXT NOT NULL,
  "instanceName"     TEXT NOT NULL,
  "remoteJid"        TEXT NOT NULL,
  "messageId"        TEXT NOT NULL,
  "fromMe"           BOOLEAN NOT NULL DEFAULT false,
  "pushName"         TEXT NOT NULL DEFAULT '',
  "messageType"      TEXT NOT NULL DEFAULT 'unknown',
  "message"          JSONB,
  "messageTimestamp" TEXT NOT NULL,
  "source"           TEXT NOT NULL DEFAULT 'baileys',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wa_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wa_messages_instanceName_messageId_key"
  ON "wa_messages"("instanceName", "messageId");

CREATE INDEX IF NOT EXISTS "wa_messages_instanceName_remoteJid_idx"
  ON "wa_messages"("instanceName", "remoteJid");
