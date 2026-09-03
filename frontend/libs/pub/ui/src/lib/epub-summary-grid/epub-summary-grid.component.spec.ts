/**
 * epub-summary-grid.component.spec.ts — FE-PUB-015 — Unit tests for EpubSummaryGridComponent.
 *
 * Verifies:
 *   - Component creates without errors.
 *   - hasStats is false when any publication stats input is null.
 *   - hasStats is true when all publication stats inputs are non-null.
 *   - Stats grid (Section A) rendered with correct values when all stats provided.
 *   - hasKpis is false when all ePub KPI inputs (tamanho/capitulos/imagens) are null.
 *   - hasKpis is true when at least one KPI input is non-null.
 *   - KPI tiles (Section B, INT-FE-PUB-005) rendered and hidden correctly per null-safety.
 *
 * Boundary: type:ui — component receives data via @Input primitives only.
 * No mock of data-access services (pure presentational).
 *
 * Track D: FE-PUB-015 — P3 Feature Libs.
 * INT-FE-PUB-005 resolved: ePub KPI tiles (Tamanho/Capítulos/Imagens) now implemented.
 */
import { TestBed } from '@angular/core/testing';
import { EpubSummaryGridComponent } from './epub-summary-grid.component';

describe('EpubSummaryGridComponent', () => {

  async function build(
    overrides: Partial<Pick<EpubSummaryGridComponent, 'total' | 'publicadas' | 'comAvisos' | 'comErros' | 'tamanho' | 'capitulos' | 'imagens'>> = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [EpubSummaryGridComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(EpubSummaryGridComponent);
    Object.assign(fixture.componentInstance, overrides);
    fixture.detectChanges();
    return fixture;
  }

  it('should create without errors', async () => {
    const fixture = await build();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('hasStats is false when all inputs are null (default — BLOCKED INT-FE-PUB-005)', async () => {
    const fixture = await build();
    expect(fixture.componentInstance.hasStats).toBe(false);
  });

  it('hasStats is false when any single input is null', async () => {
    // total null — rest non-null
    const f1 = await build({ total: null, publicadas: 2, comAvisos: 0, comErros: 0 });
    expect(f1.componentInstance.hasStats).toBe(false);

    TestBed.resetTestingModule();

    // publicadas null
    const f2 = await build({ total: 5, publicadas: null, comAvisos: 0, comErros: 0 });
    expect(f2.componentInstance.hasStats).toBe(false);
  });

  it('hasStats is true when all inputs are non-null', async () => {
    const fixture = await build({ total: 10, publicadas: 8, comAvisos: 1, comErros: 1 });
    expect(fixture.componentInstance.hasStats).toBe(true);
  });

  // ── Empty state (plan P3: "renderizar estado vazio explícito") ───────────

  it('renders empty state when all inputs are null', async () => {
    // Neither stats nor KPI tiles → isEmpty = true → explicit empty state shown.
    const fixture = await build();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Estatísticas de ePub indisponíveis');
  });

  it('does NOT render empty state when stats inputs are non-null', async () => {
    // Section A has data → isEmpty = false → empty state absent.
    const fixture = await build({ total: 5, publicadas: 3, comAvisos: 1, comErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Estatísticas de ePub indisponíveis');
  });

  it('does NOT render empty state when at least one KPI tile is non-null', async () => {
    // Section B has data → isEmpty = false → empty state absent.
    const fixture = await build({ tamanho: '1.4 MB' });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Estatísticas de ePub indisponíveis');
  });

  // ── Section A: Stats grid ────────────────────────────────────────────────

  it('renders stats grid when all inputs are non-null', async () => {
    const fixture = await build({ total: 5, publicadas: 3, comAvisos: 1, comErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Total de exportações');
    expect(el.textContent).toContain('Publicadas com sucesso');
    expect(el.textContent).toContain('Com avisos');
    expect(el.textContent).toContain('Com erros');
  });

  it('renders correct numeric values in grid', async () => {
    const fixture = await build({ total: 12, publicadas: 9, comAvisos: 2, comErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('12');
    expect(el.textContent).toContain('9');
    expect(el.textContent).toContain('2');
    expect(el.textContent).toContain('1');
  });

  // ── Section B: ePub KPI tiles (INT-FE-PUB-005) ───────────────────────────

  it('hasKpis is false when all KPI inputs are null', async () => {
    const fixture = await build();
    expect(fixture.componentInstance.hasKpis).toBe(false);
  });

  it('hasKpis is true when tamanho is non-null', async () => {
    const fixture = await build({ tamanho: '1.4 MB' });
    expect(fixture.componentInstance.hasKpis).toBe(true);
  });

  it('hasKpis is true when capitulos is non-null', async () => {
    const fixture = await build({ capitulos: 12 });
    expect(fixture.componentInstance.hasKpis).toBe(true);
  });

  it('hasKpis is true when imagens is non-null', async () => {
    const fixture = await build({ imagens: 87 });
    expect(fixture.componentInstance.hasKpis).toBe(true);
  });

  it('renders tamanho tile when provided', async () => {
    const fixture = await build({ tamanho: '2.1 MB' });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tamanho do arquivo');
    expect(el.textContent).toContain('2.1 MB');
  });

  it('hides tamanho tile when null', async () => {
    const fixture = await build({ tamanho: null, capitulos: 5 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Tamanho do arquivo');
  });

  it('renders capitulos tile when provided', async () => {
    const fixture = await build({ capitulos: 15 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Capítulos');
    expect(el.textContent).toContain('15');
  });

  it('hides capitulos tile when null', async () => {
    const fixture = await build({ capitulos: null, tamanho: '1.5 MB' });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Capítulos');
  });

  it('renders imagens tile when provided', async () => {
    const fixture = await build({ imagens: 120 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Imagens');
    expect(el.textContent).toContain('120');
  });

  it('hides imagens tile when null', async () => {
    const fixture = await build({ imagens: null, capitulos: 8 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Imagens');
  });

  it('renders all KPI tiles when all provided', async () => {
    const fixture = await build({ tamanho: '3.2 MB', capitulos: 20, imagens: 95 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tamanho do arquivo');
    expect(el.textContent).toContain('3.2 MB');
    expect(el.textContent).toContain('Capítulos');
    expect(el.textContent).toContain('20');
    expect(el.textContent).toContain('Imagens');
    expect(el.textContent).toContain('95');
  });

  it('does NOT render paginas tile (ADR-004 — ePub reflowable)', async () => {
    const fixture = await build({ tamanho: '1.4 MB', capitulos: 10, imagens: 50 });
    const el: HTMLElement = fixture.nativeElement;
    // Ensure paginas is never rendered, even when other KPIs are present
    expect(el.textContent).not.toContain('Páginas');
  });

});
