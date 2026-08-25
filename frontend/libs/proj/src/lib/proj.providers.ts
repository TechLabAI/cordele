/**
 * proj.providers.ts — DI factory for the PROJ data layer.
 * Default: adapter='mock' (dev). Set adapter='http' in production app.config.ts.
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ProjetoHttpAdapter } from './api/projeto-http.adapter';
import { ProjetoMockAdapter } from './api/projeto-mock.adapter';
import { PROJETO_PORT } from './api/projeto.port';
import { PublicacaoHttpAdapter } from './api/publicacao-http.adapter';
import { PublicacaoMockAdapter } from './api/publicacao-mock.adapter';
import { PUBLICACAO_PORT } from './api/publicacao.port';

export interface ProjFeatureConfig {
  adapter: 'mock' | 'http';
}

export function provideProj(config: ProjFeatureConfig = { adapter: 'mock' }): EnvironmentProviders {
  const isMock = config.adapter === 'mock';
  return makeEnvironmentProviders([
    {
      provide:  PROJETO_PORT,
      useClass: isMock ? ProjetoMockAdapter : ProjetoHttpAdapter,
    },
    {
      provide:  PUBLICACAO_PORT,
      useClass: isMock ? PublicacaoMockAdapter : PublicacaoHttpAdapter,
    },
  ]);
}
