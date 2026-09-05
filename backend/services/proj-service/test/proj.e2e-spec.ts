process.env.JWT_ISSUER_URI ??= 'http://test-issuer/realms/test';
process.env.JWT_AUDIENCE ??= 'proj-service-test';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
// No type declarations published for this package; `passport.use()` below
// only needs its untyped runtime API (see the comment at the call site).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const passport = require('passport');

import { AppModule } from '../src/app.module';
import { type AuthenticatedUser } from '../src/infrastructure/auth/jwt-auth.guard';

const TEST_USER: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  username: 'e2e-runner',
  roles: ['proj-user'],
  // proj:delete required for DELETE /projetos/:id (@RequiredScopes enforced by JwtAuthGuard).
  // Omitting it causes the guard to return 403 before the repository is reached.
  scopes: ['proj:read', 'proj:write', 'proj:delete'],
  // Must resolve to a real tenant schema (emp_aetos) — TenantPrismaFactory
  // opens a PrismaClient per schema, so an arbitrary/unregistered empresaId
  // (e.g. a random UUID) would point at a schema that does not exist.
  empresaId: 'aetos',
};

/**
 * End-to-end contract of the PROJ (ProjetoEditorial) HTTP surface, mounted
 * under `/api/v1/proj/projetos` (proj.controller.ts §4). Exercises routing,
 * DTO validation and real persistence — token verification has its own unit
 * test (jwt-auth.guard.spec.ts).
 */
