/**
 * pub.providers.ts — DI factory for the PUB data layer.
 * Migrated from libs/pub (flat lib) to libs/pub/data-access (P2 — FE-PUB-007).
 *
 * Default: adapter='http' (real pub-service — isMock: false).
 * Override adapter='mock' in specs or Storybook.
 *
 * IMPORTANT: app.config.ts must call providePub({ adapter: 'http' }) in production.
 * The mock adapter is kept for testing only — it is NOT the default.
 *
 * PUB_EMPRESA_CHANGED wiring (INT-FE-PUB-006):
 *   To wire ExportFacade's empresaChanged to PubShellIntegrationService, override the token:
 *     { provide: PUB_EMPRESA_CHANGED, useFactory: () => inject(PubShellIntegrationService).empresaChanged }
 *   This can be done in app.config.ts alongside providePub({ adapter: 'http' }).
 *   Default factory is signal(0) (safe no-op when integration service is not yet wired).
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { PublicacaoHttpAdapter } from './api/publicacao-http.adapter';
import { PublicacaoMockAdapter } from './api/publicacao-mock.adapter';
import { PUBLICACAO_PORT } from './api/publicacao.port';

export interface PubFeatureConfig {
  adapter: 'mock' | 'http';
}

export function providePub(config: PubFeatureConfig = { adapter: 'http' }): EnvironmentProviders {
  const isMock = config.adapter === 'mock';
  return makeEnvironmentProviders([
    {
      provide:  PUBLICACAO_PORT,
      useClass: isMock ? PublicacaoMockAdapter : PublicacaoHttpAdapter,
    },
  ]);
}
