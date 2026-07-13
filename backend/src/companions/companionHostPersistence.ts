/**
 * CompanionHostPersistence — adaptador Prisma para persistir o estado de época
 * do host de companions de instâncias Mobile Primary.
 *
 * O Zapo exige que rawId + currentKeyIndex sejam preservados entre restarts para
 * evitar reemissão do mesmo keyIndex a um novo companion (o que quebraria a
 * decriptação do companion antigo).
 */
import { PrismaClient } from '@prisma/client';
import type { CompanionHostPersistence, CompanionHostEpochState, CompanionRecord } from 'zapo-js';
import { randomUUID } from 'crypto';

export function createPrismaCompanionHostPersistence(
  prisma: PrismaClient,
  instanceName: string
): CompanionHostPersistence {
  return {
    async load(): Promise<CompanionHostEpochState | null> {
      const epoch = await prisma.waCompanionHostEpoch.findUnique({
        where: { instanceName },
        include: { companions: true },
      });
      if (!epoch) return null;

      const companions: CompanionRecord[] = epoch.companions.map((c) => ({
        deviceJid: c.deviceJid,
        keyIndex: c.keyIndex,
        companionIdentityPublicKey: new Uint8Array(c.companionIdentityPublicKey),
        addedAtSeconds: c.addedAtSeconds,
      }));

      return {
        rawId: epoch.rawId,
        currentKeyIndex: epoch.currentKeyIndex,
        companions,
      };
    },

    async save(state: CompanionHostEpochState): Promise<void> {
      await prisma.$transaction(async (tx) => {
        // Upsert da época
        await tx.waCompanionHostEpoch.upsert({
          where: { instanceName },
          create: {
            id: randomUUID(),
            instanceName,
            rawId: state.rawId,
            currentKeyIndex: state.currentKeyIndex,
          },
          update: {
            rawId: state.rawId,
            currentKeyIndex: state.currentKeyIndex,
          },
        });

        // Substituição atômica da lista de companions
        await tx.waCompanionDevice.deleteMany({ where: { instanceName } });
        if (state.companions.length > 0) {
          await tx.waCompanionDevice.createMany({
            data: state.companions.map((c) => ({
              id: randomUUID(),
              instanceName,
              deviceJid: c.deviceJid,
              keyIndex: c.keyIndex,
              companionIdentityPublicKey: Buffer.from(c.companionIdentityPublicKey),
              addedAtSeconds: c.addedAtSeconds,
            })),
          });
        }
      });
    },
  };
}
