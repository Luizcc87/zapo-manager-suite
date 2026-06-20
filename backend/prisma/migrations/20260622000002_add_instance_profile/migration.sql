-- Migration idempotente: adiciona campos de perfil na tabela Instance
-- Usado para armazenar foto de perfil, nome e JID do dono da instância.

ALTER TABLE "Instance"
  ADD COLUMN IF NOT EXISTS "profilePicUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "profileName"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "ownerJid"      TEXT NOT NULL DEFAULT '';
