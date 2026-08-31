import { RequestLoggerMiddleware } from './request-logger.middleware';
import { EmpresaContextService } from '../../auth/empresa-context.service';

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let empresaContextService: jest.Mocked<EmpresaContextService>;

  beforeEach(() => {
    empresaContextService = {
      get: jest.fn(),
      require: jest.fn(),
      run: jest.fn(),
    } as unknown as jest.Mocked<EmpresaContextService>;

    middleware = new RequestLoggerMiddleware(empresaContextService);
  });

  /** Build minimal req/res mocks and return helpers to trigger 'finish'. */
  const buildMocks = (options: {
    correlationId?: string;
    path?: string;
    method?: string;
  } = {}) => {
    const finishCallbacks: Array<() => void> = [];

    const req = {
      correlationId: options.correlationId ?? 'test-correlation-id',
      path: options.path ?? '/api/comp/projetos/proj-uuid-1/metadados',
      method: options.method ?? 'GET',
      headers: {} as Record<string, string>,
    } as unknown as Parameters<typeof middleware.use>[0];

    const res = {
      statusCode: 200,
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') {
          finishCallbacks.push(cb);
        }
      }),
    } as unknown as Parameters<typeof middleware.use>[1];

    const next = jest.fn();

    const triggerFinish = () => {
      finishCallbacks.forEach((cb) => cb());
    };

    return { req, res, next, triggerFinish };
  };

  it('calls next() immediately without waiting for response finish', () => {
    const { req, res, next } = buildMocks();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('registers a finish listener on the response', () => {
    const { req, res, next } = buildMocks();

    middleware.use(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('logs JSON with correlationId, empresa, projetoId on response finish', () => {
    empresaContextService.get.mockReturnValue({
      userId: 'user-1',
      empresaId: 'emp_aetos',
    });

    const logSpy = jest.spyOn(
      (middleware as unknown as { logger: { log: jest.Mock } }).logger,
      'log',
    );

    const { req, res, next, triggerFinish } = buildMocks({
      correlationId: 'cid-abc',
      path: '/api/comp/projetos/proj-uuid-1/metadados',
      method: 'PUT',
    });
    (res as unknown as { statusCode: number }).statusCode = 200;

    middleware.use(req, res, next);
    triggerFinish();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string) as {
      correlationId: string;
      empresa: string;
      projetoId: string;
      method: string;
      statusCode: number;
    };
    expect(logged.correlationId).toBe('cid-abc');
    expect(logged.empresa).toBe('emp_aetos');
    expect(logged.projetoId).toBe('proj-uuid-1');
    expect(logged.method).toBe('PUT');
    expect(logged.statusCode).toBe(200);
  });

  it('falls back to "unknown" for correlationId when absent', () => {
    empresaContextService.get.mockReturnValue(undefined);

    const logSpy = jest.spyOn(
      (middleware as unknown as { logger: { log: jest.Mock } }).logger,
      'log',
    );

    const req = {
      path: '/api/comp/projetos/p1/layout',
      method: 'GET',
      headers: {},
      // correlationId intentionally absent
    } as unknown as Parameters<typeof middleware.use>[0];

    const finishCallbacks: Array<() => void> = [];
    const res = {
      statusCode: 404,
      on: jest.fn((_event: string, cb: () => void) => {
        finishCallbacks.push(cb);
      }),
    } as unknown as Parameters<typeof middleware.use>[1];
    const next = jest.fn();

    middleware.use(req, res, next);
    finishCallbacks.forEach((cb) => cb());

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string) as {
      correlationId: string;
      empresa: string;
    };
    expect(logged.correlationId).toBe('unknown');
    expect(logged.empresa).toBe('unknown');
  });

  it('extracts projetoId from path with UUID-like segment', () => {
    empresaContextService.get.mockReturnValue({
      userId: 'u1',
      empresaId: 'emp_aetos',
    });

    const logSpy = jest.spyOn(
      (middleware as unknown as { logger: { log: jest.Mock } }).logger,
      'log',
    );

    const { req, res, next, triggerFinish } = buildMocks({
      path: '/api/comp/projetos/11111111-2222-3333-4444-555555555555/capa',
    });

    middleware.use(req, res, next);
    triggerFinish();

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string) as {
      projetoId: string;
    };
    expect(logged.projetoId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('returns undefined projetoId for routes without /projetos/ segment', () => {
    empresaContextService.get.mockReturnValue({ userId: 'u1', empresaId: 'emp_aetos' });

    const logSpy = jest.spyOn(
      (middleware as unknown as { logger: { log: jest.Mock } }).logger,
      'log',
    );

    const { req, res, next, triggerFinish } = buildMocks({
      path: '/health',
    });

    middleware.use(req, res, next);
    triggerFinish();

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string) as {
      projetoId: unknown;
    };
    expect(logged.projetoId).toBeUndefined();
  });

  it('includes durationMs >= 0 in the log entry', () => {
    empresaContextService.get.mockReturnValue({ userId: 'u1', empresaId: 'e1' });

    const logSpy = jest.spyOn(
      (middleware as unknown as { logger: { log: jest.Mock } }).logger,
      'log',
    );

    const { req, res, next, triggerFinish } = buildMocks();

    middleware.use(req, res, next);
    triggerFinish();

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string) as {
      durationMs: number;
    };
    expect(typeof logged.durationMs).toBe('number');
    expect(logged.durationMs).toBeGreaterThanOrEqual(0);
  });
});
