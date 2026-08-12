-- Migration idempotente: adiciona controle de handoff bot/humano em wa_chats.
-- status: pending (bot pode responder) | open (humano assumiu) | resolved (encerrada).

ALTER TABLE "wa_chats" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "wa_chats" ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT;
ALTER TABLE "wa_chats" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "wa_chats" ADD COLUMN IF NOT EXISTS "statusChangedBy" TEXT;

CREATE INDEX IF NOT EXISTS "wa_chats_instanceName_status_idx"
    ON "wa_chats"("instanceName", "status");
