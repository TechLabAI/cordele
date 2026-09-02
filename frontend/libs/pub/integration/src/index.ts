/**
 * Public API barrel for @cordele/pub-integration.
 * P1 — Foundation (FE-PUB-006).
 *
 * Exports PubShellIntegrationService consumed by:
 *   - ExportFacade (P2): empresaChanged signal to cancel in-flight polls
 *   - app.config.ts (optional): start() at module activation
 */
export { PubShellIntegrationService } from './lib/pub-shell-integration.service';
