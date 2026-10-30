import { ConfigService } from '@nestjs/config';

import { EmpresaContextService } from '../auth/empresa-context.service';
import { CompCompositionLayoutAdapter } from './comp-composition-layout.adapter';

/**
 * Unit tests for `CompCompositionLayoutAdapter` (INT-PUB-002, P10).
 *
 * fetch is mocked via `jest.spyOn(globalThis, 'fetch')` — no HTTP call is made.
 */
describe('CompCompositionLayoutAdapter', () => {
  const PROJETO_ID = 'proj-abc-456';
  const COMP_BASE_URL = 'http://localhost:3003';
  const EXPECTED_URL = `${COMP_BASE_URL}/api/v1/comp/projetos/${PROJETO_ID}/layout`;
  const BEARER_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.payload.sig';

  let adapter: CompCompositionLayoutAdapter;
  let empresaContextService: EmpresaContextService;
  let fetchSpy: jest.SpyInstance;

  const makeConfig = (url = COMP_BASE_URL): ConfigService =>
    ({
      get: jest.fn().mockImplementation((key: string) => (key === 'COMP_SERVICE_URL' ? url : undefined)),
    }) as unknown as ConfigService;

  const makeResponse = (body: unknown, status = 200): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

  const makeLayoutBody = (materialized = true, overrides: unknown[] = []) => ({
    projetoId: PROJETO_ID,
    fonteCorpoFamilia: 'serif' as const,
    fonteCorpoTamanho: 12,
    espacamentoLinha: 1.5,
    margemLateral: 20,
    h1Tamanho: 24,
    h2Tamanho: 20,
    h3Tamanho: 18,
    overrides,
    atualizadoEm: '2026-01-15T10:30:00.000Z',
    materialized,
  });

  beforeEach(() => {
    empresaContextService = new EmpresaContextService();
    adapter = new CompCompositionLayoutAdapter(makeConfig(), empresaContextService);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('Cenário 1: 200 com materialized=true e overrides — retorna LayoutRead com overrides filtrados', () => {
    it('maps typography fields and filters overrides to imagem|em-branco only', async () => {
      const overrides = [
        {
          id: 'ov-1',
          referenciaNo: 'no-10',
          tipo: 'imagem',
          alinhamento: 'centralizado',
          ordem: 1,
          stale: false,
        },
        {
          id: 'ov-2',
          referenciaNo: 'no-20',
          tipo: 'em-branco',
          alinhamento: null,
          ordem: 2,
          stale: false,
        },
        {
          id: 'ov-3',
          referenciaNo: 'no-30',
          tipo: 'outro-tipo-futuro',
          alinhamento: null,
          ordem: 3,
          stale: false,
        },
      ];
      fetchSpy.mockResolvedValueOnce(makeResponse(makeLayoutBody(true, overrides)));

      await empresaContextService.run(
        { userId: 'u1', empresaId: 'emp_aetos', bearerToken: BEARER_TOKEN },
        async () => {
          const result = await adapter.get(PROJETO_ID);

          expect(result).not.toBeNull();
          expect(result?.projetoId).toBe(PROJETO_ID);
          expect(result?.fonteCorpoFamilia).toBe('serif');
          expect(result?.fonteCorpoTamanho).toBe(12);
          expect(result?.espacamentoLinha).toBe(1.5);
          expect(result?.margemLateral).toBe(20);
          expect(result?.h1Tamanho).toBe(24);
          expect(result?.h2Tamanho).toBe(20);
          expect(result?.h3Tamanho).toBe(18);

          // Only 'imagem' and 'em-branco' are included; 'outro-tipo-futuro' is filtered.
          expect(result?.overrides).toHaveLength(2);
          expect(result?.overrides[0]).toEqual({
            id: 'ov-1',
            referenciaNo: 'no-10',
            tipo: 'imagem',
            alinhamento: 'centralizado',
            ordem: 1,
          });
          expect(result?.overrides[1]).toEqual({
            id: 'ov-2',
            referenciaNo: 'no-20',
            tipo: 'em-branco',
            alinhamento: null,
            ordem: 2,
          });
          // 'stale' must not be present in the returned LayoutOverrideRead.
          expect(result?.overrides[0]).not.toHaveProperty('stale');
        },
      );
    });

    it('sends Authorization header with bearer token from ALS', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(makeLayoutBody(true)));

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
  });

  describe('Cenário 2: 200 com materialized=false — retorna null', () => {
    it('returns null when COMP returns a synthetic default', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(makeLayoutBody(false)));

      const result = await adapter.get(PROJETO_ID);

      expect(result).toBeNull();
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
});
