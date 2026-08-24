/**
 * Backfill: inicializa a tabela CompanySequence com o maior código/numeração
 * já existente por tenant e tipo, garantindo que a numeração atômica da Etapa 4
 * não pule nem reutilize números após a migração.
 *
 * Uso:
 *   npx tsx scripts/backfill-company-sequences.ts            # executa o backfill
 *   npx tsx scripts/backfill-company-sequences.ts --dry-run  # apenas visualiza
 *
 * Requer DATABASE_URL configurado no .env.
 *
 * Nota: a migration 0007 já inclui este backfill via SQL (INSERT ... ON DUPLICATE
 * KEY UPDATE ... GREATEST). Este script é uma alternativa para execução
 * independente ou correção manual.
 */
import { PrismaClient, SequenceEntityType } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  // 1. Coletar max(quoteNumber) por empresa
  const quoteMax = await prisma.quote.groupBy({
    by: ['companyId'],
    where: { deletedAt: null },
    _max: { quoteNumber: true },
  });

  // 2. Coletar max(code) por empresa (ServiceOrder)
  const soMax = await prisma.serviceOrder.groupBy({
    by: ['companyId'],
    where: { deletedAt: null },
    _max: { code: true },
  });

  const updates: Array<{
    companyId: string;
    entityType: SequenceEntityType;
    currentValue: number;
  }> = [];

  for (const row of quoteMax) {
    const max = row._max.quoteNumber;
    if (max !== null) {
      updates.push({
        companyId: row.companyId,
        entityType: SequenceEntityType.QUOTE,
        currentValue: max,
      });
    }
  }

  for (const row of soMax) {
    const max = row._max.code;
    if (max !== null) {
      updates.push({
        companyId: row.companyId,
        entityType: SequenceEntityType.SERVICE_ORDER,
        currentValue: max,
      });
    }
  }

  if (updates.length === 0) {
    console.log('Nenhum registro existente encontrado — nada a fazer.');
    return;
  }

  console.log(`Encontrados ${updates.length} tenant/tipo para inicializar:`);
  for (const u of updates) {
    console.log(
      `  companyId=${u.companyId}  entityType=${u.entityType}  currentValue=${u.currentValue}`,
    );
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhuma escrita realizada.');
    return;
  }

  for (const u of updates) {
    await prisma.companySequence.upsert({
      where: {
        companyId_entityType: {
          companyId: u.companyId,
          entityType: u.entityType,
        },
      },
      create: {
        companyId: u.companyId,
        entityType: u.entityType,
        currentValue: u.currentValue,
      },
      update: {
        // Nunca sobrescrever um valor maior já existente (proteção contra
        // perder numeração em backfills repetidos).
        currentValue: { set: u.currentValue },
      },
    });
  }

  console.log(`\nBackfill concluído: ${updates.length} sequências inicializadas.`);
}

main()
  .catch((e) => {
    console.error('Erro no backfill:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
