/**
 * comp.providers.ts — DI factory for the COMP data layer.
 * Default: adapter='http' — comp-service is available (no mocks in production).
 * Mock adapters are retained for unit-test overrides only.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Moved to @cordele/comp/data-access (P6 boundary fix — INT-FE-COMP-006).
 */
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { LayoutHttpAdapter } from './api/layout-http.adapter';
import { LayoutMockAdapter } from './api/layout-mock.adapter';
import { LAYOUT_PORT } from './api/layout.port';
import { MetadadosHttpAdapter } from './api/metadados-http.adapter';
import { MetadadosMockAdapter } from './api/metadados-mock.adapter';
import { METADADOS_PORT } from './api/metadados.port';

export interface CompFeatureConfig {
  adapter: 'mock' | 'http';
}

export function provideComp(config: CompFeatureConfig = { adapter: 'http' }): EnvironmentProviders {
  const isMock = config.adapter === 'mock';
  return makeEnvironmentProviders([
    {
      provide:  METADADOS_PORT,
      useClass: isMock ? MetadadosMockAdapter : MetadadosHttpAdapter,
    },
    {
      provide:  LAYOUT_PORT,
      useClass: isMock ? LayoutMockAdapter : LayoutHttpAdapter,
    },
  ]);
}
