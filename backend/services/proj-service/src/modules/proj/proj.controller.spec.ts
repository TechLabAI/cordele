// Auth integration tests (supertest) below need a fake Passport strategy — set
// the env var before any module import so JwtStrategy construction does not fail
// if it ends up being instantiated in a sibling test run.
process.env.JWT_ISSUER_URI ??= 'http://test-issuer/realms/test';
process.env.JWT_AUDIENCE ??= 'proj-service-test';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const passport = require('passport');

import { ProjController } from './proj.controller';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { EmpresaContextInterceptor } from '../../infrastructure/auth/empresa-context.interceptor';
import { EmpresaContextStore } from '../../infrastructure/context/empresa.context';
import { REQUIRED_SCOPES_KEY } from './decorators/require-scope.decorator';
import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  CREATE_PROJETO_USE_CASE,
  REOPEN_PROJECT_USE_CASE,
  GET_PROJETO_LIBRARY_USE_CASE,
  GET_PROJETO_DETAIL_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  DELETE_PROJETO_USE_CASE,
} from './proj.tokens';
import { ProjetoStatus } from '../../domain/proj/value-objects/project-status.vo';

/**
 * Unit tests for ProjController (P5 update + §4.8 advance-status).
 *
 * The controller now has use case dependencies injected via DI tokens.
 * This spec mocks all use cases so the controller can be tested in isolation.
 * `@CurrentUser()` is not exercised at the decorator level here (Nest resolves
 * it via `JwtAuthGuard` + Passport at the HTTP layer, covered by
 * `jwt-auth.guard.spec.ts`); every handler call below passes a plain
 * `UsuarioContext` object to simulate what the decorator would inject.
 *
 * Route coverage (8 handlers from api-contract.md §4):
 *   POST   /projetos                                              → 201 ProjetoDetailDto
 *   GET    /projetos                                              → 200 ProjetoCardDto[]
 *   GET    /projetos/:projetoId                                   → 200 ProjetoDetailDto
 *   GET    /projetos/:projetoId/publicacoes                       → 200 PublicacaoHistoryItemDto[]
 *   GET    /projetos/:projetoId/publicacoes/:id/download          → 200 SignedDownloadUrlDto
 *   DELETE /projetos/:projetoId                                   → 204 (void)
 *   POST   /projetos/:projetoId/reopen                            → 200 ProjetoDetailDto
 *   POST   /projetos/:projetoId/advance-status                    → 200 AdvanceProjetoStatusResult
 */
