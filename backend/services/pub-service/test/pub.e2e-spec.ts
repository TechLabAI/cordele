import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../src/infrastructure/auth/jwt-auth.guard';
import { PrismaService } from '../src/infrastructure/persistence/prisma.service';

const TEST_USER: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  username: 'e2e-runner',
  roles: ['pub-user'],
  scopes: ['pub:read', 'pub:write'],
  empresaId: '00000000-0000-0000-0000-000000000002',
};

/**
 * Project used by the trigger, history, and stats tests. Must exist in
 * `projeto_editorial` or the FK `fk_publicacao_projeto` will reject the
 * INSERT inside `GeneratePublicationUseCase`.
 */
const PROJETO_ID = '33333333-3333-3333-3333-333333333333';

/**
 * Separate seed project used only by the status-poll and download-url
 * fixture rows. Keeping it distinct from PROJETO_ID avoids the
 * `uq_publicacao_projeto_inflight` conflict: the STATUS_POLL_ID row has
 * status `gerando`, which would be returned by `findInFlight(PROJETO_ID)`
 * and make the trigger test return 200 (idempotent) instead of 202 (new).
 */
const SEED_PROJETO_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/** Fixture: in-flight publication for the status-poll test. */
const STATUS_POLL_ID = '44444444-4444-4444-4444-444444444444';

/** Fixture: completed (publicado/valido) publication for the download-url test. */
const DOWNLOAD_URL_ID = '55555555-5555-5555-5555-555555555555';

/** Placeholder editora used only by the seed rows; never validated beyond application layer. */
const TEST_EDITORA_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

/**
 * Structurally-valid (unsigned) JWT consumed by EmpresaContextMiddleware.
 *
 * The middleware decodes only the base64url payload — no signature check —
 * to extract `sub` / `empresa_id` before populating AsyncLocalStorage.
 * Cryptographic verification is skipped because JwtAuthGuard is mocked via
 * jest.spyOn (see beforeAll). The three-dot JWT shape is required so the
 * `parts.length === 3` guard does not short-circuit to next().
 */
const FAKE_JWT_PAYLOAD = Buffer.from(
  JSON.stringify({ sub: TEST_USER.userId, empresa_id: TEST_USER.empresaId }),
).toString('base64url');
const FAKE_JWT = `eyJhbGciOiJIUzI1NiJ9.${FAKE_JWT_PAYLOAD}.fake-signature-not-verified`;
const AUTH_HEADER = `Bearer ${FAKE_JWT}`;

/**
 * End-to-end contract of the PUB (Publicação) HTTP surface (api-contract.md §4).
 *
 * Auth override strategy
 * ----------------------
 * `JwtAuthGuard` is registered as `APP_GUARD` (global) in `AppModule`, which
 * means `TestingModuleBuilder.overrideGuard(JwtAuthGuard)` does NOT intercept
 * it — NestJS resolves the `APP_GUARD` multi-provider before the override
 * mechanism can substitute the instance created during `compile()`. The
 * reliable idiom is `jest.spyOn` on the prototype BEFORE
 * `Test.createTestingModule(...).compile()`: the spy is installed on the class
 * prototype, so every instance (including the one wired by the DI container as
 * APP_GUARD) inherits it automatically.
 *
 * EmpresaContext strategy
 * -----------------------
 * `EmpresaContextMiddleware` (Middleware → Guard → Handler lifecycle) decodes
 * the Authorization bearer payload to populate `AsyncLocalStorage` BEFORE the
 * guard runs. Without a valid-looking JWT in the header the middleware skips
 * `empresaContextService.run()`, leaving the ALS store empty — which causes
 * `empresaContextService.require()` to throw inside any repository. FAKE_JWT
 * above carries the correct sub / empresa_id claims. All six test requests
 * carry `Authorization: Bearer <FAKE_JWT>`.
 *
 * Test ordering
 * -------------
 * `returns publication KPIs` must run BEFORE `triggers an export` because the
 * stats test expects `total: 0` for PROJETO_ID, which only holds before the
 * trigger test inserts the first Publicacao row.
 *
 * Fixture projects
 * ----------------
 * Two `projeto_editorial` rows are inserted in `beforeAll`:
 *   • PROJETO_ID   — used by trigger / history / stats tests.
 *   • SEED_PROJETO_ID — owns the STATUS_POLL_ID and DOWNLOAD_URL_ID fixture
 *     rows, isolated to avoid the `uq_publicacao_projeto_inflight` conflict
 *     (a seeded `gerando` row under PROJETO_ID would cause the trigger test
 *     to return 200 instead of 202).
 */
