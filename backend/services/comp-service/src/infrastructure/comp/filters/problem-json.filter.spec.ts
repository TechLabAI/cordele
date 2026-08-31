import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DomainException } from '../../../domain/shared/domain-exception';
import { ProblemJsonFilter } from './problem-json.filter';

describe('ProblemJsonFilter', () => {
  let filter: ProblemJsonFilter;

  const jsonCalls: Array<Record<string, unknown>> = [];
  const headerCalls: Array<[string, string]> = [];
  let statusCode: number;

  const buildHost = (correlationId?: string) => {
    jsonCalls.length = 0;
    headerCalls.length = 0;
    statusCode = 0;

    const req = {
      correlationId,
      headers: { 'x-correlation-id': correlationId ?? 'fallback-id' },
    };

    const res = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      setHeader(name: string, value: string) {
        headerCalls.push([name, value]);
        return res;
      },
      json(body: Record<string, unknown>) {
        jsonCalls.push(body);
        return res;
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as Parameters<typeof filter.catch>[1];
  };

  beforeEach(() => {
    filter = new ProblemJsonFilter();
  });

  it('maps DomainException to 400 with application/problem+json', () => {
    const host = buildHost('trace-001');
    const exception = new DomainException('INVALID_TITULO', 400, 'Título inválido');

    filter.catch(exception, host);

    expect(statusCode).toBe(400);
    expect(headerCalls).toContainEqual(['Content-Type', 'application/problem+json']);
    expect(jsonCalls[0]).toMatchObject({
      type: 'urn:cordele:comp:invalid-titulo',
      title: 'INVALID_TITULO',
      status: 400,
      traceId: 'trace-001',
    });
  });

  it('body contains exactly {type, title, status, traceId} — no extra fields', () => {
    const host = buildHost('trace-002');
    const exception = new DomainException('SOME_ERROR', 422, 'Some error');

    filter.catch(exception, host);

    const body = jsonCalls[0];
    expect(Object.keys(body).sort()).toEqual(['status', 'title', 'traceId', 'type']);
  });

  it('maps NotFoundException to 404', () => {
    const host = buildHost('trace-003');
    filter.catch(new NotFoundException(), host);

    expect(statusCode).toBe(404);
    expect(jsonCalls[0]).toMatchObject({ status: 404, traceId: 'trace-003' });
  });

  it('maps UnauthorizedException to 401', () => {
    const host = buildHost('trace-004');
    filter.catch(new UnauthorizedException(), host);

    expect(statusCode).toBe(401);
    expect(jsonCalls[0]).toMatchObject({ status: 401, traceId: 'trace-004' });
  });

  it('maps ForbiddenException to 403', () => {
    const host = buildHost('trace-005');
    filter.catch(new ForbiddenException(), host);

    expect(statusCode).toBe(403);
    expect(jsonCalls[0]).toMatchObject({ status: 403, traceId: 'trace-005' });
  });

  it('maps unknown exceptions to 500', () => {
    const host = buildHost('trace-006');
    filter.catch(new Error('boom'), host);

    expect(statusCode).toBe(500);
    expect(jsonCalls[0]).toMatchObject({
      status: 500,
      title: 'InternalServerError',
      traceId: 'trace-006',
    });
  });

  it('uses header as traceId fallback when req.correlationId is absent', () => {
    const host = buildHost(undefined);
    filter.catch(new NotFoundException(), host);

    expect(jsonCalls[0]).toMatchObject({ traceId: 'fallback-id' });
  });

  it('uses "unknown" as traceId when both req.correlationId and header are absent', () => {
    // Build a host with neither source
    jsonCalls.length = 0;
    headerCalls.length = 0;
    statusCode = 0;
    const req = { headers: {} };
    const res = {
      status(code: number) { statusCode = code; return res; },
      setHeader() { return res; },
      json(body: Record<string, unknown>) { jsonCalls.push(body); return res; },
    };
    const host = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as Parameters<typeof filter.catch>[1];

    filter.catch(new NotFoundException(), host);

    expect(jsonCalls[0]).toMatchObject({ traceId: 'unknown' });
  });

  it('sets DomainException type with kebab-case code', () => {
    const host = buildHost('trace-007');
    filter.catch(new DomainException('LAYOUT_OVERRIDE_INVALID', 400), host);

    expect(jsonCalls[0]).toMatchObject({
      type: 'urn:cordele:comp:layout-override-invalid',
    });
  });
});
