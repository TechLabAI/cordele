/**
 * COMP service — End-to-end wiring test.
 *
 * Exercises the 7 HTTP routes of CompController against a NestJS TestingModule
 * with in-memory fake infrastructure. No real PostgreSQL or file storage
 * is required — all infrastructure ports are faked.
 *
 * This test covers routing, DI wiring, guard stub, validation pipe, and
 * response shapes. Cryptographic JWT verification is a unit test of
 * JwtAuthGuard. Business logic BDD coverage is in `pnpm test:bdd`.
 *
 * Issue: COMP-020
 */

// ── Environment vars required by ConfigModule (before any Nest import) ─────
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'comp-service-test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';
process.env['FILE_STORAGE_BASE_DIR'] = '/tmp/cordele-e2e-comp-test';
process.env['COMP_STUB_MANUSCRIPT_FIXTURE_PATH'] = 'test/fixtures/content-tree.json';

import {
  ExecutionContext,
  Global,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { ProblemJsonFilter } from '../src/infrastructure/comp/filters/problem-json.filter';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import type { AuthenticatedUser } from '../src/infrastructure/comp/auth/jwt-auth.guard';
import { REQUIRED_SCOPES_KEY } from '../src/infrastructure/comp/auth/scope.guard';
import { EmpresaContextService } from '../src/infrastructure/auth/empresa-context.service';
import { EmpresaContextMiddleware } from '../src/infrastructure/auth/empresa-context.middleware';
import { CompModule } from '../src/modules/comp/comp.module';
import {
  COMP_METADADOS_REPO,
  COMP_LAYOUT_REPO,
  COMP_FILE_STORAGE_PORT,
  COMP_MANUSCRIPT_CONTENT_PORT,
  COMP_EVENT_EMITTER,
  COMP_METRICS_SERVICE,
} from '../src/modules/comp/comp.tokens';
import { COMP_DATABASE_HEALTH_PORT } from '../src/modules/comp/ports/database-health.port';
import type { MetadadosRepository } from '../src/modules/comp/ports/metadados-repository.port';
import type { ConfiguracaoLayoutRepositoryPort } from '../src/modules/comp/ports/configuracao-layout-repository.port';
import type { FileStoragePort } from '../src/modules/comp/ports/file-storage.port';
import type { ManuscriptContentPort, ContentTreeDto } from '../src/modules/comp/ports/manuscript-content.port';
import type { Metadados as MetadadosEntity } from '../src/domain/comp/metadados.aggregate';
import type { ConfiguracaoLayout as ConfiguracaoLayoutEntity } from '../src/domain/comp/configuracao-layout.aggregate';

// ── Shared test state ─────────────────────────────────────────────────────────

const TEST_EMPRESA = 'test';
const TEST_PROJETO = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

let testUser: AuthenticatedUser = {
  userId: 'user-e2e-001',
  username: 'e2e-editor',
  roles: [],
  scopes: ['comp:read', 'comp:write'],
  empresaId: TEST_EMPRESA,
};

// ── In-memory fake adapters ────────────────────────────────────────────────────

class E2EFakeMetadadosRepository implements MetadadosRepository {
  private readonly store = new Map<string, MetadadosEntity>();

  async findByProjetoId(projetoId: string): Promise<MetadadosEntity | null> {
    return this.store.get(projetoId) ?? null;
  }

  async upsert(entity: MetadadosEntity): Promise<MetadadosEntity> {
    // Preserve prototype (class methods) while updating id + atualizadoEm.
    const persisted = Object.assign(
      Object.create(Object.getPrototypeOf(entity) as object) as MetadadosEntity,
      entity,
      { id: entity.id || `fake-id-${Date.now()}`, atualizadoEm: new Date() },
    ) as MetadadosEntity;
    this.store.set(entity.projetoId, persisted);
    return persisted;
  }

  async findManyByProjetoIds(ids: string[]): Promise<MetadadosEntity[]> {
    return ids.flatMap((id) => {
      const entity = this.store.get(id);
      return entity ? [entity] : [];
    });
  }

  async delete(projetoId: string): Promise<void> {
    this.store.delete(projetoId);
  }

  clear(): void { this.store.clear(); }
}

class E2EFakeConfiguracaoLayoutRepository implements ConfiguracaoLayoutRepositoryPort {
  private readonly store = new Map<string, ConfiguracaoLayoutEntity>();

  async findByProjetoId(projetoId: string): Promise<ConfiguracaoLayoutEntity | null> {
    return this.store.get(projetoId) ?? null;
  }

  async upsert(entity: ConfiguracaoLayoutEntity): Promise<ConfiguracaoLayoutEntity> {
    const persisted = Object.assign(
      Object.create(Object.getPrototypeOf(entity) as object) as ConfiguracaoLayoutEntity,
      entity,
      { id: entity.id || `fake-layout-id-${Date.now()}`, atualizadoEm: new Date() },
    ) as ConfiguracaoLayoutEntity;
    this.store.set(entity.projetoId, persisted);
    return persisted;
  }

  clear(): void { this.store.clear(); }
}

class E2EFakeFileStorageAdapter implements FileStoragePort {
  private readonly _fileMap = new Map<string, Buffer>();

  async store(key: string, buffer: Buffer): Promise<string> {
    this._fileMap.set(key, buffer);
    return `fake-storage:///${key}`;
  }

  async delete(key: string): Promise<void> {
    const resolved = key.startsWith('fake-storage:///') ? key.slice('fake-storage:///'.length) : key;
    this._fileMap.delete(resolved);
  }

  clear(): void { this._fileMap.clear(); }
}

class E2EManuscriptStub implements ManuscriptContentPort {
  async getContentTree(projetoId: string): Promise<ContentTreeDto | null> {
    return {
      manuscritoId: projetoId,
      estrutura: [
        { nodeId: 'node-001', tipo: 'capitulo' },
        { nodeId: 'node-002', tipo: 'paragrafo' },
      ],
    };
  }

  async nodeExists(_projetoId: string, referenciaNo: string): Promise<boolean> {
    return ['node-001', 'node-002'].includes(referenciaNo);
  }
}

// ── FakeInfraModule ───────────────────────────────────────────────────────────

let fakeMetadadosRepo: E2EFakeMetadadosRepository;
let fakeLayoutRepo: E2EFakeConfiguracaoLayoutRepository;

@Global()
@Module({
  providers: [
    EmpresaContextService,
    EmpresaContextMiddleware,
    {
      provide: COMP_METADADOS_REPO,
      useFactory: () => {
        fakeMetadadosRepo = new E2EFakeMetadadosRepository();
        return fakeMetadadosRepo;
      },
    },
    {
      provide: COMP_LAYOUT_REPO,
      useFactory: () => {
        fakeLayoutRepo = new E2EFakeConfiguracaoLayoutRepository();
        return fakeLayoutRepo;
      },
    },
    { provide: COMP_FILE_STORAGE_PORT, useClass: E2EFakeFileStorageAdapter },
    { provide: COMP_MANUSCRIPT_CONTENT_PORT, useClass: E2EManuscriptStub },
    // COMP-019: stub DB health port so CompHealthService resolves in tests.
    { provide: COMP_DATABASE_HEALTH_PORT, useValue: { pingDatabase: async () => true } },
    // COMP-007: no-op event emitter stub — e2e tests do not assert on domain events.
    { provide: COMP_EVENT_EMITTER, useValue: { emit: () => undefined } },
    // COMP-019: no-op metrics stub — e2e tests do not assert on counters.
    { provide: COMP_METRICS_SERVICE, useValue: { increment: () => undefined } },
  ],
  exports: [
    EmpresaContextService,
    EmpresaContextMiddleware,
    COMP_METADADOS_REPO,
    COMP_LAYOUT_REPO,
    COMP_FILE_STORAGE_PORT,
    COMP_MANUSCRIPT_CONTENT_PORT,
    COMP_DATABASE_HEALTH_PORT,
    COMP_EVENT_EMITTER,
    COMP_METRICS_SERVICE,
  ],
})
class E2EFakeInfraModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(EmpresaContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

// ── Test guard ────────────────────────────────────────────────────────────────

@Injectable()
class E2ETestGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthenticatedUser }>();
    if (!req.headers['authorization']) {
      throw new UnauthorizedException('No authorization token');
    }
    req.user = testUser;

    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length) {
      const hasScope = required.some((s) => testUser.scopes.includes(s));
      if (!hasScope) {
        throw new UnauthorizedException('Insufficient scope');
      }
    }
    return true;
  }
}

