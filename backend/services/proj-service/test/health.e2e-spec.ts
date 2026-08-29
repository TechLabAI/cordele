process.env.JWT_ISSUER_URI ??= 'http://test-issuer/realms/test';
process.env.JWT_AUDIENCE ??= 'proj-service-test';

import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * P7 (PROJ-017): health endpoints and cross-cutting observability headers.
 *
 * `/health` and `/health/live` are `@Public()` — no guard override needed.
 * This suite touches the real DB (via AppModule/PersistenceModule) to
 * verify the readiness check reflects actual database reachability.
 */
describe('Health & observability (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/live', method: RequestMethod.ALL },
      ],
    });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports readiness 200 when the database is reachable', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('reports liveness 200 regardless of downstream dependencies', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'ok' }));
  });

  it('echoes a caller-supplied X-Correlation-Id on the response', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .set('X-Correlation-Id', 'health-e2e-corr-id')
      .expect(200)
      .expect('x-correlation-id', 'health-e2e-corr-id');
  });

  it('generates an X-Correlation-Id when the caller omits one', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.headers['x-correlation-id']).toBeTruthy();
  });
});
