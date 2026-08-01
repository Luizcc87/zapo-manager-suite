-- Migration: add_notification_channels
-- Canais configuráveis por instância para envio externo de alertas.

CREATE TABLE IF NOT EXISTS wa_notification_channels (
  id            TEXT        PRIMARY KEY,
  instance_name TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  name          TEXT        NOT NULL DEFAULT '',
  enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  config        JSONB       NOT NULL,
  events        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_notification_channels_instance_type_idx
  ON wa_notification_channels(instance_name, type);
