/**
 * epub-summary-grid.component.spec.ts — FE-PUB-015 — Unit tests for EpubSummaryGridComponent.
 *
 * Verifies:
 *   - Component creates without errors.
 *   - hasStats is false when any input is null (default: all null — BLOCKED INT-FE-PUB-005).
 *   - Empty state rendered when all inputs are null.
 *   - hasStats is true when all inputs are non-null.
 *   - Stats grid rendered with correct values when all inputs are provided.
 *   - Empty state absent when all inputs are provided.
 *
 * Boundary: type:ui — component receives data via @Input primitives only.
 * No mock of data-access services (pure presentational).
 *
 * Track D: FE-PUB-015 — P3 Feature Libs.
 * BLOCKED: INT-FE-PUB-005 — KPI tiles (Tamanho/Páginas/Capítulos/Imagens) without api-contract
 * field — tiles omitted by design until resolved. Tests cover current contract (total/publicadas/
 * comAvisos/comErros counts from history aggregate).
 */
import { TestBed } from '@angular/core/testing';
import { EpubSummaryGridComponent } from './epub-summary-grid.component';

describe('EpubSummaryGridComponent', () => {

  async function build(
    overrides: Partial<Pick<EpubSummaryGridComponent, 'total' | 'publicadas' | 'comAvisos' | 'comErros'>> = {},
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

  it('renders empty state when all inputs are null', async () => {
    const fixture = await build();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Estatísticas de ePub indisponíveis');
  });

  it('renders stats grid when all inputs are non-null', async () => {
    const fixture = await build({ total: 5, publicadas: 3, comAvisos: 1, comErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Total de exportações');
    expect(el.textContent).toContain('Publicadas com sucesso');
    expect(el.textContent).toContain('Com avisos');
    expect(el.textContent).toContain('Com erros');
  });

  it('does NOT render empty state when all inputs are non-null', async () => {
    const fixture = await build({ total: 5, publicadas: 3, comAvisos: 1, comErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Estatísticas de ePub indisponíveis');
  });

  it('renders correct numeric values in grid', async () => {
    const fixture = await build({ total: 12, publicadas: 9, comAvisos: 2, comErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('12');
    expect(el.textContent).toContain('9');
    expect(el.textContent).toContain('2');
    expect(el.textContent).toContain('1');
  });

});
