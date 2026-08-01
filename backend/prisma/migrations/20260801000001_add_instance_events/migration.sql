-- Migration: add_instance_events
-- Eventos operacionais por instância para dashboard interna e notificações.

CREATE TABLE IF NOT EXISTS wa_instance_events (
  id            TEXT        PRIMARY KEY,
  instance_name TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  severity      TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  summary       TEXT        NOT NULL,
  details       JSONB,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_instance_events_instance_created_idx
  ON wa_instance_events(instance_name, created_at DESC);

CREATE INDEX IF NOT EXISTS wa_instance_events_instance_read_idx
  ON wa_instance_events(instance_name, read_at);
