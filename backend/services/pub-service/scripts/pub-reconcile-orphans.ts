/**
 * pub-reconcile-orphans.ts — Script de reconciliação de builds órfãos (PUB-020).
 *
 * Identifica publicações presas em status não-terminal (`gerando`/`validando`)
 * por mais de `--timeout-minutes` minutos e, opcionalmente, as marca como
 * `com_erros` para liberar o índice parcial `uq_publicacao_projeto_inflight`.
 *
 * USO:
 *   DATABASE_URL="postgresql://..." \
 *     npx tsx scripts/pub-reconcile-orphans.ts \
 *     [--dry-run] [--schema <schema>] [--timeout-minutes <N>]
 *
 * FLAGS:
 *   --dry-run           Imprime a lista de órfãos sem modificar nenhuma linha.
 *   --schema <schema>   Schema Postgres a usar via search_path (default: emp_aetos).
 *   --timeout-minutes N Threshold em minutos para considerar um build órfão (default: 60).
 *
 * NOTA DE SEGURANÇA:
 *   Este script está em scripts/ (fora de src/) e fica explicitamente fora da
 *   fronteira do eslint-plugin-boundaries. Não deve ser importado pela aplicação.
 *
 * MULTI-EMPRESA:
 *   O script não passa pelo EmpresaContextService. O isolamento de schema é feito
 *   explicitamente via SET search_path = <schema> antes das queries Prisma.
 */

import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Arg parsing (process.argv — sem dependência de minimist)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  dryRun: boolean;
  schema: string;
  timeoutMinutes: number;
} {
  const args = argv.slice(2);
  let dryRun = false;
  let schema = 'emp_aetos';
  let timeoutMinutes = 60;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--schema' && args[i + 1]) {
      schema = args[++i];
    } else if (args[i] === '--timeout-minutes' && args[i + 1]) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error(`[pub-reconcile-orphans] ERROR: --timeout-minutes must be a positive integer (got: ${args[i]})`);
        process.exit(1);
      }
      timeoutMinutes = parsed;
    }
  }

  return { dryRun, schema, timeoutMinutes };
}

// ---------------------------------------------------------------------------
// Saída tabulada
// ---------------------------------------------------------------------------

interface OrphanRow {
  id: string;
  projetoId: string;
  status: string;
  iniciadaEm: Date;
}

function printTable(rows: OrphanRow[]): void {
  if (rows.length === 0) {
    console.log('(nenhum órfão encontrado)');
    return;
  }

  const header = ['publicacaoId', 'projetoId', 'status', 'iniciadaEm'];
  const pad = (s: string, n: number) => s.padEnd(n);

  const colWidths = [36, 36, 12, 30];
  const separator = colWidths.map((w) => '-'.repeat(w)).join('-+-');

  console.log(header.map((h, i) => pad(h, colWidths[i])).join(' | '));
  console.log(separator);

  for (const row of rows) {
    console.log(
      [
        pad(row.id, colWidths[0]),
        pad(row.projetoId, colWidths[1]),
        pad(row.status, colWidths[2]),
        pad(row.iniciadaEm.toISOString(), colWidths[3]),
      ].join(' | '),
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dryRun, schema, timeoutMinutes } = parseArgs(process.argv);

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('[pub-reconcile-orphans] ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log(`[pub-reconcile-orphans] Starting reconciliation`);
  console.log(`  schema          : ${schema}`);
  console.log(`  timeout-minutes : ${timeoutMinutes}`);
  console.log(`  dry-run         : ${dryRun}`);
  console.log('');

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    // Definir search_path para o schema do tenant antes de qualquer query.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).$executeRawUnsafe(`SET search_path = ${schema}`);

    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);

    // Buscar publicações órfãs (status não-terminal e iniciadaEm antes do cutoff).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orphans = await (prisma as any).publicacao.findMany({
      where: {
        status: { in: ['gerando', 'validando'] },
        iniciadaEm: { lt: cutoff },
      },
      orderBy: { iniciadaEm: 'asc' },
      select: {
        id: true,
        projetoId: true,
        status: true,
        iniciadaEm: true,
      },
    }) as OrphanRow[];

    console.log(`Publicações órfãs encontradas: ${orphans.length}`);
    console.log('');
    printTable(orphans);
    console.log('');

    if (orphans.length === 0) {
      console.log('[pub-reconcile-orphans] Nenhuma ação necessária.');
      return;
    }

    if (dryRun) {
      console.log('[pub-reconcile-orphans] Modo dry-run ativo — nenhuma linha foi alterada.');
      console.log('  Para aplicar a correção, execute sem --dry-run.');
      return;
    }

    // Atualizar para status com_erros, liberando o índice parcial.
    const orphanIds = orphans.map((o) => o.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (prisma as any).publicacao.updateMany({
      where: {
        id: { in: orphanIds },
        status: { in: ['gerando', 'validando'] },
      },
      data: {
        status: 'com_erros',
        resumoErro: 'Reconciled: process crash',
      },
    }) as { count: number };

    console.log(`[pub-reconcile-orphans] Reconciliação concluída.`);
    console.log(`  Linhas atualizadas: ${updateResult.count}`);
    console.log(`  Ação: status → com_erros | resumoErro → 'Reconciled: process crash'`);
    console.log('');
    console.log('  O índice parcial uq_publicacao_projeto_inflight foi liberado.');
    console.log('  Os editores dos projetos afetados podem tentar novo export via UI.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('[pub-reconcile-orphans] FATAL:', err);
  process.exit(1);
});
