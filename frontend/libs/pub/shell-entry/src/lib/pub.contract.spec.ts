/**
 * pub.contract.spec.ts — Unit tests for PUB shell-entry contract constants.
 * FE-PUB-001 / P1 Foundation acceptance criteria.
 *
 * Verifies:
 *   - PUB_PERMISSION_MAP has exactly pub.view, pub.export, pub.download
 *   - PUB_FEATURE_FLAGS['pub.pdfExport'].defaultState === 'off'
 *   - PUB_NAV_CONFIG.stageIndex === 3 (from pub-navigation)
 */
import { PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS } from './pub.contract';
import { PUB_NAV_CONFIG } from '@cordele/pub-navigation';

describe('PUB shell-entry — contract constants', () => {
  describe('PUB_PERMISSION_MAP', () => {
    it('should have exactly the expected permission keys', () => {
      const keys = Object.keys(PUB_PERMISSION_MAP).sort();
      expect(keys).toEqual(['pub.download', 'pub.export', 'pub.view']);
    });

    it('pub.view should map to pub:read scope', () => {
      expect(PUB_PERMISSION_MAP['pub.view'].beScope).toBe('pub:read');
    });

    it('pub.export should map to pub:write scope', () => {
      expect(PUB_PERMISSION_MAP['pub.export'].beScope).toBe('pub:write');
    });

    it('pub.download should map to pub:read scope', () => {
      expect(PUB_PERMISSION_MAP['pub.download'].beScope).toBe('pub:read');
    });
  });

  describe('PUB_FEATURE_FLAGS', () => {
    it('pub.pdfExport should be off by default (outside MVP)', () => {
      expect(PUB_FEATURE_FLAGS['pub.pdfExport'].defaultState).toBe('off');
    });

    it('pub.rexport should be on by default', () => {
      expect(PUB_FEATURE_FLAGS['pub.rexport'].defaultState).toBe('on');
    });
  });

  describe('PUB_NAV_CONFIG (from pub-navigation)', () => {
    it('stageIndex should be 3 (Exportar is the 4th pipeline step)', () => {
      expect(PUB_NAV_CONFIG.stageIndex).toBe(3);
    });

    it('stageLabel should be Exportar', () => {
      expect(PUB_NAV_CONFIG.stageLabel).toBe('Exportar');
    });

    it('moduleKey should be pub', () => {
      expect(PUB_NAV_CONFIG.moduleKey).toBe('pub');
    });
  });
});