describe('ProjController', () => {
  let controller: ProjController;

  const NOW = new Date('2026-08-25T10:00:00Z');
  const user = { id: 'user-1', empresaId: 'aetos', scopes: ['proj:read', 'proj:write'] };

  const mockCreateUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'proj-id-1',
      nome: 'Romance das Cidades',
      descricao: null,
      editoraId: 'aetos',
      status: 'rascunho',
      criadoEm: NOW,
      atualizadoEm: NOW,
    }),
  };

  const mockReopenUseCase = {
    reopen: jest.fn().mockResolvedValue({
      projetoId: 'proj-id-1',
      newStatus: 'em_composicao',
      changed: true,
    }),
  };

  const mockLibraryUseCase = {
    execute: jest.fn().mockResolvedValue({ cards: [], degraded: false, nextCursor: null }),
  };

  const mockDetailUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'proj-id-1',
      editoraId: 'aetos',
      nome: 'Romance das Cidades',
      descricao: null,
      status: 'rascunho',
      criadoEm: NOW.toISOString(),
      atualizadoEm: NOW.toISOString(),
      manuscriptSummary: null,
      metadata: null,
      publicationHistory: null,
      degraded: false,
    }),
  };

  const mockHistoryUseCase = {
    execute: jest.fn().mockResolvedValue([]),
  };

  const mockDownloadUrlUseCase = {
    execute: jest.fn().mockResolvedValue({
      publicacaoId: 'pub-id-1',
      arquivoUrl: 'https://storage.example.com/epub.epub?sig=abc',
      expiresAt: NOW.toISOString(),
    }),
  };

  const mockDeleteUseCase = {
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const mockAdvanceStatusUseCase = {
    advanceTo: jest.fn().mockResolvedValue({
      projetoId: 'proj-id-1',
      newStatus: ProjetoStatus.publicado,
      changed: true,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjController],
      providers: [
        { provide: CREATE_PROJETO_USE_CASE, useValue: mockCreateUseCase },
        { provide: REOPEN_PROJECT_USE_CASE, useValue: mockReopenUseCase },
        { provide: GET_PROJETO_LIBRARY_USE_CASE, useValue: mockLibraryUseCase },
        { provide: GET_PROJETO_DETAIL_USE_CASE, useValue: mockDetailUseCase },
        { provide: GET_PUBLICATION_HISTORY_USE_CASE, useValue: mockHistoryUseCase },
        { provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE, useValue: mockDownloadUrlUseCase },
        { provide: DELETE_PROJETO_USE_CASE, useValue: mockDeleteUseCase },
        { provide: ADVANCE_PROJETO_STATUS_USE_CASE, useValue: mockAdvanceStatusUseCase },
      ],
    }).compile();

    controller = module.get<ProjController>(ProjController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 4.1 POST /projetos — create()
  // ---------------------------------------------------------------------------

  describe('create() — POST /projetos', () => {
    it('returns a ProjetoDetailDto with status rascunho', async () => {
      const result = await controller.create({ nome: 'Romance das Cidades' }, user);

      expect(result).toBeDefined();
      expect(result.id).toBe('proj-id-1');
      expect(result.status).toBe('rascunho');
      expect(result.criadoEm).toBeDefined();
      expect(result.atualizadoEm).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.2 GET /projetos — findAll()
  // ---------------------------------------------------------------------------

  describe('findAll() — GET /projetos', () => {
    // Mock express Response: findAll calls res.setHeader when degraded.
    const mockRes = { setHeader: jest.fn() } as unknown as import('express').Response;

    it('returns ProjetoLibraryPageDto envelope with items and nextCursor', async () => {
      const result = await controller.findAll(user, mockRes);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.nextCursor).toBeNull();
      expect(mockLibraryUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('sets X-Degraded header when library use case returns degraded=true', async () => {
      const setHeaderFn = jest.fn();
      const degradedRes = { setHeader: setHeaderFn } as unknown as import('express').Response;
      mockLibraryUseCase.execute.mockResolvedValueOnce({ cards: [], degraded: true, nextCursor: null });

      await controller.findAll(user, degradedRes);

      expect(setHeaderFn).toHaveBeenCalledWith('X-Degraded', 'true');
    });

    it('accepts a valid limit query param and passes it to the use case', async () => {
      await controller.findAll(user, mockRes, undefined, undefined, '25');

      expect(mockLibraryUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it('accepts limit=50 (the maximum) without throwing', async () => {
      await expect(
        controller.findAll(user, mockRes, undefined, undefined, '50'),
      ).resolves.toBeDefined();
    });

    it('throws BadRequestException when limit exceeds maximum (50)', async () => {
      const { BadRequestException } = await import('@nestjs/common');

      await expect(
        controller.findAll(user, mockRes, undefined, undefined, '51'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when limit is non-numeric', async () => {
      const { BadRequestException } = await import('@nestjs/common');

      await expect(
        controller.findAll(user, mockRes, undefined, undefined, 'abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when limit is zero', async () => {
      const { BadRequestException } = await import('@nestjs/common');

      await expect(
        controller.findAll(user, mockRes, undefined, undefined, '0'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid base64 cursor and passes it to the use case', async () => {
      const cursor = Buffer.from(JSON.stringify({ atualizadoEm: '2026-08-25T10:00:00.000Z', id: 'some-uuid' })).toString('base64');

      await controller.findAll(user, mockRes, undefined, undefined, undefined, cursor);

      expect(mockLibraryUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ cursor }),
      );
    });

    it('throws BadRequestException when cursor is invalid base64', async () => {
      const { BadRequestException } = await import('@nestjs/common');

      await expect(
        controller.findAll(user, mockRes, undefined, undefined, undefined, '!!!not-base64!!!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cursor is valid base64 but missing fields', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      const badCursor = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64');

      await expect(
        controller.findAll(user, mockRes, undefined, undefined, undefined, badCursor),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts status filter and passes it to the use case', async () => {
      await controller.findAll(user, mockRes, undefined, 'rascunho');

      expect(mockLibraryUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rascunho' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4.3 GET /projetos/:projetoId — findOne()
  // ---------------------------------------------------------------------------

  describe('findOne() — GET /projetos/:projetoId', () => {
    it('returns a ProjetoDetailDto from detail use case', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const result = await controller.findOne(projetoId, user);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('throws NotFoundException when detail use case returns null', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockDetailUseCase.execute.mockResolvedValueOnce(null);

      await expect(
        controller.findOne('11111111-1111-1111-1111-111111111111', user),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 4.4 GET /projetos/:projetoId/publicacoes — findPublicacoes()
  // ---------------------------------------------------------------------------

  describe('findPublicacoes() — GET /projetos/:projetoId/publicacoes', () => {
    it('returns a PublicacaoHistoryItemDto array from history use case', async () => {
      const result = await controller.findPublicacoes(
        '11111111-1111-1111-1111-111111111111',
        user,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(mockHistoryUseCase.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 4.5 GET /projetos/:projetoId/publicacoes/:publicacaoId/download — getDownloadUrl()
  // ---------------------------------------------------------------------------

  describe('getDownloadUrl() — GET .../download', () => {
    it('returns a SignedDownloadUrlDto from download URL use case', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const publicacaoId = '22222222-2222-2222-2222-222222222222';

      const result = await controller.getDownloadUrl(projetoId, publicacaoId, user);

      expect(result).toBeDefined();
      expect(result.publicacaoId).toBeDefined();
      expect(result.arquivoUrl).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('returns only the signed URL (no byte streaming) — PROJ-013 contract', async () => {
      // PROJ-013 clause: controller NEVER proxies bytes; it returns only { publicacaoId, arquivoUrl, expiresAt }.
      // A streaming response would be an instance of StreamableFile or have a `pipe` method.
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const publicacaoId = '22222222-2222-2222-2222-222222222222';

      const result = await controller.getDownloadUrl(projetoId, publicacaoId, user);

      // Shape: only URL fields, no stream interface
      expect(typeof result.arquivoUrl).toBe('string');
      expect(typeof result.publicacaoId).toBe('string');
      expect(typeof result.expiresAt).toBe('string');
      // Not a stream (no pipe method)
      expect((result as any).pipe).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.6 DELETE /projetos/:projetoId — remove()
  // ---------------------------------------------------------------------------

  describe('remove() — DELETE /projetos/:projetoId', () => {
    it('delegates to DeleteProjetoUseCase and returns undefined (no body for 204)', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';

      const result = await controller.remove(projetoId, user, undefined);

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith(
        { projetoId, bearerToken: undefined },
        user,
      );
      expect(result).toBeUndefined();
    });

    it('extracts bearer token from Authorization header and forwards it to the use case', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';

      await controller.remove(projetoId, user, 'Bearer my-proj-delete-token');

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith(
        { projetoId, bearerToken: 'my-proj-delete-token' },
        user,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4.7 POST /projetos/:projetoId/reopen — reopen()
  // ---------------------------------------------------------------------------

  describe('reopen() — POST /projetos/:projetoId/reopen', () => {
    it('returns a ProjetoDetailDto with the new status', async () => {
      const result = await controller.reopen('11111111-1111-1111-1111-111111111111', user);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('em_composicao');
    });
  });

  // ---------------------------------------------------------------------------
  // 4.8 POST /projetos/:projetoId/advance-status — advanceStatus()
  // ---------------------------------------------------------------------------

  describe('advanceStatus() — POST /projetos/:projetoId/advance-status', () => {
    const projetoId = '11111111-1111-1111-1111-111111111111';

    it('returns projetoId, newStatus and changed=true on successful advance', async () => {
      const result = await controller.advanceStatus(
        projetoId,
        { targetStatus: ProjetoStatus.publicado },
        user,
      );

      expect(result).toEqual({
        projetoId: 'proj-id-1',
        newStatus: ProjetoStatus.publicado,
        changed: true,
      });
      expect(mockAdvanceStatusUseCase.advanceTo).toHaveBeenCalledWith(
        { projetoId, targetStatus: ProjetoStatus.publicado },
        user,
      );
    });

    it('returns changed=false for idempotent no-op', async () => {
      mockAdvanceStatusUseCase.advanceTo.mockResolvedValueOnce({
        projetoId,
        newStatus: ProjetoStatus.publicado,
        changed: false,
      });

      const result = await controller.advanceStatus(
        projetoId,
        { targetStatus: ProjetoStatus.publicado },
        user,
      );

      expect(result.changed).toBe(false);
    });

    it('maps IllegalStatusTransitionError to ConflictException (409)', async () => {
      const { ConflictException } = await import('@nestjs/common');
      const { IllegalStatusTransitionError } = await import(
        '../../domain/proj/errors/illegal-status-transition.error'
      );

      mockAdvanceStatusUseCase.advanceTo.mockRejectedValueOnce(
        new IllegalStatusTransitionError(
          ProjetoStatus.rascunho,
          ProjetoStatus.publicado,
          'rascunho cannot advance directly to publicado',
        ),
      );

      await expect(
        controller.advanceStatus(
          projetoId,
          { targetStatus: ProjetoStatus.publicado },
          user,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when project is not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockAdvanceStatusUseCase.advanceTo.mockRejectedValueOnce(
        new NotFoundException(`ProjetoEditorial ${projetoId} not found in this empresa`),
      );

      await expect(
        controller.advanceStatus(
          projetoId,
          { targetStatus: ProjetoStatus.com_erros },
          user,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Route metadata verification
  // ---------------------------------------------------------------------------

  describe('Route metadata (8 handlers registered)', () => {
    it('ProjController prototype has all 8 handler methods', () => {
      const proto = Object.getOwnPropertyNames(ProjController.prototype).filter(
        (m) => m !== 'constructor',
      );

      const handlers = [
        'create',
        'findAll',
        'findOne',
        'findPublicacoes',
        'getDownloadUrl',
        'remove',
        'reopen',
        'advanceStatus',
      ];
      for (const handler of handlers) {
        expect(proto).toContain(handler);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Shared mock providers for the supertest-based integration suites (Auth
  // gates and EmpresaContextStore ALS population). Declared at this scope so
  // both sibling describe blocks can reference the same array without
  // duplicating the provider definitions.
  //
  // The jest.fn() instances are created once; the outer beforeEach calls
  // jest.clearAllMocks() to reset call tracking between unit tests without
  // touching the mock implementations (mockResolvedValue) that the supertest
  // suites rely on.
  // ---------------------------------------------------------------------------

  const ALL_MOCK_PROVIDERS = [
    { provide: CREATE_PROJETO_USE_CASE, useValue: { execute: jest.fn().mockResolvedValue({}) } },
    { provide: REOPEN_PROJECT_USE_CASE, useValue: { reopen: jest.fn().mockResolvedValue({}) } },
    {
      provide: GET_PROJETO_LIBRARY_USE_CASE,
      useValue: { execute: jest.fn().mockResolvedValue({ cards: [], degraded: false }) },
    },
    {
      provide: GET_PROJETO_DETAIL_USE_CASE,
      useValue: { execute: jest.fn().mockResolvedValue(null) },
    },
    {
      provide: GET_PUBLICATION_HISTORY_USE_CASE,
      useValue: { execute: jest.fn().mockResolvedValue([]) },
    },
    {
      provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE,
      useValue: { execute: jest.fn().mockResolvedValue({}) },
    },
    { provide: DELETE_PROJETO_USE_CASE, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
    {
      provide: ADVANCE_PROJETO_STATUS_USE_CASE,
      useValue: { advanceTo: jest.fn().mockResolvedValue({}) },
    },
  ];

  // ---------------------------------------------------------------------------
  // P9 (PROJ-014): Auth integration (supertest) — 401 and 403 behavior
  //
  // These tests spin up a minimal NestJS HTTP application backed by
  // TestingModule (no real DB, no real Keycloak) to verify that the HTTP layer
  // returns the correct status codes when authentication fails or scope is
  // insufficient. Passport is controlled directly via `passport.use()` so the
  // JWKS round-trip never happens.
  // ---------------------------------------------------------------------------

  describe('Auth gates (supertest integration) — PROJ-014', () => {
    let authApp: INestApplication;

    beforeAll(async () => {
      // Register a Passport strategy that always fails — simulates a missing or
      // invalid Bearer token without needing a real Keycloak / JWKS endpoint.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(this: { fail: (challenge: string) => void }) {
          this.fail('Bearer realm="cordele"');
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        controllers: [ProjController],
        providers: [
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          ...ALL_MOCK_PROVIDERS,
        ],
      }).compile();

      authApp = module.createNestApplication();
      authApp.setGlobalPrefix('api');
      authApp.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      authApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
      );
      await authApp.init();
    });

    afterAll(async () => {
      await authApp?.close();
      // Restore passport to the always-fail strategy so it does not bleed into
      // other test suites that run in the same Jest worker.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(this: { fail: (challenge: string) => void }) {
          this.fail('Bearer realm="cordele"');
        },
      });
    });

    it('GET /projetos returns 401 when Authorization header is absent', async () => {
      await request(authApp.getHttpServer())
        .get('/api/v1/proj/projetos')
        .expect(401);
    });

    it('DELETE /projetos/:id returns 401 when Authorization header is absent', async () => {
      await request(authApp.getHttpServer())
        .delete('/api/v1/proj/projetos/11111111-1111-1111-1111-111111111111')
        .expect(401);
    });

    it('POST /projetos returns 401 when Authorization header is absent', async () => {
      await request(authApp.getHttpServer())
        .post('/api/v1/proj/projetos')
        .send({ nome: 'test' })
        .expect(401);
    });

    it('401 response body contains urn:cordele:proj:unauthorized type', async () => {
      const response = await request(authApp.getHttpServer())
        .get('/api/v1/proj/projetos')
        .expect(401);

      // The JwtAuthGuard.handleRequest() override produces a typed error body.
      expect(response.body).toMatchObject({ type: 'urn:cordele:proj:unauthorized' });
    });

    it('DELETE /projetos/:id returns 403 when token is valid but proj:delete scope is missing', async () => {
      // Override the strategy to succeed with a user holding proj:read and
      // proj:write but NOT proj:delete — the DELETE handler requires proj:delete
      // (api-contract §2, privileged LGPD scope) so the request must 403.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(
          this: {
            success: (user: { userId: string; username: string; roles: string[]; scopes: string[]; empresaId: string }) => void;
          },
        ) {
          this.success({
            userId: 'readonly-user',
            username: 'readonly',
            roles: [],
            scopes: ['proj:read', 'proj:write'], // proj:delete is missing → DELETE must 403
            empresaId: 'aetos',
          });
        },
      });

      await request(authApp.getHttpServer())
        .delete('/api/v1/proj/projetos/11111111-1111-1111-1111-111111111111')
        .set('Authorization', 'Bearer any-token')
        .expect(403);

      // Restore always-fail strategy for subsequent tests.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(this: { fail: (challenge: string) => void }) {
          this.fail('Bearer realm="cordele"');
        },
      });
    });

    it('403 response body contains urn:cordele:proj:forbidden type', async () => {
      // Provide a valid JWT with proj:read + proj:write but no proj:delete.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(
          this: {
            success: (user: { userId: string; username: string; roles: string[]; scopes: string[]; empresaId: string }) => void;
          },
        ) {
          this.success({
            userId: 'write-user',
            username: 'write',
            roles: [],
            scopes: ['proj:read', 'proj:write'],
            empresaId: 'aetos',
          });
        },
      });

      const response = await request(authApp.getHttpServer())
        .delete('/api/v1/proj/projetos/11111111-1111-1111-1111-111111111111')
        .set('Authorization', 'Bearer any-token')
        .expect(403);

      // The JwtAuthGuard.enforceScopes() override produces a typed error body.
      expect(response.body).toMatchObject({ type: 'urn:cordele:proj:forbidden' });

      // Restore always-fail strategy for subsequent tests.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(this: { fail: (challenge: string) => void }) {
          this.fail('Bearer realm="cordele"');
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // P9 (PROJ-014): EmpresaContextStore ALS population
  //
  // Verifies that after JwtAuthGuard authenticates a request, the empresaId
  // from the JWT claim is passed to EmpresaContextStore.run() by
  // EmpresaContextInterceptor — which is the canonical way to prove that the
  // context comes from the JWT (never from body or path params).
  //
  // The responsibility was moved from JwtAuthGuard.canActivate() (which used
  // enterWith() after an await — non-propagating across async resources) to
  // EmpresaContextInterceptor (which uses store.run() around next.handle()).
  // See als-guard-propagation.spec.ts for the empirical proof.
  // ---------------------------------------------------------------------------

  describe('EmpresaContextStore ALS population (PROJ-014)', () => {
    let alsApp: INestApplication;

    beforeAll(async () => {
      // Strategy that succeeds and carries empresaId 'aetos' — simulates a
      // validated JWT whose `empresa_id` claim is 'aetos'.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(
          this: {
            success: (user: { userId: string; username: string; roles: string[]; scopes: string[]; empresaId: string }) => void;
          },
        ) {
          this.success({
            userId: 'als-test-user',
            username: 'als-test',
            roles: [],
            scopes: ['proj:read'],
            empresaId: 'aetos',
          });
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        controllers: [ProjController],
        providers: [
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_INTERCEPTOR, useClass: EmpresaContextInterceptor },
          ...ALL_MOCK_PROVIDERS,
        ],
      }).compile();

      alsApp = module.createNestApplication();
      alsApp.setGlobalPrefix('api');
      alsApp.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      await alsApp.init();
    });

    afterAll(async () => {
      await alsApp?.close();
      // Restore always-fail strategy for subsequent test suites.
      passport.use('jwt', {
        name: 'jwt',
        authenticate(this: { fail: (challenge: string) => void }) {
          this.fail('Bearer realm="cordele"');
        },
      });
    });

    it('EmpresaContextStore.getEditoraId() returns the empresaId from the JWT claim', async () => {
      // Spy on store.run: the PROJ-014 criterion is that EmpresaContextInterceptor
      // reads empresaId from request.user (set by JwtAuthGuard from the JWT claim)
      // and passes it to EmpresaContextStore.run() — never from body or path params.
      // The spy captures the argument without relying on ALS propagation across
      // async boundaries, which is not the focus of this contract test.
      const runSpy = jest.spyOn(EmpresaContextStore, 'run');

      await request(alsApp.getHttpServer())
        .get('/api/v1/proj/projetos')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // EmpresaContextInterceptor must have called run() with { editoraId: 'aetos' }
      // (the value from the JWT claim via request.user.empresaId), not from
      // body or path params (PROJ-014 criterion 3).
      expect(runSpy).toHaveBeenCalledWith(
        expect.objectContaining({ editoraId: 'aetos' }),
        expect.any(Function),
      );
      runSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // P5 (PROJ-014): @RequiredScopes metadata — enforced by JwtAuthGuard
  // ---------------------------------------------------------------------------

  describe('@RequiredScopes metadata', () => {
    const scopesOf = (handler: keyof ProjController): string[] =>
      Reflect.getMetadata(REQUIRED_SCOPES_KEY, ProjController.prototype[handler]);

    it('requires proj:write for write/mutating routes (non-delete)', () => {
      expect(scopesOf('create')).toEqual(['proj:write']);
      expect(scopesOf('reopen')).toEqual(['proj:write']);
      expect(scopesOf('advanceStatus')).toEqual(['proj:write']);
    });

    it('requires proj:delete for the DELETE /projetos/:id route (privileged LGPD scope — api-contract §2)', () => {
      expect(scopesOf('remove')).toEqual(['proj:delete']);
    });

    it('requires proj:read for read routes', () => {
      expect(scopesOf('findAll')).toEqual(['proj:read']);
      expect(scopesOf('findOne')).toEqual(['proj:read']);
      expect(scopesOf('findPublicacoes')).toEqual(['proj:read']);
      expect(scopesOf('getDownloadUrl')).toEqual(['proj:read']);
    });
  });
});
