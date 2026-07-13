-- Migration: add_companion_host_tables
-- Tabelas para persistência do CompanionHostEpoch (Mobile Primary host de companions)

CREATE TABLE IF NOT EXISTS wa_companion_host_epoch (
  id                TEXT        PRIMARY KEY,
  instance_name     TEXT        NOT NULL UNIQUE,
  raw_id            INTEGER     NOT NULL,
  current_key_index INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_companion_devices (
  id                            TEXT        PRIMARY KEY,
  instance_name                 TEXT        NOT NULL,
  device_jid                    TEXT        NOT NULL,
  key_index                     INTEGER     NOT NULL,
  companion_identity_public_key BYTEA       NOT NULL,
  added_at_seconds              INTEGER     NOT NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_name, device_jid),
  FOREIGN KEY (instance_name) REFERENCES wa_companion_host_epoch(instance_name) ON DELETE CASCADE
);
