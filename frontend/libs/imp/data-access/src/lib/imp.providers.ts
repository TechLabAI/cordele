/**
 * imp.providers.ts — DI factory for the IMP data layer.
 * Default: adapter='mock' (dev). Set adapter='http' in production app.config.ts.
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ManuscritoHttpAdapter } from './adapters/manuscrito-http.adapter';
import { ManuscritoMockAdapter } from './adapters/manuscrito-mock.adapter';
import { MANUSCRITO_PORT } from './ports/manuscrito.port';
import { SegmentoCuradoriaHttpAdapter } from './adapters/segmento-curadoria-http.adapter';
import { SegmentoCuradoriaMockAdapter } from './adapters/segmento-curadoria-mock.adapter';
import { SEGMENTO_CURADORIA_PORT } from './ports/segmento-curadoria.port';

export interface ImpFeatureConfig {
  adapter: 'mock' | 'http';
}

export function provideImp(config: ImpFeatureConfig = { adapter: 'mock' }): EnvironmentProviders {
  const isMock = config.adapter === 'mock';
  return makeEnvironmentProviders([
    {
      provide:  MANUSCRITO_PORT,
      useClass: isMock ? ManuscritoMockAdapter : ManuscritoHttpAdapter,
    },
    {
      provide:  SEGMENTO_CURADORIA_PORT,
      useClass: isMock ? SegmentoCuradoriaMockAdapter : SegmentoCuradoriaHttpAdapter,
    },
  ]);
}
