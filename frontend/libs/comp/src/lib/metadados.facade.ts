/**
 * metadados.facade.ts — drives the T05 Configurações screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §1 MetadadosVM.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { METADADOS_PORT } from './api/metadados.port';
import { MetadadosDto } from './models/comp.models';

export type MetadadosStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

const DEFAULT_FORM: MetadadosDto = {
  titulo: '',
  autor: '',
  isbn: null,
  idioma: 'pt',
  categoria: null,
  capaUrl: null,
  materialized: false,
};

@Injectable({ providedIn: 'root' })
export class MetadadosFacade {
  private readonly port       = inject(METADADOS_PORT);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status     = signal<MetadadosStatus>('idle');
  private readonly _form       = signal<MetadadosDto>({ ...DEFAULT_FORM });
  private readonly _error      = signal<string | null>(null);
  private readonly _capaPreview = signal<string>('');

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status      = this._status.asReadonly();
  readonly form        = this._form.asReadonly();
  readonly error       = this._error.asReadonly();
  readonly capaPreview = this._capaPreview.asReadonly();

  /** True only when required fields (titulo + autor) are filled. */
  readonly valido = computed(
    () => this._form().titulo.trim().length > 0 && this._form().autor.trim().length > 0,
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  load(projetoId: string): void {
    this._status.set('loading');
    this._error.set(null);
    this.port.get(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this._form.set(dto);
          if (dto.capaUrl) this._capaPreview.set(dto.capaUrl);
          this._status.set('ready');
        },
        error: err => {
          this._error.set(err?.message ?? 'Erro ao carregar metadados');
          this._status.set('error');
        },
      });
  }

  updateField(campo: keyof MetadadosDto, valor: unknown): void {
    this._form.update(f => ({ ...f, [campo]: valor }));
  }

  save(projetoId: string): void {
    this._status.set('saving');
    this._error.set(null);
    this.port.update(projetoId, this._form())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this._form.set(dto);
          this._status.set('ready');
        },
        error: err => {
          this._error.set(err?.message ?? 'Erro ao salvar metadados');
          this._status.set('error');
        },
      });
  }

  onCapa(projetoId: string, file: File): void {
    const reader = new FileReader();
    reader.onload = ev => this._capaPreview.set((ev.target?.result ?? '') as string);
    reader.readAsDataURL(file);

    this.port.uploadCapa(projetoId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this._form.update(f => ({ ...f, capaUrl: res.capaUrl }));
        },
        error: err => {
          // Non-blocking: capa upload failure surfaces as an error message
          this._error.set(err?.message ?? 'Erro ao enviar capa');
        },
      });
  }

  clearCapa(): void {
    this._capaPreview.set('');
    this._form.update(f => ({ ...f, capaUrl: null }));
  }

  /**
   * Navigate to the layout-preview step (T06).
   * Triggers a save before navigation (pesimista write — SPEC-05 §3).
   */
  avancar(projetoId: string): void {
    if (!this.valido()) return;
    this.save(projetoId);
    this.router.navigate(['/comp', 'projetos', projetoId, 'editor-de-layout-preview']);
  }
}
