/**
 * comp-nav.config.ts — navigation config for the COMP module.
 * FE-COMP-004 / SPEC-06 §2 §4
 * FE-COMP-023 — dynamic breadcrumb resolution (P7).
 *
 * Defines the step-bar positions for the pipeline
 * (Importar › Configurar › Edição › Exportar)
 * and breadcrumb templates for T05 and T06.
 *
 * Consumed by CompShellIntegrationService.register() / setActiveProject().
 */

// ── Nav types (local until @cordele/shared/navigation defines them) ───────────

export interface NavStep {
  key: string;
  label: string;
  /** Route template — :projetoId is substituted at runtime. */
  routeTemplate: string;
}

export interface BreadcrumbTemplate {
  routePattern: string;
  crumbs: Array<{ label: string; routeTemplate?: string }>;
}

export interface ModuleNavConfig {
  stepBar: NavStep[];
  breadcrumbs: BreadcrumbTemplate[];
}

/** Screens that have breadcrumb templates in COMP. */
export type CompNavScreen = 'configurar' | 'edicao';

/**
 * resolveNavBreadcrumbs — replaces the `{nome}` placeholder with the actual project id
 * (or project name when available). Used by CompShellIntegrationService.setActiveProject().
 *
 * FE-COMP-023: SPEC-06 §2 — breadcrumbs are dynamic; `{nome}` is resolved at runtime.
 * Fallback: use projetoId (route param) when project name store is unavailable.
 *
 * @param screen  - 'configurar' (T05) or 'edicao' (T06)
 * @param projetoId - raw route param; used as display label when project name unavailable
 * @returns resolved label array, e.g. ['Projetos', 'abc-123', 'Configurar']
 */
export function resolveNavBreadcrumbs(screen: CompNavScreen, projetoId: string): string[] {
  const screenToPattern: Record<CompNavScreen, string> = {
    configurar: '/config',
    edicao: '/editor-de-layout-preview',
  };
  const pattern = screenToPattern[screen];
  const template = COMP_NAV_CONFIG.breadcrumbs.find(b => b.routePattern.includes(pattern));
  if (!template) return [];
  return template.crumbs.map(c => (c.label === '{nome}' ? projetoId : c.label));
}

// ── COMP_NAV_CONFIG ───────────────────────────────────────────────────────────

/**
 * COMP_NAV_CONFIG — describes how COMP integrates with the shell navigation.
 *
 * Step-bar: the 4 pipeline steps visible at the top of every COMP screen.
 * Breadcrumbs: resolved per screen with {nome} substituted from the project title.
 *
 * SPEC-06 §4: "Exportar" = navigation to PUB — NOT a status change.
 */
export const COMP_NAV_CONFIG: ModuleNavConfig = {
  stepBar: [
    {
      key: 'importar',
      label: 'Importar',
      routeTemplate: '/imp/projetos/:projetoId/importar',
    },
    {
      key: 'configurar',
      label: 'Configurar',
      routeTemplate: '/comp/projetos/:projetoId/config',
    },
    {
      key: 'edicao',
      label: 'Edição',
      routeTemplate: '/comp/projetos/:projetoId/editor-de-layout-preview',
    },
    {
      key: 'exportar',
      label: 'Exportar',
      routeTemplate: '/pub/projetos/:projetoId/exportacao-e-validacao',
    },
  ],
  breadcrumbs: [
    {
      routePattern: '/comp/projetos/:projetoId/config',
      crumbs: [
        { label: 'Projetos', routeTemplate: '/proj' },
        { label: '{nome}' },
        { label: 'Configurar' },
      ],
    },
    {
      routePattern: '/comp/projetos/:projetoId/editor-de-layout-preview',
      crumbs: [
        { label: 'Projetos', routeTemplate: '/proj' },
        { label: '{nome}' },
        { label: 'Edição' },
      ],
    },
  ],
};
