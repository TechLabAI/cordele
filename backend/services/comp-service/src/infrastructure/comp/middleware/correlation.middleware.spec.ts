import { CorrelationMiddleware, CORRELATION_ID_HEADER } from './correlation.middleware';

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;

  beforeEach(() => {
    middleware = new CorrelationMiddleware();
  });

  const buildMocks = (incomingCorrelationId?: string) => {
    const req: Record<string, unknown> & {
      headers: Record<string, string>;
      correlationId?: string;
      path: string;
      method: string;
    } = {
      headers: incomingCorrelationId
        ? { [CORRELATION_ID_HEADER]: incomingCorrelationId }
        : {},
      path: '/api/comp/projetos/abc/metadados',
      method: 'GET',
    };

    const setHeaderCalls: Array<[string, string]> = [];
    const res = {
      setHeader: (name: string, value: string): void => {
        setHeaderCalls.push([name, value]);
      },
    };
    const next = jest.fn();
    return { req, res, next, setHeaderCalls };
  };

  it('echoes the incoming X-Correlation-Id header when present', () => {
    const { req, res, next, setHeaderCalls } = buildMocks('existing-id-123');

    middleware.use(
      req as unknown as Parameters<typeof middleware.use>[0],
      res as unknown as Parameters<typeof middleware.use>[1],
      next,
    );

    expect(req.correlationId).toBe('existing-id-123');
    expect(setHeaderCalls).toEqual([[CORRELATION_ID_HEADER, 'existing-id-123']]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID v4 when X-Correlation-Id is absent', () => {
    const { req, res, next, setHeaderCalls } = buildMocks();

    middleware.use(
      req as unknown as Parameters<typeof middleware.use>[0],
      res as unknown as Parameters<typeof middleware.use>[1],
      next,
    );

    expect(req.correlationId).toBeDefined();
    // UUID v4 pattern
    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeaderCalls[0][0]).toBe(CORRELATION_ID_HEADER);
    expect(setHeaderCalls[0][1]).toBe(req.correlationId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() exactly once regardless of header presence', () => {
    const { req, res, next } = buildMocks();

    middleware.use(
      req as unknown as Parameters<typeof middleware.use>[0],
      res as unknown as Parameters<typeof middleware.use>[1],
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets response header to the same value stored in req.correlationId', () => {
    const { req, res, setHeaderCalls } = buildMocks();
    const next = jest.fn();

    middleware.use(
      req as unknown as Parameters<typeof middleware.use>[0],
      res as unknown as Parameters<typeof middleware.use>[1],
      next,
    );

    expect(setHeaderCalls[0][1]).toBe(req.correlationId);
  });

  it('does not overwrite a well-formed incoming correlation id', () => {
    const original = 'well-formed-id-456';
    const { req, res, next } = buildMocks(original);

    middleware.use(
      req as unknown as Parameters<typeof middleware.use>[0],
      res as unknown as Parameters<typeof middleware.use>[1],
      next,
    );

    expect(req.correlationId).toBe(original);
  });
});
