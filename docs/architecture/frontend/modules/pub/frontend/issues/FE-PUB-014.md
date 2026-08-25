## [FE-PUB-014] EpubcheckResultBannerComponent — veredito server-authoritative (ADR-PUB-001)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui/src/lib/epubcheck-result-banner/epubcheck-result-banner.component.ts` renderiza o banner
de resultado da exportação: veredito `valido`/`avisos` → banner verde "✓ ePub válido e pronto para download";
veredito `erros_criticos` → banner vermelho "✗ Erros críticos — download bloqueado". O veredito é
renderizado diretamente do server record (ADR-PUB-001) — o componente nunca computa válido vs erros.

**Context / Problem statement:**
- SPEC-02 §1 define EpubcheckResultBannerComponent: inputs `verdict`, `totalErros`, `totalAvisos`, `resumoErro`.
- ADR-PUB-001: resultado server-authored + epubcheck-gated. FE jamais deriva válido vs erros.
- SPEC-03 §1: verdict = publicacao.epubcheckStatus (renderizado, não computado).
- avisos (não bloqueante): banner verde com caveat "N aviso(s) não bloqueante(s)".
- erros_criticos: banner vermelho + "N erro(s) · corrija antes de exportar" + resumoErro.

**Approach (execution path):**
1. Criar `libs/pub/ui/src/lib/epubcheck-result-banner/epubcheck-result-banner.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: verdict: EpubcheckStatus, totalErros: number, totalAvisos: number, resumoErro: string|null
   - `@if (verdict === 'valido' || verdict === 'avisos')`: banner success + linha epubcheck
   - `@if (verdict === 'erros_criticos')`: banner error + resumoErro + "corrija antes de exportar"
   - Sem lógica de derivação de veredito (só renderiza o input)

**Non-goals:**
- Não exibe a lista detalhada de avisos (FE-PUB-016 — gap M4).
- Não controla o botão de download (FE-PUB-017).

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 EpubcheckResultBannerComponent)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§1 EARS pub-verdict-rendered)
- `docs/architecture/frontend/modules/pub/frontend/adr/ADR-PUB-001-server-authoritative-epubcheck-gated-publication.md`

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; ZERO lógica de derivação de veredito

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/epubcheck-result-banner/epubcheck-result-banner.component.ts`
- 🔲 `libs/pub/ui/src/lib/epubcheck-result-banner/epubcheck-result-banner.component.html`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (avisos → banner verde; erros_criticos → banner vermelho; sem lógica própria de veredito)
- 🔲 `nx lint pub-ui` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P3

**Acceptance criteria:**
- `npx nx test pub-ui` PASS
- verdict='avisos': banner com classe success visível; download não bloqueado
- verdict='erros_criticos': banner com classe error; resumoErro visível se non-null
- Nenhum `if verdict === 'valido'? 'success' : verdict === 'avisos'? ... : 'error'` derivado internamente

**Dependencies:**
- FE-PUB-012 (ExportacaoEValidacaoComponent usa este componente)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (renderiza dados do ExportFacade)

**Testing / Evidence required:**
- DOM: data-testid="banner-success" para valido/avisos; data-testid="banner-error" para erros_criticos

**Risks / Notes:**
- Confirmar que @cordele/shared/ui-feedback tem tokens de cor semanticamente corretos para success/warning/error banners.
