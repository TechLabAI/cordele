import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { MetadataBatchController } from './metadata-batch.controller';
import { COMP_PROJECT_METADATA_PORT } from './comp.tokens';
import type { MetadadosDto } from '../../domain/ports/project-metadata.port';

/**
 * Unit tests for MetadataBatchController.
 *
 * Route: POST /api/v1/comp/metadata/batch
 * Scope: comp:read
 *
 * Scenarios:
 *  - 200 with valid body + pass guard → returns only existing projects
 *  - 200 with empty projetoIds array → returns []
 *  - 200 with IDs that don't exist in the DB → returns []
 *  - 200 with mixed IDs (some exist, some don't) → returns only found
 *  - 401 when no/invalid token
 *  - 403 when scope missing
 *  - 400 when body is invalid (non-UUID in array)
 */

// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx where y ∈ {8,9,a,b}
const PROJ_ID_1 = '00000000-0000-4000-8000-000000000001';
const PROJ_ID_2 = '00000000-0000-4000-8000-000000000002';
const PROJ_ID_3 = '00000000-0000-4000-8000-000000000003';

const STUB_USER = {
  userId: 'test-user-001',
  username: 'test',
  roles: ['editor'],
  scopes: ['comp:read'],
  empresaId: 'aetos',
};

/** Minimal MetadadosDto fixture for the port mock. */
function makeMetadadosDto(projetoId: string, autor: string | null = 'Eliana Moraes'): MetadadosDto {
  return {
    projetoId,
    titulo: 'Test Title',
    autor: autor ?? '',
    idioma: 'pt',
    isbn: null,
    capaUrl: null,
    materialized: true,
  };
}

async function buildApp(
  guardBehavior: 'pass' | 'reject-401' | 'reject-403',
  portImpl: { metadata: jest.Mock },
): Promise<INestApplication> {
  const mockGuard = {
    canActivate: (ctx: ExecutionContext): boolean => {
      if (guardBehavior === 'reject-401') {
        throw new UnauthorizedException('No valid token');
      }
      if (guardBehavior === 'reject-403') {
        throw new ForbiddenException('Insufficient scope');
      }
      const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
      req['user'] = STUB_USER;
      return true;
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    controllers: [MetadataBatchController],
    providers: [
      { provide: APP_GUARD, useValue: mockGuard },
      { provide: COMP_PROJECT_METADATA_PORT, useValue: portImpl },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  return app;
}

// ============================================================================
// Happy path
// ============================================================================
describe('MetadataBatchController — POST /api/v1/comp/metadata/batch (happy path)', () => {
  let app: INestApplication;
  const metadataMock = jest.fn();

  beforeAll(async () => {
    app = await buildApp('pass', { metadata: metadataMock });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    metadataMock.mockReset();
  });

  it('returns 200 with found projects only', async () => {
    const map = new Map<string, MetadadosDto>();
    map.set(PROJ_ID_1, makeMetadadosDto(PROJ_ID_1, 'Eliana Moraes'));
    map.set(PROJ_ID_2, makeMetadadosDto(PROJ_ID_2, 'João Silva'));
    metadataMock.mockResolvedValueOnce(map);

    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: [PROJ_ID_1, PROJ_ID_2, PROJ_ID_3] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projetoId: PROJ_ID_1, autor: 'Eliana Moraes' }),
        expect.objectContaining({ projetoId: PROJ_ID_2, autor: 'João Silva' }),
      ]),
    );
    // PROJ_ID_3 is not in the map → omitted
    expect(res.body.find((i: { projetoId: string }) => i.projetoId === PROJ_ID_3)).toBeUndefined();
    expect(metadataMock).toHaveBeenCalledWith([PROJ_ID_1, PROJ_ID_2, PROJ_ID_3]);
  });

  it('returns 200 with empty array when projetoIds is empty (no DB call)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // Short-circuit: port must not be called for empty list
    expect(metadataMock).not.toHaveBeenCalled();
  });

  it('returns 200 with empty array when no IDs exist in the DB', async () => {
    metadataMock.mockResolvedValueOnce(new Map());

    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: [PROJ_ID_3] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('includes the entry when autor field is empty string (row exists but autor blank)', async () => {
    // When a row exists but autor was left empty, the domain entity has autor=''.
    // The controller uses `meta.autor ?? null` which does NOT convert '' to null
    // (nullish coalescing only catches null/undefined). The consumer (proj-service)
    // handles '' via its own `item.autor ?? null` on the received string.
    // Semantic: the entry IS included (row exists); autor value is ''.
    const map = new Map<string, MetadadosDto>();
    const dto: MetadadosDto = { ...makeMetadadosDto(PROJ_ID_1), autor: '' };
    map.set(PROJ_ID_1, dto);
    metadataMock.mockResolvedValueOnce(map);

    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: [PROJ_ID_1] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    // Entry is present (row exists); autor is '' (empty but not null/undefined)
    expect(res.body[0]).toMatchObject({ projetoId: PROJ_ID_1, autor: '' });
  });
});

// ============================================================================
// Security: 401 / 403
// ============================================================================
describe('MetadataBatchController — security', () => {
  it('returns 401 when no/invalid token', async () => {
    const app = await buildApp('reject-401', { metadata: jest.fn() });

    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .send({ projetoIds: [PROJ_ID_1] });

    expect(res.status).toBe(401);
    await app.close();
  });

  it('returns 403 when token valid but comp:read scope missing', async () => {
    const app = await buildApp('reject-403', { metadata: jest.fn() });

    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer no-scope-token')
      .send({ projetoIds: [PROJ_ID_1] });

    expect(res.status).toBe(403);
    await app.close();
  });
});

// ============================================================================
// Validation: 400 on bad input
// ============================================================================
describe('MetadataBatchController — input validation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp('pass', { metadata: jest.fn() });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 when projetoIds contains a non-UUID value', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: ['not-a-uuid'] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing projetoIds entirely', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('route is registered and reachable (not 404) with valid body', async () => {
    const metadataMock = jest.fn().mockResolvedValueOnce(new Map());
    const localApp = await buildApp('pass', { metadata: metadataMock });

    const res = await request(localApp.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: [] });

    expect(res.status).not.toBe(404);
    await localApp.close();
  });

  it('accepts exactly 50 IDs and returns 200', async () => {
    const metadataMock = jest.fn().mockResolvedValueOnce(new Map());
    const localApp = await buildApp('pass', { metadata: metadataMock });
    const fiftyIds = Array.from(
      { length: 50 },
      (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    );

    const res = await request(localApp.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: fiftyIds });

    expect(res.status).toBe(200);
    await localApp.close();
  });

  it('rejects 51 IDs with 400 (ArrayMaxSize violation)', async () => {
    const fiftyOneIds = Array.from(
      { length: 51 },
      (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/comp/metadata/batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: fiftyOneIds });

    expect(res.status).toBe(400);
  });
});
