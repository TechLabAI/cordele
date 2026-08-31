/**
 * comp.bootstrap.ts — module lifecycle hooks for COMP.
 * FE-COMP-003 / SPEC-06 §3
 *
 * compInit()    — called by the shell when COMP is activated (lazy chunk loaded).
 *                 Registers navigation config + COMP permissions/flags with AccessDecisionService.
 *                 NO prefetch (ADR-COMP-001).
 * compDestroy() — called when the user leaves the COMP module entirely.
 *                 Unregisters nav config; in-flight requests are cancelled
 *                 via takeUntilDestroyed() inside each facade.
 *
 * These functions are exported from @cordele/comp so the shell can call them
 * from module-descriptors.ts (FE-COMP-005).
 *
 * Updated: INT-FE-COMP-005 (P4) — registers COMP_PERMISSION_MAP and COMP_FEATURE_FLAGS
 *          with AccessDecisionService so that accessGuard('comp.view') and hasFlag() work.
 */
import { inject } from '@angular/core';
import { AccessDecisionService } from '@cordele/shared/access-decision';
import { CompShellIntegrationService } from './comp-shell-integration.service';
import { COMP_PERMISSION_MAP, COMP_FEATURE_FLAGS } from './comp.contract';

/**
 * compInit — registers COMP navigation config + access policies with the shell.
 * Must be called in an injection context (e.g., APP_INITIALIZER or route resolver).
 */
export function compInit(): void {
  inject(CompShellIntegrationService).register();

  // INT-FE-COMP-005: Register COMP permissions and feature flags with AccessDecisionService.
  // This enables accessGuard('comp.view'), can('comp.edit'), hasFlag('comp.coverUpload'), etc.
  const accessDecision = inject(AccessDecisionService);
  accessDecision.registerPermissions(COMP_PERMISSION_MAP);
  accessDecision.registerFlags(COMP_FEATURE_FLAGS);
}

/**
 * compDestroy — cleans up COMP navigation config.
 * In-flight HTTP requests are handled by facades via takeUntilDestroyed().
 */
export function compDestroy(): void {
  inject(CompShellIntegrationService).unregister();
}
