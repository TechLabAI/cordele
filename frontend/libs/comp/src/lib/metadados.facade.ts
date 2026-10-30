/**
 * metadados.facade.ts — drives the T05 Configurações screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §1 MetadadosVM / SPEC-04 §2 MetadataFacade state machine.
 * FE-COMP-008: signals, state machine, pessimistic advance, cover sub-state.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: FE-COMP-008 (P2) — complete state machine; pessimistic advance; cover sub-state;
 *          removeCapa; canAdvance (idioma validation); error mapper integration.
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { METADADOS_PORT } from './api/metadados.port';
import { MetadadosDto, MetadadosIdioma } from './models/comp.models';
import { CompUiError, mapCompError, normalizeError } from './comp-error.mapper';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetadadosStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface CoverState {
  /** Transient object-URL for immediate local preview before the server capaUrl arrives. */
  objectUrl: string | null;
  /** Durable URL from the server (present after a successful POST /capa). */
  capaUrl: string | null;
  status: 'idle' | 'uploading' | 'error';
  error: CompUiError | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_IDIOMAS: MetadadosIdioma[] = ['pt', 'en', 'es', 'fr'];

const DEFAULT_FORM: Omit<MetadadosDto, 'projetoId'> = {
  titulo: '',
  autor: '',
  isbn: null,
  idioma: 'pt',
  categoria: null,
  capaUrl: null,
  materialized: false,
};

const DEFAULT_COVER: CoverState = {
  objectUrl: null,
  capaUrl: null,
  status: 'idle',
  error: null,
};

