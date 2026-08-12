-- Migration idempotente: adiciona CRM leve por contato
-- wa_instance_field_map: slots de campos por instância
-- leadFields: valores por contato na tabela wa_chats

CREATE TABLE IF NOT EXISTS "wa_instance_field_map" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_instance_field_map_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wa_instance_field_map_instanceName_slotKey_key" 
    ON "wa_instance_field_map"("instanceName", "slotKey");

ALTER TABLE "wa_chats" ADD COLUMN IF NOT EXISTS "leadFields" JSONB;
