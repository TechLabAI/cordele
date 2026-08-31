/**
 * Converts the honoured layout parameters (COMP api-contract §7.3) to a
 * CSS stylesheet string embedded in the ePub (SPEC-03 §2).
 *
 * Domain-pure: no @nestjs/* or @prisma/* imports.
 *
 * Honoured properties (exactly the set defined by COMP §7.3):
 *   - fonteCorpoFamilia, fonteCorpoTamanho, espacamentoLinha, margemLateral
 *   - h1/h2/h3Tamanho
 *   - image alignment per override (applied inline in epub-xhtml-builder.ts)
 *
 * Note: `em-branco` override type is NEVER rendered in CSS (D-H: "sem
 * em-branco no CSS") — blank-page overrides exist only as positional markers
 * in the spine.
 */

/** Subset of LayoutRead consumed by the CSS builder — mirrors COMP §7.3. */
export interface EpubLayoutForCss {
  readonly fonteCorpoFamilia: 'serif' | 'sans-serif';
  readonly fonteCorpoTamanho: number;
  readonly espacamentoLinha: number;
  readonly margemLateral: number;
  readonly h1Tamanho: number;
  readonly h2Tamanho: number;
  readonly h3Tamanho: number;
}

/** Default layout constants (COMP api-contract §7.2). */
const LAYOUT_DEFAULTS: EpubLayoutForCss = {
  fonteCorpoFamilia: 'serif',
  fonteCorpoTamanho: 12,
  espacamentoLinha: 1.5,
  margemLateral: 20,
  h1Tamanho: 24,
  h2Tamanho: 20,
  h3Tamanho: 16,
};

/**
 * Builds the CSS string for the ePub stylesheet.
 * @param layout - Layout parameters from COMP, or null to use documented defaults.
 */
export function buildEpubCss(layout: EpubLayoutForCss | null): string {
  const l = layout ?? LAYOUT_DEFAULTS;

  return `
/* Cordelê ePub stylesheet — generated from COMP ConfiguracaoLayout §7.3 */
/* WARNING: Do not edit — regenerated on each export. */

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: ${l.fonteCorpoFamilia === 'serif' ? 'Georgia, "Times New Roman", serif' : '"Helvetica Neue", Arial, sans-serif'};
  font-size: ${l.fonteCorpoTamanho}pt;
  line-height: ${l.espacamentoLinha};
  margin-left: ${l.margemLateral}mm;
  margin-right: ${l.margemLateral}mm;
}

p {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  text-align: justify;
}

h1 {
  font-size: ${l.h1Tamanho}pt;
  margin-top: 2em;
  margin-bottom: 1em;
  text-align: center;
}

h2 {
  font-size: ${l.h2Tamanho}pt;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

h3 {
  font-size: ${l.h3Tamanho}pt;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

img.align-full {
  width: 100%;
  margin: 0;
}

img.align-centralizado {
  margin-left: auto;
  margin-right: auto;
}

img.align-junto-esquerda {
  margin-right: auto;
}

img.align-junto-direita {
  margin-left: auto;
}

/* Preserve unparsed segments as preformatted blocks (D-H: unparsed never discarded). */
div.unparsed {
  font-family: monospace;
  font-size: 0.85em;
  white-space: pre-wrap;
  border-left: 3px solid #ccc;
  padding-left: 1em;
  margin: 1em 0;
}
`.trim();
}
