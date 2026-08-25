/**
 * Unit spec for ProjectStatusVO — covers every edge in the legal-transition table
 * from api-contract §7, all idempotent no-ops, and all rejection cases.
 *
 * Zero @nestjs/* / @prisma/client imports (RULE-01 / RULE-02).
 */

import { IllegalStatusTransitionError } from '../errors/illegal-status-transition.error';
import { ProjectStatusVO, ProjetoStatus } from './project-status.vo';

describe('ProjectStatusVO', () => {
  // ---------------------------------------------------------------------------
  // advanceTo — legal transitions (5 forward edges from api-contract §7)
  // ---------------------------------------------------------------------------

  describe('advanceTo() — legal forward transitions', () => {
    it('rascunho → em_composicao (IMP confirms structure)', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.rascunho,
        ProjetoStatus.em_composicao,
      );
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
      expect(result.changed).toBe(true);
    });

    it('em_composicao → publicado (PUB export valid)', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.em_composicao,
        ProjetoStatus.publicado,
      );
      expect(result.newStatus).toBe(ProjetoStatus.publicado);
      expect(result.changed).toBe(true);
    });

    it('em_composicao → com_erros (PUB export failed epubcheck)', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.em_composicao,
        ProjetoStatus.com_erros,
      );
      expect(result.newStatus).toBe(ProjetoStatus.com_erros);
      expect(result.changed).toBe(true);
    });

    it('publicado → com_erros (a later PUB export failed)', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.publicado,
        ProjetoStatus.com_erros,
      );
      expect(result.newStatus).toBe(ProjetoStatus.com_erros);
      expect(result.changed).toBe(true);
    });

    it('com_erros → publicado (a later PUB export succeeded)', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.com_erros,
        ProjetoStatus.publicado,
      );
      expect(result.newStatus).toBe(ProjetoStatus.publicado);
      expect(result.changed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // reopen — legal backward transitions (2 edges via reopen from api-contract §7)
  // ---------------------------------------------------------------------------

  describe('reopen() — legal backward transitions', () => {
    it('publicado → em_composicao (editor opens new revision)', () => {
      const result = ProjectStatusVO.reopen(ProjetoStatus.publicado);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
      expect(result.changed).toBe(true);
    });

    it('com_erros → em_composicao (editor recovers)', () => {
      const result = ProjectStatusVO.reopen(ProjetoStatus.com_erros);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
      expect(result.changed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotency — no-op returns changed=false without throwing
  // ---------------------------------------------------------------------------

  describe('advanceTo() — idempotent no-ops', () => {
    it('advanceTo(rascunho, rascunho) returns changed=false', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.rascunho,
        ProjetoStatus.rascunho,
      );
      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.rascunho);
    });

    it('advanceTo(em_composicao, em_composicao) returns changed=false — IMP idempotency rule (SPEC-02)', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.em_composicao,
        ProjetoStatus.em_composicao,
      );
      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });

    it('advanceTo(publicado, publicado) returns changed=false', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.publicado,
        ProjetoStatus.publicado,
      );
      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.publicado);
    });

    it('advanceTo(com_erros, com_erros) returns changed=false', () => {
      const result = ProjectStatusVO.advanceTo(
        ProjetoStatus.com_erros,
        ProjetoStatus.com_erros,
      );
      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.com_erros);
    });
  });

  describe('reopen() — idempotent no-op', () => {
    it('reopen(em_composicao) returns changed=false', () => {
      const result = ProjectStatusVO.reopen(ProjetoStatus.em_composicao);
      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });
  });

  // ---------------------------------------------------------------------------
  // Rejection cases — IllegalStatusTransitionError thrown
  // ---------------------------------------------------------------------------

  describe('advanceTo() — illegal transitions throw IllegalStatusTransitionError', () => {
    it('advanceTo(rascunho, publicado) throws — composition must precede publication', () => {
      expect(() =>
        ProjectStatusVO.advanceTo(
          ProjetoStatus.rascunho,
          ProjetoStatus.publicado,
        ),
      ).toThrow(IllegalStatusTransitionError);
    });

    it('advanceTo(rascunho, com_erros) throws', () => {
      expect(() =>
        ProjectStatusVO.advanceTo(
          ProjetoStatus.rascunho,
          ProjetoStatus.com_erros,
        ),
      ).toThrow(IllegalStatusTransitionError);
    });

    it('advanceTo(publicado, rascunho) throws — rascunho is initial-only', () => {
      expect(() =>
        ProjectStatusVO.advanceTo(
          ProjetoStatus.publicado,
          ProjetoStatus.rascunho,
        ),
      ).toThrow(IllegalStatusTransitionError);
    });

    it('advanceTo(publicado, em_composicao) throws — use reopen() for the backward edge', () => {
      expect(() =>
        ProjectStatusVO.advanceTo(
          ProjetoStatus.publicado,
          ProjetoStatus.em_composicao,
        ),
      ).toThrow(IllegalStatusTransitionError);
    });

    it('advanceTo(com_erros, rascunho) throws', () => {
      expect(() =>
        ProjectStatusVO.advanceTo(
          ProjetoStatus.com_erros,
          ProjetoStatus.rascunho,
        ),
      ).toThrow(IllegalStatusTransitionError);
    });

    it('thrown error carries from/to/reason fields', () => {
      let caught: IllegalStatusTransitionError | undefined;
      try {
        ProjectStatusVO.advanceTo(
          ProjetoStatus.rascunho,
          ProjetoStatus.publicado,
        );
      } catch (e) {
        caught = e as IllegalStatusTransitionError;
      }
      expect(caught).toBeInstanceOf(IllegalStatusTransitionError);
      expect(caught?.from).toBe(ProjetoStatus.rascunho);
      expect(caught?.to).toBe(ProjetoStatus.publicado);
      expect(caught?.reason).toBeDefined();
    });
  });

  describe('reopen() — illegal transitions throw IllegalStatusTransitionError', () => {
    it('reopen(rascunho) throws — a new project has never been closed', () => {
      expect(() =>
        ProjectStatusVO.reopen(ProjetoStatus.rascunho),
      ).toThrow(IllegalStatusTransitionError);
    });

    it('thrown error from reopen(rascunho) carries from=rascunho', () => {
      let caught: IllegalStatusTransitionError | undefined;
      try {
        ProjectStatusVO.reopen(ProjetoStatus.rascunho);
      } catch (e) {
        caught = e as IllegalStatusTransitionError;
      }
      expect(caught?.from).toBe(ProjetoStatus.rascunho);
    });
  });
});
