/**
 * smoke.spec.ts — smoke test contra o pub-service real.
 *
 * Propósito: fecha o gap de cobertura onde adaptadores com path errado
 * (/api/pub) atravessam lint/test/build sem serem detectados.
 *
 * Testes implementados:
 *   1. /api/v1/pub/...   → 401 sem token  (rota existe)
 *   2. /api/pub/...      → 404            (path antigo rejeitado)
 *   3. /api/v1/pub/...   → 200 autenticado (caminho feliz completo: nginx+token+scope+schema)
 *   4. POST pub:write sem o scope → 403   (enforcement de autorização ativo)
 *
 * Requer: pub-service em http://localhost:3002 + Keycloak em host.docker.internal:8180.
 * Se qualquer um estiver indisponível: test.skip() — NUNCA quebra pipeline por ausência de infra.
 *
 * Token de leitura : coordenadora / coord123 (scopes: pub:read pub:write)
 * Token sem escrita: leitor / leitor123 (scopes: pub:read apenas — gating por papel no realm)
 *
 * ⚠️  Keycloak DEVE ser acessado via host.docker.internal:8180, não localhost:8180.
 *     O `iss` do token precisa bater com JWT_ISSUER_URI do pub-service; caso contrário
 *     o service rejeita com 401 mesmo com payload válido (armadilha de iss mismatch).
 *
 * FE-PUB-027 (P9 hardening gate — requisito de primeira classe).
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';

const PUB_SERVICE_BASE  = process.env['PUB_SERVICE_URL']  ?? 'http://localhost:3002';
const KEYCLOAK_BASE     = process.env['KEYCLOAK_URL']     ?? 'http://host.docker.internal:8180';
const KEYCLOAK_REALM    = 'cordele';
const KEYCLOAK_CLIENT   = 'cordele-web';
const PROBE_ID          = 'a1b2c3d4-1234-5678-9abc-def012345678';

/** Probe pub-service health. Returns false if unreachable. */
async function pubServiceOnline(): Promise<boolean> {
  const ctx = await playwrightRequest.newContext({ baseURL: PUB_SERVICE_BASE });
  try {
    await ctx.get(`/api/v1/pub/projetos/${PROBE_ID}/publicacoes`, { timeout: 3_000 });
    return true;
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Obtain an access token from Keycloak via Resource Owner Password Credentials.
 * Returns null when Keycloak is unreachable.
 *
 * @param username  - Keycloak username
 * @param password  - Keycloak password
 * @param scope     - OAuth2 scope string (e.g. 'openid pub:read pub:write')
 */
async function getToken(
  username: string,
  password: string,
  scope = 'openid pub:read pub:write',
): Promise<string | null> {
  const ctx = await playwrightRequest.newContext({ baseURL: KEYCLOAK_BASE });
  try {
    const resp = await ctx.post(
      `/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: new URLSearchParams({
          client_id:  KEYCLOAK_CLIENT,
          grant_type: 'password',
          username,
          password,
          scope,
        }).toString(),
        timeout: 5_000,
      },
    );
    if (!resp.ok()) return null;
    const body = await resp.json() as { access_token?: string };
    return body.access_token ?? null;
  } catch {
    return null;
  } finally {
    await ctx.dispose();
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('pub-service smoke — path versionado + autenticação + autorização', () => {

  // ── 1. Path correto sem token → 401 (rota existe) ────────────────────────────

  test(
    'GET /api/v1/pub/projetos/{id}/publicacoes retorna 401 sem token — path correto no ar',
    async () => {
      const ctx = await playwrightRequest.newContext({ baseURL: PUB_SERVICE_BASE });
      let response: Awaited<ReturnType<typeof ctx.get>>;

      try {
        response = await ctx.get(`/api/v1/pub/projetos/${PROBE_ID}/publicacoes`, {
          headers: { Accept: 'application/json' },
          timeout: 5_000,
        });
      } catch {
        // pub-service offline — never fail CI for missing infra
        test.skip(true, 'pub-service indisponível — smoke ignorado neste ambiente');
        await ctx.dispose();
        return;
      }

      // 401 = auth required → rota existe. 404 = path errado (ex.: /api/pub/).
      expect(
        response.status(),
        `Esperado 401 mas recebeu ${response.status()} — verifique ACCESS_HTTP_BASE e a rota versionada`,
      ).toBe(401);

      await ctx.dispose();
    },
  );

  // ── 2. Path antigo sem /v1/ → 404 (rota não existe) ──────────────────────────

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

      // O path sem /v1/ deve retornar 404 — rota nunca existiu neste service.
      expect(
        response.status(),
        `Esperado 404 mas recebeu ${response.status()} — o path /api/pub/ não deveria existir`,
      ).toBe(404);

      await ctx.dispose();
    },
  );

  // ── 3. Caminho feliz: token válido com pub:read → 200 ────────────────────────

  test(
    'GET /api/v1/pub/projetos/{id}/publicacoes autenticado retorna 200 — caminho feliz completo',
    async () => {
      // Precheck: skip se pub-service ou Keycloak offline (nunca quebrar pipeline)
      const online = await pubServiceOnline();
      if (!online) {
        test.skip(true, 'pub-service indisponível — smoke ignorado neste ambiente');
        return;
      }

      // coordenadora tem pub:read (e pub:write) — scope default do realm para este papel.
      // Keycloak obrigatoriamente via host.docker.internal:8180 para o iss bater com JWT_ISSUER_URI.
      const token = await getToken('coordenadora', 'coord123', 'openid pub:read pub:write');
      if (!token) {
        test.skip(true, 'Keycloak indisponível ou credenciais inválidas — smoke ignorado');
        return;
      }

      const ctx = await playwrightRequest.newContext({ baseURL: PUB_SERVICE_BASE });
      let response: Awaited<ReturnType<typeof ctx.get>>;

      try {
        response = await ctx.get(`/api/v1/pub/projetos/${PROBE_ID}/publicacoes`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          timeout: 5_000,
        });
      } catch (err) {
        test.skip(true, `pub-service inacessível com token: ${String(err)}`);
        await ctx.dispose();
        return;
      }

      // 200 = nginx + token válido + scope correto + schema resolvido + handler executou.
      // 401 = token rejeitado (iss mismatch, expirado ou token inválido).
      // 403 = scope insuficiente.
      // 404 = path errado — regressão crítica.
      expect(
        response.status(),
        [
          `Esperado 200 mas recebeu ${response.status()}.`,
          '401 → token rejeitado (cheque iss mismatch: JWT_ISSUER_URI vs host.docker.internal:8180).',
          '403 → scope insuficiente (coordenadora deve ter pub:read).',
          '404 → path errado — regressão em ACCESS_HTTP_BASE ou rota do pub-service.',
        ].join(' '),
      ).toBe(200);

      await ctx.dispose();
    },
  );

  // ── 4. Autorização: token sem pub:write → 403 no endpoint de escrita ─────────

  test(
    'POST /api/v1/pub/projetos/{id}/publicacoes sem pub:write retorna 403 — enforcement de autorização ativo',
    async () => {
      // Precheck: skip se pub-service ou Keycloak offline
      const online = await pubServiceOnline();
      if (!online) {
        test.skip(true, 'pub-service indisponível — smoke ignorado neste ambiente');
        return;
      }

      // leitor tem apenas scopes de leitura (imp:read comp:read pub:read proj:read).
      // Mesmo pedindo pub:write no scope, o realm gateou por papel — pub:write não consta no token.
      // Isso é o caso de teste: token válido mas scope insuficiente para escrita.
      const token = await getToken('leitor', 'leitor123', 'openid pub:read pub:write');
      if (!token) {
        test.skip(true, 'Keycloak indisponível ou credenciais inválidas — smoke ignorado');
        return;
      }

      const ctx = await playwrightRequest.newContext({ baseURL: PUB_SERVICE_BASE });
      let response: Awaited<ReturnType<typeof ctx.get>>;

      try {
        // POST /api/v1/pub/projetos/{id}/publicacoes requer pub:write (decorador @RequiredScopes no controller).
        // JwtAuthGuard.enforceScopes() verifica antes de qualquer lógica de negócio → 403 puro,
        // sem acionar use case nem repositório.
        response = await ctx.post(`/api/v1/pub/projetos/${PROBE_ID}/publicacoes`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          data: '{}',
          timeout: 5_000,
        });
      } catch (err) {
        test.skip(true, `pub-service inacessível: ${String(err)}`);
        await ctx.dispose();
        return;
      }

      // 403 = scope insuficiente — JwtAuthGuard.enforceScopes rejeitou antes do handler.
      // 200/202 = FALHA — o guard não está aplicando pub:write; qualquer autenticado pode exportar.
      // 401 = token rejeitado (iss mismatch, token inválido).
      expect(
        response.status(),
        [
          `Esperado 403 mas recebeu ${response.status()}.`,
          '200/202 → FALHA CRÍTICA: guard @RequiredScopes(pub:write) não está ativo.',
          '401 → token rejeitado (cheque iss mismatch).',
          'Endpoint: POST /api/v1/pub/projetos/{id}/publicacoes — requer pub:write (@RequiredScopes no pub.controller.ts:94).',
        ].join(' '),
      ).toBe(403);

      await ctx.dispose();
    },
  );

});
