/**
 * Public API barrel for @cordele/pub-ui.
 * P3 — FE-PUB-015, FE-PUB-016
 *
 * Boundary: type:ui — components receive data via @Input (primitives).
 * No imports from type:data-access. Consumers: pub-feature-export, pub-feature-history.
 */

// FE-PUB-016: Avisos / Erros do epubcheck — counts only (detail list BLOCKED: INT-FE-PUB-004)
export { WarningsDetailsComponent } from './lib/warnings-details/warnings-details.component';

// FE-PUB-015: Grid de KPIs do ePub — tiles omitted when null (BLOCKED: INT-FE-PUB-005)
export { EpubSummaryGridComponent } from './lib/epub-summary-grid/epub-summary-grid.component';