// ── JWT helper ────────────────────────────────────────────────────────────────

function buildJwt(empresaId = TEST_EMPRESA): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user-e2e-001', empresa_id: empresaId })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

function compUrl(projetoId: string, sub: string): string {
  return `/api/v1/comp/projetos/${projetoId}/${sub}`;
}

function defaultLayoutBody(): Record<string, unknown> {
  return {
    fonteCorpoFamilia: 'serif',
    fonteCorpoTamanho: 12,
    espacamentoLinha: 1.5,
    margemLateral: 20,
    h1Tamanho: 28,
    h2Tamanho: 22,
    h3Tamanho: 18,
    overrides: [],
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Comp (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        E2EFakeInfraModule,
        CompModule,
      ],
      providers: [
        // Register E2ETestGuard as global APP_GUARD
        { provide: APP_GUARD, useClass: E2ETestGuard },
        // Mirror production AppModule: ProblemJsonFilter registered as APP_FILTER
        // so DomainException (e.g. 422 for tipo=em-branco) is mapped correctly
        // and does not fall through to the default 500 handler (COMP-018).
        { provide: APP_FILTER, useClass: ProblemJsonFilter },
      ],
    })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    testUser = {
      userId: 'user-e2e-001',
      username: 'e2e-editor',
      roles: [],
      scopes: ['comp:read', 'comp:write'],
      empresaId: TEST_EMPRESA,
    };
    fakeMetadadosRepo?.clear();
    fakeLayoutRepo?.clear();
  });

  const authHeader = (): Record<string, string> => ({
    Authorization: `Bearer ${buildJwt()}`,
  });

  // ── GET /metadados ──────────────────────────────────────────────────────────

  it('GET metadados for new project returns 200 with materialized false', async () => {
    const res = await request(app.getHttpServer())
      .get(compUrl(TEST_PROJETO, 'metadados'))
      .set(authHeader())
      .expect(200);

    expect(res.body.materialized).toBe(false);
    expect(res.body.projetoId).toBe(TEST_PROJETO);
  });

  it('GET metadados without token returns 401', async () => {
    await request(app.getHttpServer())
      .get(compUrl(TEST_PROJETO, 'metadados'))
      .expect(401);
  });

  // ── PUT /metadados ──────────────────────────────────────────────────────────

  it('PUT metadados stores data and returns materialized true', async () => {
    const res = await request(app.getHttpServer())
      .put(compUrl(TEST_PROJETO, 'metadados'))
      .set(authHeader())
      .send({ titulo: 'O Sertão', autor: 'Euclides da Cunha', idioma: 'pt' })
      .expect(200);

    expect(res.body.materialized).toBe(true);
    expect(res.body.titulo).toBe('O Sertão');
  });

  it('PUT metadados with invalid idioma returns 400', async () => {
    await request(app.getHttpServer())
      .put(compUrl(TEST_PROJETO, 'metadados'))
      .set(authHeader())
      .send({ titulo: 'T', autor: 'A', idioma: 'xx' })
      .expect(400);
  });

  it('PUT metadados without write scope returns 401', async () => {
    testUser = { ...testUser, scopes: ['comp:read'] };
    await request(app.getHttpServer())
      .put(compUrl(TEST_PROJETO, 'metadados'))
      .set(authHeader())
      .send({ titulo: 'T', autor: 'A', idioma: 'pt' })
      .expect(401);
  });

  // ── POST /capa ──────────────────────────────────────────────────────────────

  it('POST capa uploads cover and returns 201 with capaUrl', async () => {
    const res = await request(app.getHttpServer())
      .post(compUrl(TEST_PROJETO, 'capa'))
      .set(authHeader())
      .attach('file', Buffer.from('fake-image'), { filename: 'capa.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.capaUrl).toBeDefined();
  });

  // ── DELETE /capa ────────────────────────────────────────────────────────────

  it('DELETE capa returns 204 when no cover exists (idempotent)', async () => {
    await request(app.getHttpServer())
      .delete(compUrl(TEST_PROJETO, 'capa'))
      .set(authHeader())
      .expect(204);
  });

  // ── GET /layout ─────────────────────────────────────────────────────────────

  it('GET layout for new project returns 200 with materialized false', async () => {
    const res = await request(app.getHttpServer())
      .get(compUrl(TEST_PROJETO, 'layout'))
      .set(authHeader())
      .expect(200);

    expect(res.body.materialized).toBe(false);
  });

  // ── PUT /layout ─────────────────────────────────────────────────────────────

  it('PUT layout with valid body returns 200 with materialized true', async () => {
    const res = await request(app.getHttpServer())
      .put(compUrl(TEST_PROJETO, 'layout'))
      .set(authHeader())
      .send(defaultLayoutBody())
      .expect(200);

    expect(res.body.materialized).toBe(true);
  });

  it('PUT layout with em-branco override returns 422', async () => {
    const body = { ...defaultLayoutBody(), overrides: [{ referenciaNo: 'node-001', tipo: 'em-branco', ordem: 0 }] };
    const res = await request(app.getHttpServer())
      .put(compUrl(TEST_PROJETO, 'layout'))
      .set(authHeader())
      .send(body)
      .expect(422);

    expect(res.body.title).toBe('EM_BRANCO_NAO_SUPORTADO');
  });

  // ── GET /preview-context ────────────────────────────────────────────────────

  it('GET preview-context returns 200 with projetoId manuscrito layout staleOverrides', async () => {
    const res = await request(app.getHttpServer())
      .get(compUrl(TEST_PROJETO, 'preview-context'))
      .set(authHeader())
      .expect(200);

    expect(res.body.projetoId).toBe(TEST_PROJETO);
    expect(res.body.manuscrito).toBeDefined();
    expect(res.body.layout).toBeDefined();
    expect(Array.isArray(res.body.staleOverrides)).toBe(true);
  });
});
