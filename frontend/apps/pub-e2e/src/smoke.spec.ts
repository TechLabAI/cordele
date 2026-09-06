/**
 * smoke.spec.ts — smoke test contra o pub-service real.
 *
 * Propósito: fecha o gap de cobertura onde adaptadores com path errado
 * (/api/pub) atravessam lint/test/build sem serem detectados.
 * /api/pub retorna 404; /api/v1/pub retorna 401 (auth required, rota existe).
 *
 * Requer: pub-service rodando em http://localhost:3002 (docker compose).
 * Se indisponível: test.skip() — NUNCA falha o pipeline por ausência de infra.
 *
 * FE-PUB-027 (P9 hardening gate — requisito de primeira classe).
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const PUB_SERVICE_BASE = process.env['PUB_SERVICE_URL'] ?? 'http://localhost:3002';
const PROBE_ID         = 'a1b2c3d4-1234-5678-9abc-def012345678';

test.describe('pub-service smoke — path versionado', () => {

  test(
    'GET /api/v1/pub/projetos/{id}/publicacoes retorna 401 (não 404) — path correto no ar',
    async () => {
      const ctx = await playwrightRequest.newContext({ baseURL: PUB_SERVICE_BASE });
      let response: Awaited<ReturnType<typeof ctx.get>>;

      try {
        response = await ctx.get(`/api/v1/pub/projetos/${PROBE_ID}/publicacoes`, {
          headers: { Accept: 'application/json' },
          timeout: 5_000,
        });
      } catch {
        // pub-service offline — skip gracefully, never fail CI for missing infra
        test.skip(true, 'pub-service indisponível — smoke ignorado neste ambiente');
        await ctx.dispose();
        return;
      }

      // 401 = auth required → a rota existe. 404 = path errado (ex.: /api/pub/...).
      expect(
        response.status(),
        `Esperado 401 mas recebeu ${response.status()} — verifique ACCESS_HTTP_BASE e a rota versionada`,
      ).toBe(401);

      await ctx.dispose();
    },
  );

  test(
    'GET /api/pub/projetos/{id}/publicacoes retorna 404 — path antigo (não versionado) rejeitado',
    async () => {
      const ctx = await playwrightRequest.newContext({ baseURL: PUB_SERVICE_BASE });
      let response: Awaited<ReturnType<typeof ctx.get>>;

      try {
        response = await ctx.get(`/api/pub/projetos/${PROBE_ID}/publicacoes`, {
          headers: { Accept: 'application/json' },
          timeout: 5_000,
        });
      } catch {
        test.skip(true, 'pub-service indisponível — smoke ignorado neste ambiente');
        await ctx.dispose();
        return;
      }

      // O path antigo sem /v1/ deve retornar 404 (rota não existe).
      expect(
        response.status(),
        `Esperado 404 mas recebeu ${response.status()} — o path /api/pub/ não deveria existir`,
      ).toBe(404);

      await ctx.dispose();
    },
  );

});
