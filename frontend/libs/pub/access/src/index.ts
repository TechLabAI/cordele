/**
 * Public API barrel for @cordele/pub-access.
 * P1 — Foundation (migrated from @cordele/pub flat lib to unblock pub-shell-entry build chain).
 *
 * Exports guard stubs consumed by pub-shell-entry routes.
 * Full implementation in P5 (FE-PUB-021/022).
 */
export { pubProjetoGuard } from './lib/pub-projeto.guard';
export { pubStatusGuard } from './lib/pub-status.guard';
