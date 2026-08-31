import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../src/infrastructure/auth/jwt-auth.guard';

const TEST_USER: AuthenticatedUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  username: 'e2e-runner',
  roles: ['pub-user'],
  scopes: ['pub:read', 'pub:write'],
  empresaId: '00000000-0000-0000-0000-000000000002',
};

const PROJETO_ID = '33333333-3333-3333-3333-333333333333';

/**
 * End-to-end contract of the PUB (Publicação) HTTP surface (api-contract.md §4).
 *
 * SKIPPED from P2 onward: PubController's use cases (PUB-003..006) depend on
 * outbound ports (repository, IMP/COMP/PROJ reads, epubcheck, file storage)
 * that have no provider bound yet — the real Prisma adapter lands in P3
 * (PUB-007/008), the cross-context stub adapters in P4 (PUB-012). Until
 * then Nest cannot instantiate PubModule (`UnknownDependenciesException`),
 * so `moduleRef.compile()` below throws for every test in this file. The
 * use cases are covered by unit tests with Jest-mocked ports instead
 * (src/modules/pub/use-cases/*.spec.ts). Re-enable once P4 lands.
 */
describe.skip('Pub (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          context.switchToHttp().getRequest().user = TEST_USER;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a projetoId that is not a UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pub/projetos/not-a-uuid/publicacoes')
      .expect(400);
  });

  it('triggers an export and returns 202 with a Location header', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`)
      .expect(202);

    expect(response.body.projetoId).toBe(PROJETO_ID);
    expect(response.body.status).toBe('gerando');
    expect(response.body.epubcheckStatus).toBe('pendente');
    expect(response.headers.location).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${response.body.publicacaoId}`,
    );
  });

  it('polls the build status and hints Retry-After while non-terminal', async () => {
    const publicacaoId = '44444444-4444-4444-4444-444444444444';

    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${publicacaoId}/status`)
      .expect(200);

    expect(response.body.publicacaoId).toBe(publicacaoId);
    expect(response.headers['retry-after']).toBe('2');
  });

  it('lists the publication history', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('mints a signed download URL', async () => {
    const publicacaoId = '55555555-5555-5555-5555-555555555555';

    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${publicacaoId}/download`)
      .expect(200);

    expect(response.body.publicacaoId).toBe(publicacaoId);
    expect(response.body.arquivoUrl).toEqual(expect.any(String));
    expect(response.body.expiresAt).toEqual(expect.any(String));
  });

  it('returns publication KPIs', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/stats`)
      .expect(200);

    expect(response.body).toMatchObject({
      projetoId: PROJETO_ID,
      total: 0,
      emAndamento: 0,
    });
  });
});
