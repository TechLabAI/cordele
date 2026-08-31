/**
 * Jest env fixture for integration specs (e.g. prisma-publicacao.repository.spec.ts).
 *
 * Prisma reads DATABASE_URL at datasource init; without it the generated client
 * never binds its model delegates (`this.prisma.publicacao` stays undefined).
 * Defaults to the local dev Postgres (docker/docker-compose.dev.yml) scoped to
 * emp_aetos so `pnpm test` works out of the box; override DATABASE_URL in the
 * environment to point elsewhere.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://cordele:cordele@localhost:5434/cordele_dev?schema=emp_aetos';
}
