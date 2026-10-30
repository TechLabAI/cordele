/**
 * pub-nav.config.spec.ts — contract test for PUB_NAV_CONFIG.
 * FE-PUB-005 / SPEC-06 §navigation.
 *
 * Tests what would break the shell if changed:
 *   - moduleKey: used by PubShellIntegrationService to register with NavigationService.
 *     A wrong key silently disconnects PUB from the shell registry.
 *   - stageIndex: positions PUB at the correct step in the pipeline step-bar
 *     (0:PROJ 1:IMP 2:COMP 3:PUB). Wrong index mislights the active step.
 *   - Required fields present and well-typed: missing field causes a runtime
 *     TypeError when the shell reads the config.
 *   - NavConfig shape is closed: unexpected extra fields signal model drift.
 */
import { NavConfig, PUB_NAV_CONFIG } from './pub-nav.config';

describe('PUB_NAV_CONFIG', () => {
  it('satisfies the NavConfig shape at compile time and runtime', () => {
    // Compile-time: assignment would fail if PUB_NAV_CONFIG violates NavConfig.
    const config: NavConfig = PUB_NAV_CONFIG;
    expect(config).toBeDefined();
  });

  it('uses the canonical module key "pub"', () => {
    // NavigationService and step-bar component key on this value.
    // Changing it disconnects PUB from the shell registry without a build error.
    expect(PUB_NAV_CONFIG.moduleKey).toBe('pub');
  });

  it('places PUB at stageIndex 3 (fourth step, 0-indexed)', () => {
    // Pipeline order: 0:Projetos 1:Importar 2:Compor 3:Exportar.
    // Wrong index = wrong step highlighted in the step-bar.
    expect(PUB_NAV_CONFIG.stageIndex).toBe(3);
  });

  it('provides a non-empty stageLabel string', () => {
    expect(typeof PUB_NAV_CONFIG.stageLabel).toBe('string');
    expect(PUB_NAV_CONFIG.stageLabel.length).toBeGreaterThan(0);
  });

  it('provides a non-empty breadcrumbLabel string', () => {
    expect(typeof PUB_NAV_CONFIG.breadcrumbLabel).toBe('string');
    expect(PUB_NAV_CONFIG.breadcrumbLabel.length).toBeGreaterThan(0);
  });

  it('contains only the four NavConfig fields (closed shape)', () => {
    const knownKeys: (keyof NavConfig)[] = [
      'moduleKey',
      'stageIndex',
      'stageLabel',
      'breadcrumbLabel',
    ];
    const actualKeys = Object.keys(PUB_NAV_CONFIG);
    for (const key of actualKeys) {
      expect(knownKeys).toContain(key);
    }
    // Also verify all required fields are present.
    for (const key of knownKeys) {
      expect(actualKeys).toContain(key);
    }
  });
});