describe('Proj (e2e)', () => {
  let app: INestApplication;
  let createdId: string;

  beforeAll(async () => {
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

    // `TestingModule.overrideGuard()` does NOT work for a guard registered via
    // `{ provide: APP_GUARD, useClass: ... }` — confirmed with a minimal repro
    // outside this codebase: the override's canActivate is never invoked, the
    // real JwtAuthGuard/Passport pipeline always runs, and every request 401s.
    // This is a known NestJS testing limitation, not specific to JwtAuthGuard.
    // Workaround: replace the strategy Passport itself dispatches to. Strategy
    // registration is a side effect of `@nestjs/passport`'s mixin constructor
    // (`passport.use(name, this)`), entirely decoupled from Nest's DI — so
    // re-registering under the same name here overwrites the real JwtStrategy
    // for the lifetime of this test's `passport` module-singleton, regardless
    // of which framework layer looks it up.
    passport.use('jwt', {
      name: 'jwt',
      authenticate(this: { success: (user: AuthenticatedUser) => void }) {
        this.success(TEST_USER);
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a payload that violates the DTO contract', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/proj/projetos')
      .send({ nome: '', unexpected: true })
      .expect(400);
  });

  it('creates an editorial project in status rascunho', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/proj/projetos')
      .send({ nome: 'e2e projeto', descricao: 'created by the e2e suite' })
      .expect(201);

    expect(response.body).toMatchObject({ nome: 'e2e projeto', status: 'rascunho' });
    expect(response.body.id).toBeDefined();
    createdId = response.body.id;
  });

  it('reads the project detail back', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/proj/projetos/${createdId}`)
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(createdId));
  });

  it('lists projects for the empresa (paginated envelope)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/proj/projetos')
      .expect(200);

    // Response is now an envelope { items: ProjetoCard[], nextCursor: string | null }
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body).toHaveProperty('nextCursor');
    expect(response.body.items.some((card: { id: string }) => card.id === createdId)).toBe(true);
  });

  it('lists an empty publication history for a freshly created project', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/proj/projetos/${createdId}/publicacoes`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('returns 404 for a project id that does not exist', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/proj/projetos/00000000-0000-0000-0000-000000000099')
      .expect(404);
  });

  // ---------------------------------------------------------------------------
  // Reopen endpoint (§4.7 / PROJ-005)
  // ---------------------------------------------------------------------------

  it('POST /projetos/:id/reopen returns 200 and transitions publicado → em_composicao', async () => {
    const { body: created } = await request(app.getHttpServer())
      .post('/api/v1/proj/projetos')
      .send({ nome: 'e2e reopen from publicado', descricao: 'reopen scenario' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/proj/projetos/${created.id}/advance-status`)
      .send({ targetStatus: 'em_composicao' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/proj/projetos/${created.id}/advance-status`)
      .send({ targetStatus: 'publicado' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/proj/projetos/${created.id}/reopen`)
      .expect(200);

    expect(response.body.status).toBe('em_composicao');
    expect(response.body.id).toBe(created.id);
  });

  it('POST /projetos/:id/reopen is idempotent when project is already em_composicao', async () => {
    const { body: created } = await request(app.getHttpServer())
      .post('/api/v1/proj/projetos')
      .send({ nome: 'e2e reopen idempotent em_composicao' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/proj/projetos/${created.id}/advance-status`)
      .send({ targetStatus: 'em_composicao' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/proj/projetos/${created.id}/reopen`)
      .expect(200);

    expect(response.body.status).toBe('em_composicao');
    expect(response.body.id).toBe(created.id);
  });

  it('POST /projetos/:id/reopen returns 409 for a rascunho project', async () => {
    const { body: created } = await request(app.getHttpServer())
      .post('/api/v1/proj/projetos')
      .send({ nome: 'e2e reopen rascunho conflict' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/proj/projetos/${created.id}/reopen`)
      .expect(409);

    expect(response.body.type).toBe('urn:cordele:proj:illegal-status-transition');
    expect(response.body.from).toBe('rascunho');
  });

  it('deletes the project and then returns 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/proj/projetos/${createdId}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/proj/projetos/${createdId}`)
      .expect(404);
  });

  // ---------------------------------------------------------------------------
  // PROJ-004 concurrency invariant: SELECT FOR UPDATE serialization
  //
  // Two concurrent advance-status requests for the same projetoId MUST serialize
  // at the DB row lock so that at most one produces a real status change.
  //
  // What this test proves:
  //   - Both HTTP calls return 200 (no crash, no 409 from the lock itself)
  //   - Exactly ONE response has changed=true (only one write committed)
  //   - Exactly ONE response has changed=false (idempotent no-op: second caller
  //     re-reads the already-advanced status under the lock)
  //   - The final project status is em_composicao (single transition from rascunho)
  //
  // Limitation: this relies on Promise.all racing two Node event-loop ticks plus
  // two HTTP round-trips. The DB-level concurrency is real, but Node's single-
  // threaded event loop may occasionally serialize the two requests before they
  // reach the DB. The invariant (exactly one changed=true) still holds in that
  // case — it is a logical invariant, not a timing guarantee.
  // ---------------------------------------------------------------------------

  it('PROJ-004: concurrent advance-status for same projetoId — exactly one changed=true', async () => {
    // Create a fresh project in rascunho status.
    const { body: created } = await request(app.getHttpServer())
      .post('/api/v1/proj/projetos')
      .send({ nome: 'e2e concurrent advance', descricao: 'PROJ-004 concurrency test' })
      .expect(201);

    const projetoId = created.id as string;

    // Fire two concurrent advance-status requests targeting the same transition.
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/proj/projetos/${projetoId}/advance-status`)
        .send({ targetStatus: 'em_composicao' }),
      request(app.getHttpServer())
        .post(`/api/v1/proj/projetos/${projetoId}/advance-status`)
        .send({ targetStatus: 'em_composicao' }),
    ]);

    // Both calls must succeed (200) — no crash, no spurious 409.
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const changedFlags = [res1.body.changed as boolean, res2.body.changed as boolean];

    // Exactly one caller must have committed the transition.
    const trueCount = changedFlags.filter(Boolean).length;
    expect(trueCount).toBe(1);

    // The other caller must have observed the already-advanced status (idempotent).
    const falseCount = changedFlags.filter((f) => !f).length;
    expect(falseCount).toBe(1);

    // Final status must be em_composicao (only one transition happened).
    const { body: detail } = await request(app.getHttpServer())
      .get(`/api/v1/proj/projetos/${projetoId}`)
      .expect(200);
    expect(detail.status).toBe('em_composicao');

    // Cleanup
    await request(app.getHttpServer())
      .delete(`/api/v1/proj/projetos/${projetoId}`)
      .expect(204);
  });
});
