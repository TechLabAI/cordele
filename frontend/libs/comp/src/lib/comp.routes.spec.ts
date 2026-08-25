/**
 * comp.routes.spec.ts — smoke test: COMP_ROUTES array is defined and non-empty.
 * Full route/guard integration tested by Layer 2 (FE-COMP-013, FE-COMP-019, FE-COMP-020).
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { describe, expect, it } from 'vitest';
import { COMP_ROUTES } from './comp.routes';

describe('COMP_ROUTES', () => {
  it('should define at least two named routes', () => {
    const namedRoutes = COMP_ROUTES.filter(r => r.path && r.path.length > 0 && r.path !== '**');
    expect(namedRoutes.length).toBeGreaterThanOrEqual(2);
  });

  it('should include the config route for T05', () => {
    const route = COMP_ROUTES.find(r => r.path?.includes('config'));
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('should include the editor route for T06', () => {
    const route = COMP_ROUTES.find(r => r.path?.includes('editor-de-layout-preview'));
    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();
  });

  it('should apply guards to both feature routes', () => {
    const featureRoutes = COMP_ROUTES.filter(r =>
      r.path?.includes('config') || r.path?.includes('editor'),
    );
    for (const route of featureRoutes) {
      expect(Array.isArray(route.canActivate)).toBe(true);
      expect((route.canActivate as unknown[]).length).toBeGreaterThanOrEqual(1);
    }
  });
});