// ── Facade ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MetadadosFacade {
  private readonly port       = inject(METADADOS_PORT);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Stored on load; used by methods that don't receive projetoId (e.g. onCoverRemove). */
  private _projetoId = '';

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status      = signal<MetadadosStatus>('idle');
  private readonly _form        = signal<MetadadosDto>({ ...DEFAULT_FORM } as MetadadosDto);
  private readonly _cover       = signal<CoverState>({ ...DEFAULT_COVER });
  private readonly _error       = signal<CompUiError | null>(null);
  private readonly _fieldErrors = signal<Partial<Record<keyof MetadadosDto, string>>>({});
  private readonly _toast       = signal<string | null>(null);

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status      = this._status.asReadonly();
  readonly form        = this._form.asReadonly();
  readonly cover       = this._cover.asReadonly();
  readonly error       = this._error.asReadonly();
  readonly fieldErrors = this._fieldErrors.asReadonly();
  readonly toast       = this._toast.asReadonly();

  /**
   * True when all required fields are valid:
   *   - titulo non-empty
   *   - autor non-empty
   *   - idioma ∈ { pt, en, es, fr }
   * FE-COMP-008 / SPEC-04 §2.
   */
  readonly canAdvance = computed(() => {
    const f = this._form();
    return (
      f.titulo.trim().length > 0 &&
      f.autor.trim().length > 0 &&
      VALID_IDIOMAS.includes(f.idioma)
    );
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Load metadados from the server on T05 entry.
   * materialized:false → form hydrated with defaults (idioma='pt').
   */
  load(projetoId: string): void {
    this._projetoId = projetoId;
    this._status.set('loading');
    this._error.set(null);
    this._fieldErrors.set({});
    this._toast.set(null);

    this.port.get(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this._form.set(dto.materialized ? dto : { ...DEFAULT_FORM, projetoId, materialized: false });
          // Hydrate cover capaUrl from server data
          this._cover.update(c => ({ ...c, capaUrl: dto.capaUrl, objectUrl: null }));
          this._status.set('ready');
        },
        error: (err: unknown) => {
          this._error.set(mapCompError(normalizeError(err)));
          this._status.set('error');
        },
      });
  }

  /** Re-issue the GET when the user presses "Tentar novamente". */
  onRetry(): void {
    if (this._projetoId) {
      this.load(this._projetoId);
    }
  }

  /**
   * Update a single form field locally — no network call.
   * SPEC-04 §2: live repaint is client-only; persistence happens on advance.
   */
  onFieldChange<K extends keyof MetadadosDto>(field: K, value: MetadadosDto[K]): void {
    this._form.update(f => ({ ...f, [field]: value }));
    // Clear inline field error for this field on user edit
    if (field in this._fieldErrors()) {
      this._fieldErrors.update(fe => {
        const copy = { ...fe };
        delete copy[field];
        return copy;
      });
    }
  }

  /**
   * Upload a cover image.
   * Creates a transient objectUrl for immediate preview, then POSTs to the server.
   * On 413/415: sets cover.error inline; form remains intact (D-L).
   * On success: swaps objectUrl → capaUrl; revokes the objectUrl.
   */
  onCoverSelect(file: File): void {
    // Create transient object-URL for immediate local preview
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      // URL.createObjectURL may not be available in all environments (e.g. some test runners)
    }

    this._cover.update(c => ({
      ...c,
      objectUrl,
      status: 'uploading',
      error: null,
    }));

    this.port.uploadCapa(this._projetoId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          // Swap transient objectUrl for durable capaUrl; revoke objectUrl to avoid memory leak
          if (objectUrl) {
            try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
          }
          this._cover.set({
            objectUrl: null,
            capaUrl: res.capaUrl,
            status: 'idle',
            error: null,
          });
          // Keep capaUrl in sync with form
          this._form.update(f => ({ ...f, capaUrl: res.capaUrl }));
        },
        error: (err: unknown) => {
          const uiErr = mapCompError(normalizeError(err));
          // Cover errors are inline on the drop zone; they do NOT clear the objectUrl
          // so the user can still see what file they attempted to upload.
          this._cover.update(c => ({ ...c, status: 'error', error: uiErr }));
        },
      });
  }

  /**
   * Remove the cover image.
   * DELETEs /capa on the server and clears the local cover state.
   * Idempotent: safe to call even when capaUrl is already null.
   */
  onCoverRemove(): void {
    if (!this._projetoId) return;

    this.port.removeCapa(this._projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Revoke any lingering objectUrl
          const obj = this._cover().objectUrl;
          if (obj) {
            try { URL.revokeObjectURL(obj); } catch { /* ignore */ }
          }
          this._cover.set({ ...DEFAULT_COVER });
          this._form.update(f => ({ ...f, capaUrl: null }));
        },
        error: (err: unknown) => {
          // Non-blocking; surface as toast
          const uiErr = mapCompError(normalizeError(err));
          this._toast.set(uiErr.message);
        },
      });
  }

  /**
   * Pessimistic advance from T05 → T06.
   * PUT metadados and AWAIT 200 before navigating; on failure, local edits are preserved.
   * SPEC-04 §2 [comp-advance-persist] / [comp-advance-persist-fail].
   */
  onAdvanceToLayout(): void {
    if (!this.canAdvance()) return;

    this._status.set('saving');
    this._fieldErrors.set({});
    this._toast.set(null);

    this.port.update(this._projetoId, this._form())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this._form.set(dto);
          this._status.set('ready');
          // Navigate ONLY after the 200 is received (pessimistic)
          void this.router.navigate([
            '/comp', 'projetos', this._projetoId, 'editor-de-layout-preview',
          ]);
        },
        error: (err: unknown) => {
          const uiErr = mapCompError(normalizeError(err));
          this._status.set('ready');  // restore editable state; local edits are preserved

          if (uiErr.channel === 'inline-field') {
            // 400 validation — surface field-level feedback; do NOT navigate
            this._fieldErrors.set({ titulo: uiErr.message });
          } else {
            // 5xx / network — surface as toast; local edits preserved (nothing to roll back)
            this._toast.set(uiErr.message || 'Não foi possível salvar. Tente novamente.');
          }
        },
      });
  }

  // ── Legacy aliases (backward-compat with P1 callers / feature components) ──

  /**
   * @deprecated Use `cover().objectUrl ?? cover().capaUrl` in templates.
   * Kept for prototype component compatibility; remove when P3 rewires T05 template.
   */
  readonly capaPreview = computed(
    () => this._cover().objectUrl ?? this._cover().capaUrl ?? '',
  );

  /**
   * @deprecated Use canAdvance.
   * Kept for prototype component compatibility; remove when P3 rewires T05 template.
   */
  readonly valido = computed(() => this.canAdvance());

  /** @deprecated Use onFieldChange() */
  updateField<K extends keyof MetadadosDto>(campo: K, valor: MetadadosDto[K]): void {
    this.onFieldChange(campo, valor);
  }

  /** @deprecated Use onAdvanceToLayout(). Accepts projetoId for backward-compat; ignored (stored from load). */
  avancar(_projetoId?: string): void {
    this.onAdvanceToLayout();
  }

  /** @deprecated Use onCoverSelect(). Accepts projetoId for backward-compat; ignored (stored from load). */
  onCapa(_projetoId: string, file: File): void {
    this.onCoverSelect(file);
  }

  /** @deprecated Use onCoverRemove() */
  clearCapa(): void {
    this.onCoverRemove();
  }
}
