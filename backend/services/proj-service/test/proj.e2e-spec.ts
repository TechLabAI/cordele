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
  scopes: ['proj:read', 'proj:write'],
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

  it('lists projects for the empresa', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/proj/projetos')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.some((card: { id: string }) => card.id === createdId)).toBe(true);
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

  it('deletes the project and then returns 404', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/proj/projetos/${createdId}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/proj/projetos/${createdId}`)
      .expect(404);
  });
});
