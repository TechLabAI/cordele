import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { PubController } from './pub.controller';
import {
  GENERATE_PUBLICATION_USE_CASE,
  GET_LATEST_BATCH_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_PUBLICATION_STATS_USE_CASE,
  GET_PUBLICATION_STATUS_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  LIST_VALIDATION_MESSAGES_USE_CASE,
} from './pub.tokens';

/**
 * HTTP-level validation tests for the batch size limit on
 * POST /api/v1/pub/publications/latest-batch (§4.7 api-contract.md).
 *
 * Exactly 50 IDs → 200.
 * 51 IDs          → 400 (ValidationPipe enforces @ArrayMaxSize(50)).
 */

const VALID_UUID = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const makeUuids = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => VALID_UUID(i + 1));

async function buildApp(): Promise<INestApplication> {
  const mockGuard = {
    canActivate: (ctx: ExecutionContext): boolean => {
      const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
      req['user'] = {
        userId: 'test-user',
        username: 'editor',
        roles: ['pub-user'],
        scopes: ['pub:read', 'pub:write'],
        empresaId: 'aetos',
      };
      return true;
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    controllers: [PubController],
    providers: [
      { provide: APP_GUARD, useValue: mockGuard },
      { provide: GENERATE_PUBLICATION_USE_CASE, useValue: { execute: jest.fn() } },
      { provide: GET_PUBLICATION_STATUS_USE_CASE, useValue: { execute: jest.fn() } },
      { provide: GET_PUBLICATION_HISTORY_USE_CASE, useValue: { execute: jest.fn() } },
      { provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE, useValue: { execute: jest.fn() } },
      { provide: GET_PUBLICATION_STATS_USE_CASE, useValue: { execute: jest.fn() } },
      { provide: LIST_VALIDATION_MESSAGES_USE_CASE, useValue: { execute: jest.fn() } },
      {
        provide: GET_LATEST_BATCH_USE_CASE,
        useValue: { execute: jest.fn().mockResolvedValue([]) },
      },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  return app;
}

describe('POST /api/v1/pub/publications/latest-batch — batch size limit', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts exactly 50 IDs and returns 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pub/publications/latest-batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: makeUuids(50) });

    expect(res.status).toBe(200);
  });

  it('rejects 51 IDs with 400 (ArrayMaxSize violation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pub/publications/latest-batch')
      .set('Authorization', 'Bearer test-token')
      .send({ projetoIds: makeUuids(51) });

    expect(res.status).toBe(400);
  });
});
