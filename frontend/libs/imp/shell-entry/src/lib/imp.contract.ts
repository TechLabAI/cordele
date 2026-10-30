/**
 * imp.contract.ts — public module-level contract for the IMP module.
 * FE-IMP-001: ImpContract, shared type aliases for shell integration.
 *
 * IMP is the first-pipeline module (order:1), shown in global left-nav.
 * Accessed directly by users; default landing is /imp/upload.
 *
 * SPEC-01 §1–§3 / generator-config.yml §contract
 */
import { Routes } from '@angular/router';

// ── Shared type aliases (local until @cordele/shared defines a ModuleDescriptor lib) ──

/** Menu metadata shape expected by the shell step-bar and left-nav. */
export interface ModuleMenuMetadata {
  label: string;
  icon: string;
  order: number;
  isHome: boolean;
  hiddenFromNav: boolean;
  route: string;
}

/** FE permission key → BE scope mapping entry. */
export interface ModulePermissionEntry {
  readonly beScope: string;
}

/** Full permission map: FE perm key → ModulePermissionEntry. */
export type ModulePermissionMap = Record<string, ModulePermissionEntry>;

/** Feature flag entry: default state (on|off). */
export interface ModuleFeatureFlagEntry {
  defaultState: 'on' | 'off';
}

/** Feature flag map: flag key → ModuleFeatureFlagEntry. */
export type ModuleFeatureFlags = Record<string, ModuleFeatureFlagEntry>;

// ── FE-IMP-001: ImpContract ────────────────────────────────────────────────────

/**
 * ImpContract — public contract surface of the IMP module.
 * Consumed by the shell to register routes, permissions and feature flags.
 * FE-IMP-001 (SPEC-01 §1).
 */
export interface ImpContract {
  routes: Routes;
  permissions: readonly ['imp.import', 'imp.review', 'imp.confirm'];
  featureFlags: readonly ['imp.reimport', 'imp.ignoreFragment', 'imp.existingProject'];
}
