-- CreateTable
CREATE TABLE IF NOT EXISTS "Instance" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "mobileTransport" BOOLEAN NOT NULL DEFAULT false,
    "registeredPhone" TEXT,
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Instance_instanceName_key" ON "Instance"("instanceName");

-- AddColumn (idempotente para bancos existentes sem a coluna)
ALTER TABLE "Instance" ADD COLUMN IF NOT EXISTS "registeredPhone" TEXT;
ALTER TABLE "Instance" ADD COLUMN IF NOT EXISTS "mobileTransport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Instance" ADD COLUMN IF NOT EXISTS "deviceInfo" JSONB;
