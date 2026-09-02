/**
 * pub.bootstrap.ts — PUB module lifecycle hooks (FE-PUB-004).
 * P1 — Foundation.
 *
 * Provides init/destroy factory functions for use in APP_INITIALIZER providers.
 *
 * Usage in app.config.ts:
 *   { provide: APP_INITIALIZER, useFactory: () => () => initPub(inject(AccessDecisionService)), multi: true }
 *
 * init(): registers PUB permissions and feature flags so that
 *   accessGuard('pub.export'), accessGuard('pub.view'), accessGuard('pub.download')
 *   can evaluate correctly.
 *
 * destroy(): called when the PUB module chunk is unloaded (optional teardown).
 *   In P1 this is a no-op; full teardown via PubShellIntegrationService in P2.
 *
 * SPEC-06 §shell / FE-PUB-004
 */
import { AccessDecisionService } from '@cordele/shared/access-decision';
import { PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS } from './pub.contract';

/**
 * initPub — registers PUB permissions and feature flags.
 * @param accessDecision — injected AccessDecisionService (caller provides via inject())
 */
export function initPub(accessDecision: AccessDecisionService): void {
  accessDecision.registerPermissions(
    Object.fromEntries(
      Object.entries(PUB_PERMISSION_MAP).map(([k, v]) => [k, { beScope: v.beScope }]),
    ),
  );

  accessDecision.registerFlags(
    Object.fromEntries(
      Object.entries(PUB_FEATURE_FLAGS).map(([k, v]) => [k, { defaultState: v.defaultState }]),
    ),
  );
}

/**
 * destroyPub — teardown hook (P1 no-op).
 * Full teardown is managed by PubShellIntegrationService.stop() in P2.
 */
export function destroyPub(): void {
  // no-op in P1
}
