/**
 * pub.providers.ts — DI factory for the PUB data layer.
 * Default: adapter='mock' (dev). Set adapter='http' in production app.config.ts.
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { PublicacaoHttpAdapter } from './api/publicacao-http.adapter';
import { PublicacaoMockAdapter } from './api/publicacao-mock.adapter';
import { PUBLICACAO_PORT } from './api/publicacao.port';

export interface PubFeatureConfig {
  adapter: 'mock' | 'http';
}

export function providePub(config: PubFeatureConfig = { adapter: 'mock' }): EnvironmentProviders {
  const isMock = config.adapter === 'mock';
  return makeEnvironmentProviders([
    {
      provide:  PUBLICACAO_PORT,
      useClass: isMock ? PublicacaoMockAdapter : PublicacaoHttpAdapter,
    },
  ]);
}
