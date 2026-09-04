import { ConfigService } from '@nestjs/config';

import { EmpresaContextService } from '../auth/empresa-context.service';
import { CompCompositionMetadataAdapter } from './comp-composition-metadata.adapter';

/**
 * Unit tests for `CompCompositionMetadataAdapter` (INT-PUB-002, P10).
 *
 * fetch is mocked via `jest.spyOn(globalThis, 'fetch')` — no HTTP call is made.
 * All scenarios exercise the mapping, materialized-guard, and error-absorption
 * logic without a real comp-service.
 */
describe('CompCompositionMetadataAdapter', () => {
  const PROJETO_ID = 'proj-abc-123';
  const COMP_BASE_URL = 'http://localhost:3003';
  const EXPECTED_URL = `${COMP_BASE_URL}/api/v1/comp/projetos/${PROJETO_ID}/metadados`;
  const BEARER_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.payload.sig';

  let adapter: CompCompositionMetadataAdapter;
  let empresaContextService: EmpresaContextService;
  let fetchSpy: jest.SpyInstance;

  const makeConfig = (url = COMP_BASE_URL): ConfigService =>
    ({
      get: jest.fn().mockImplementation((key: string) => (key === 'COMP_SERVICE_URL' ? url : undefined)),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'COMP_SERVICE_URL') return url;
        throw new Error(`[test] ConfigService key not found: ${key}`);
      }),
    }) as unknown as ConfigService;

  const makeResponse = (body: unknown, status = 200): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

  const makeMetadadosBody = (materialized = true) => ({
    projetoId: PROJETO_ID,
    titulo: 'Meu Título',
    autor: 'Autor Teste',
    isbn: '978-3-16-148410-0',
    idioma: 'pt-BR',
    categoria: 'Ficção',
    capaUrl: 'https://cdn.example.com/capa.jpg',
    editoraNome: 'Editora Aetós',
    atualizadoEm: '2026-01-15T10:30:00.000Z',
    materialized,
  });

  beforeEach(() => {
    empresaContextService = new EmpresaContextService();
    adapter = new CompCompositionMetadataAdapter(makeConfig(), empresaContextService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('Cenário 1: 200 com materialized=true — retorna MetadadosRead mapeado', () => {
    it('maps all fields and strips the materialized flag', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(makeMetadadosBody(true)));

      await empresaContextService.run(
        { userId: 'u1', empresaId: 'emp_aetos', bearerToken: BEARER_TOKEN },
        async () => {
          const result = await adapter.get(PROJETO_ID);

          expect(result).not.toBeNull();
          expect(result).toEqual({
            projetoId: PROJETO_ID,
            titulo: 'Meu Título',
            autor: 'Autor Teste',
            isbn: '978-3-16-148410-0',
            idioma: 'pt-BR',
            categoria: 'Ficção',
            capaUrl: 'https://cdn.example.com/capa.jpg',
            editoraNome: 'Editora Aetós',
            atualizadoEm: '2026-01-15T10:30:00.000Z',
          });
          expect(result).not.toHaveProperty('materialized');
        },
      );
    });

    it('sends Authorization header with bearer token from ALS', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(makeMetadadosBody(true)));

      await empresaContextService.run(
        { userId: 'u1', empresaId: 'emp_aetos', bearerToken: BEARER_TOKEN },
        async () => {
          await adapter.get(PROJETO_ID);
        },
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        EXPECTED_URL,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${BEARER_TOKEN}` }),
        }),
      );
    });

    it('coerces empty string fields to null', async () => {
      const body = {
        ...makeMetadadosBody(true),
        isbn: '',
        categoria: '',
        capaUrl: null,
        editoraNome: '',
      };
      fetchSpy.mockResolvedValueOnce(makeResponse(body));

      await empresaContextService.run(
        { userId: 'u1', empresaId: 'emp_aetos', bearerToken: BEARER_TOKEN },
        async () => {
          const result = await adapter.get(PROJETO_ID);
          expect(result?.isbn).toBeNull();
          expect(result?.categoria).toBeNull();
          expect(result?.capaUrl).toBeNull();
          expect(result?.editoraNome).toBeNull();
        },
      );
    });
  });

  describe('Cenário 2: 200 com materialized=false — retorna null', () => {
    it('returns null when COMP returns a synthetic default', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(makeMetadadosBody(false)));

      const result = await adapter.get(PROJETO_ID);

      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cenário 3: 404 — retorna null', () => {
    it('returns null on 404 without throwing', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse({}, 404));

      const result = await adapter.get(PROJETO_ID);

      expect(result).toBeNull();
    });
  });

  describe('Cenário 4: erro de rede — retorna null sem propagar excecao', () => {
    it('absorbs network errors and returns null', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await adapter.get(PROJETO_ID);

      expect(result).toBeNull();
    });
  });

  describe('Cenário 5: bearer token null (sem contexto ALS) — chama fetch sem Authorization', () => {
    it('omits Authorization header when getBearerToken() returns null', async () => {
      // No ALS context — getBearerToken() returns null.
      fetchSpy.mockResolvedValueOnce(makeResponse({}, 401));

      const result = await adapter.get(PROJETO_ID);

      expect(result).toBeNull();
      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1]?.headers as Record<string, string> | undefined;
      expect(headers?.['Authorization']).toBeUndefined();
    });
  });

  describe('Cenário 6: SD-01 — sem env var, adapter falha na construcao', () => {
    it('throws during construction when COMP_SERVICE_URL env var is absent (SD-01 guard)', () => {
      // Validates that the adapter fails loudly at boot time instead of silently
      // falling back to a wrong default. This test would break if getOrThrow()
      // were reverted to config.get() ?? 'default'.
      const configWithoutUrl: ConfigService = {
        get: jest.fn().mockReturnValue(undefined),
        getOrThrow: jest.fn().mockImplementation((key: string) => {
          throw new Error(`[test] Missing env var: ${key}`);
        }),
      } as unknown as ConfigService;

      expect(() => new CompCompositionMetadataAdapter(configWithoutUrl, empresaContextService)).toThrow(
        /Missing env var: COMP_SERVICE_URL/,
      );
    });
  });
});