describe('Pub (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Install the spy BEFORE compile() so the guard instance created inside
    // the DI container during module initialization already uses the mock.
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(
      (ctx: ExecutionContext) => {
        ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user = TEST_USER;
        return Promise.resolve(true);
      },
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    // Seed fixture data. ON CONFLICT DO NOTHING makes reruns idempotent.
    // Raw SQL is necessary because `projeto_editorial` belongs to proj-service
    // and has no Prisma model in pub-service.
    prisma = moduleRef.get(PrismaService);

    // projeto_editorial rows — satisfy the FK fk_publicacao_projeto.
    await prisma.$executeRawUnsafe(`
      INSERT INTO projeto_editorial (id, editora_id, nome, status)
      VALUES
        ('${PROJETO_ID}',      '${TEST_EDITORA_ID}', 'E2E Test Project', 'publicado'),
        ('${SEED_PROJETO_ID}', '${TEST_EDITORA_ID}', 'E2E Seed Project', 'publicado')
      ON CONFLICT (id) DO NOTHING
    `);

    // Fixture for "polls the build status" — non-terminal state so Retry-After is set.
    await prisma.$executeRawUnsafe(`
      INSERT INTO publicacao (id, projeto_id, status, epubcheck_status, sequencia)
      VALUES ('${STATUS_POLL_ID}', '${SEED_PROJETO_ID}', 'gerando', 'pendente', 1)
      ON CONFLICT (id) DO NOTHING
    `);

    // Fixture for "mints a signed download URL" — publicado/valido with artefato_ref
    // (chk_publicacao_artefato: artefato_ref IS NOT NULL iff status = 'publicado').
    await prisma.$executeRawUnsafe(`
      INSERT INTO publicacao (id, projeto_id, status, epubcheck_status, sequencia, artefato_ref)
      VALUES ('${DOWNLOAD_URL_ID}', '${SEED_PROJETO_ID}', 'publicado', 'valido', 2, 'e2e/seed.epub')
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    // Explicit delete ordered to respect FK (validation_message → publicacao → projeto_editorial).
    // The CASCADE on FK handles validation_message automatically.
    if (prisma) {
      await prisma.$executeRawUnsafe(`
        DELETE FROM publicacao
        WHERE projeto_id IN ('${PROJETO_ID}', '${SEED_PROJETO_ID}')
      `);
      await prisma.$executeRawUnsafe(`
        DELETE FROM projeto_editorial
        WHERE id IN ('${PROJETO_ID}', '${SEED_PROJETO_ID}')
      `);
    }
    jest.restoreAllMocks();
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Input validation (no DB reads)
  // -----------------------------------------------------------------------

  it('rejects a projetoId that is not a UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pub/projetos/not-a-uuid/publicacoes')
      .set('Authorization', AUTH_HEADER)
      .expect(400);
  });

  // -----------------------------------------------------------------------
  // Stats — must run BEFORE the trigger test so PROJETO_ID has zero rows.
  // -----------------------------------------------------------------------

  it('returns publication KPIs', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/stats`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(response.body).toMatchObject({
      projetoId: PROJETO_ID,
      total: 0,
      emAndamento: 0,
    });
  });

  // -----------------------------------------------------------------------
  // Trigger — creates the first Publicacao row for PROJETO_ID.
  // -----------------------------------------------------------------------

  it('triggers an export and returns 202 with a Location header', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`)
      .set('Authorization', AUTH_HEADER)
      .expect(202);

    expect(response.body.projetoId).toBe(PROJETO_ID);
    expect(response.body.status).toBe('gerando');
    expect(response.body.epubcheckStatus).toBe('pendente');
    expect(response.headers.location).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${response.body.publicacaoId}`,
    );
  });

  // -----------------------------------------------------------------------
  // Status poll — reads the seeded STATUS_POLL_ID fixture (SEED_PROJETO_ID),
  // isolated from PROJETO_ID to avoid the in-flight uniqueness conflict.
  // -----------------------------------------------------------------------

  it('polls the build status and hints Retry-After while non-terminal', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${SEED_PROJETO_ID}/publicacoes/${STATUS_POLL_ID}/status`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(response.body.publicacaoId).toBe(STATUS_POLL_ID);
    expect(response.headers['retry-after']).toBe('2');
  });

  // -----------------------------------------------------------------------
  // History — PROJETO_ID now has at least the publication from the trigger test.
  // -----------------------------------------------------------------------

  it('lists the publication history', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Download URL — reads the seeded DOWNLOAD_URL_ID fixture (SEED_PROJETO_ID).
  // -----------------------------------------------------------------------

  it('mints a signed download URL', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${SEED_PROJETO_ID}/publicacoes/${DOWNLOAD_URL_ID}/download`)
      .set('Authorization', AUTH_HEADER)
      .expect(200);

    expect(response.body.publicacaoId).toBe(DOWNLOAD_URL_ID);
    expect(response.body.arquivoUrl).toEqual(expect.any(String));
    expect(response.body.expiresAt).toEqual(expect.any(String));
  });
});
