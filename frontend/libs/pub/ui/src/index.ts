/**
 * Public API barrel for @cordele/pub-ui.
 * P3 — FE-PUB-015, FE-PUB-016 / INT-FE-PUB-004
 *
 * Boundary: type:ui — components receive data via @Input (primitives + AvisoRow).
 * No imports from type:data-access. Consumers: pub-feature-export, pub-feature-history.
 */

// FE-PUB-016: Avisos / Erros do epubcheck — contagens + lista detalhada (INT-FE-PUB-004 desbloqueada)
// AvisoRow exported so feature consumers can use the type without importing data-access directly.
export { WarningsDetailsComponent } from './lib/warnings-details/warnings-details.component';
export type { AvisoRow } from './lib/warnings-details/warnings-details.component';

// FE-PUB-015: Grid de KPIs do ePub — tiles omitted when null (BLOCKED: INT-FE-PUB-005)
export { EpubSummaryGridComponent } from './lib/epub-summary-grid/epub-summary-grid.component';
