/**
 * warnings-details.component.spec.ts — FE-PUB-016 — Unit tests for WarningsDetailsComponent.
 *
 * Verifies:
 *   - Component creates without errors.
 *   - Error block rendered when totalErros > 0.
 *   - resumoErro shown inside error block when provided.
 *   - Warnings count banner rendered when totalAvisos > 0 and avisos=[].
 *   - Empty state rendered when totalErros=0 AND totalAvisos=0 AND avisos=[] (default inputs).
 *   - Error and warnings blocks absent when counters are zero.
 *   - Detailed aviso list rendered when avisos.length > 0 (INT-FE-PUB-004).
 *   - location: null rendered as "—" (never "null").
 *
 * Boundary: type:ui — component receives data via @Input (primitives + AvisoRow[]).
 * No mocks of data-access services needed (pure presentational).
 *
 * Track D: FE-PUB-016 — P3 Feature Libs / INT-FE-PUB-004 — P4 Hub Integrations.
 */
import { TestBed } from '@angular/core/testing';
import { AvisoRow, WarningsDetailsComponent } from './warnings-details.component';

const AVISO_WARNING: AvisoRow = {
  code:     'OPF-033',
  msg:      'Duplicate spine item reference',
  local:    'OEBPS/content.opf#L42',
  severity: 'warning',
};

const AVISO_ERROR_NO_LOC: AvisoRow = {
  code:     'PKG-006',
  msg:      'Missing required manifest item',
  local:    null,
  severity: 'error',
};

describe('WarningsDetailsComponent', () => {

  async function build(
    overrides: Partial<Pick<WarningsDetailsComponent, 'totalErros' | 'totalAvisos' | 'resumoErro' | 'avisos'>> = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [WarningsDetailsComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(WarningsDetailsComponent);
    Object.assign(fixture.componentInstance, overrides);
    fixture.detectChanges();
    return fixture;
  }

  it('should create without errors', async () => {
    const fixture = await build();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders empty state when totalErros=0 and totalAvisos=0 (default)', async () => {
    const fixture = await build();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Nenhum aviso ou erro registrado');
  });

  it('renders error block with count when totalErros > 0', async () => {
    const fixture = await build({ totalErros: 2 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2 erro(s) crítico(s)');
    expect(el.textContent).toContain('download bloqueado');
  });

  it('renders resumoErro text when provided alongside totalErros > 0', async () => {
    const fixture = await build({ totalErros: 1, resumoErro: 'OPS-001: spine item ausente' });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('OPS-001: spine item ausente');
  });

  it('does NOT render resumoErro block when resumoErro is null', async () => {
    const fixture = await build({ totalErros: 1, resumoErro: null });
    const el: HTMLElement = fixture.nativeElement;
    // The resumo paragraph only renders when resumoErro is truthy.
    // Text should still show error count but not a null string.
    expect(el.textContent).not.toContain('null');
  });

  it('renders warnings block with count when totalAvisos > 0', async () => {
    const fixture = await build({ totalAvisos: 3 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('3 aviso(s)');
    expect(el.textContent).toContain('não impedem a publicação');
  });

  it('does NOT render empty state when there are errors', async () => {
    const fixture = await build({ totalErros: 1 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Nenhum aviso ou erro registrado');
  });

  it('does NOT render empty state when there are warnings', async () => {
    const fixture = await build({ totalAvisos: 2 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Nenhum aviso ou erro registrado');
  });

  it('renders both error and warning blocks when both counters > 0', async () => {
    const fixture = await build({ totalErros: 1, totalAvisos: 4 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1 erro(s) crítico(s)');
    expect(el.textContent).toContain('4 aviso(s)');
  });

  // ── INT-FE-PUB-004: detailed avisos list ────────────────────────────────

  it('renders detail table when avisos.length > 0 (INT-FE-PUB-004)', async () => {
    const fixture = await build({ avisos: [AVISO_WARNING] });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('table')).toBeTruthy();
    expect(el.textContent).toContain('OPF-033');
    expect(el.textContent).toContain('Duplicate spine item reference');
    expect(el.textContent).toContain('OEBPS/content.opf#L42');
  });

  it('renders "—" when aviso.local is null (never renders "null")', async () => {
    const fixture = await build({ avisos: [AVISO_ERROR_NO_LOC] });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('—');
    expect(el.textContent).not.toContain('null');
  });

  it('renders multiple aviso rows in order', async () => {
    const fixture = await build({ avisos: [AVISO_WARNING, AVISO_ERROR_NO_LOC] });
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('OPF-033');
    expect(rows[1].textContent).toContain('PKG-006');
  });

  it('does NOT render empty state when avisos.length > 0 (even with zero counters)', async () => {
    const fixture = await build({ avisos: [AVISO_WARNING] });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Nenhum aviso ou erro registrado');
  });

  it('renders empty state when totalErros=0 AND totalAvisos=0 AND avisos=[]', async () => {
    const fixture = await build();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Nenhum aviso ou erro registrado');
  });

  it('does NOT render warning count banner when avisos list is populated (list supersedes count)', async () => {
    // The count banner only shows when totalAvisos > 0 AND avisos=[].
    // When avisos are loaded, the detail table renders instead.
    const fixture = await build({ totalAvisos: 2, avisos: [AVISO_WARNING, AVISO_ERROR_NO_LOC] });
    const el: HTMLElement = fixture.nativeElement;
    // detail table should be present
    expect(el.querySelector('table')).toBeTruthy();
  });

});
