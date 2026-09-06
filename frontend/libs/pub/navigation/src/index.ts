/**
 * Public API barrel for @cordele/pub-navigation.
 * P1 -- Foundation (FE-PUB-005).
 * P6 -- Navigation / Breadcrumbs (FE-PUB-023): breadcrumb screen resolution helpers.
 *
 * Exports navigation config consumed by the shell and PubShellIntegrationService.
 * Exports PubNavScreen type and resolvePubBreadcrumbs helper for future NavigationService use.
 * PUB_UPDATE_BREADCRUMB token is in @cordele/pub-data-access (avoids cross-lib source imports).
 */
export { PUB_NAV_CONFIG, resolvePubBreadcrumbs } from './lib/pub-nav.config';
export type { NavConfig, PubNavScreen } from './lib/pub-nav.config';
