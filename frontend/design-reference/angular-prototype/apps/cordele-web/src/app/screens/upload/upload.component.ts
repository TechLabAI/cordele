import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

// Contrato: .build-plans/upload.plan.md
// T03 — Novo Projeto / Upload — campo nome, drag-drop, progresso, validação de tipo

type UploadState = 'idle' | 'uploading' | 'done' | 'error';
const ALLOWED = ['.docx', '.md'];
const MAX_MB = 50;

const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Visualizar' }, { n: 4, label: 'Exportar' },
];

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Barra de etapas -->
      <nav class="flex items-center gap-1 mb-10 text-sm">
        @for (step of steps; track step.n) {
          <span class="flex items-center gap-1.5" [style]="stepStyle(step.n)">
            <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                  [style]="dotStyle(step.n)">{{ step.n }}</span>
            {{ step.label }}
          </span>
          @if (!$last) { <span class="mx-2" style="color:var(--border-strong)">›</span> }
        }
      </nav>

      <div class="mb-8" style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
        <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">Novo projeto</h1>
      </div>

      <!-- Nome do projeto -->
      <div class="mb-6">
        <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
          Nome do projeto <span style="color:var(--color-error)">*</span>
        </label>
        <input type="text"
               placeholder="ex.: Romance das Cidades — Aetós 2026"
               [value]="nome()"
               (input)="nome.set($any($event.target).value)"
               class="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
               style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
               onfocus="this.style.borderColor='var(--color-brand)'"
               onblur="this.style.borderColor='var(--border-default)'"/>
        @if (nome().length > 0 && nome().trim().length < 3) {
          <p class="mt-1 text-xs flex items-center gap-1" style="color:var(--color-error)">
            <span class="material-symbols-outlined" style="font-size:13px;">error</span>
            Informe pelo menos 3 caracteres.
          </p>
        }
      </div>

      <!-- Drop zone / progresso / sucesso -->
      <div class="mb-2">
        <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
          Manuscrito <span style="color:var(--color-error)">*</span>
        </label>

        @if (state() === 'idle' || state() === 'error') {
          <div class="flex flex-col items-center justify-center rounded-xl py-14 px-8 text-center cursor-pointer transition-all"
               style="border:2px dashed var(--border-default);background:var(--bg-surface);"
               (dragover)="$event.preventDefault()"
               (drop)="onDrop($event)"
               (click)="fileInput.click()"
               onmouseenter="this.style.borderColor='var(--color-brand)';this.style.background='var(--color-brand-subtle)'"
               onmouseleave="this.style.borderColor='var(--border-default)';this.style.background='var(--bg-surface)'">
            <span class="material-symbols-outlined text-4xl mb-3" style="color:var(--text-tertiary)">upload_file</span>
            <p class="text-sm font-medium" style="color:var(--text-secondary)">
              Arraste seu arquivo aqui ou
              <span style="color:var(--color-brand)">clique para selecionar</span>
            </p>
            <p class="text-xs mt-2" style="color:var(--text-tertiary)">
              Formatos aceitos: .docx · .md · Tamanho máximo: {{ MAX_MB }} MB
            </p>
          </div>
          <input #fileInput type="file" accept=".docx,.md" class="hidden" (change)="onFileChange($event)"/>
        }

        @if (state() === 'error') {
          <p class="mt-2 text-xs flex items-center gap-1" style="color:var(--color-error)">
            <span class="material-symbols-outlined" style="font-size:13px;">error</span> {{ errMsg() }}
          </p>
        }

        @if (state() === 'uploading') {
          <div class="rounded-xl p-5" style="background:var(--bg-surface);border:1px solid var(--border-subtle);">
            <div class="flex items-center gap-3 mb-3">
              <span class="material-symbols-outlined" style="color:var(--color-brand);font-size:20px;">description</span>
              <span class="text-sm font-medium flex-1" style="color:var(--text-primary)">{{ arquivo() }}</span>
              <span class="text-xs" style="color:var(--text-tertiary)">{{ pct() }}%</span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--bg-surface-active);">
              <div class="h-full rounded-full transition-all" style="background:var(--color-brand);"
                   [style.width]="pct() + '%'"></div>
            </div>
            <p class="mt-2 text-xs" style="color:var(--text-secondary)">Fazendo upload e analisando estrutura…</p>
          </div>
        }

        @if (state() === 'done') {
          <div class="flex items-center gap-3 rounded-xl p-4"
               style="background:oklch(58% 0.18 145 / 0.08);border:1px solid oklch(58% 0.18 145 / 0.3);">
            <span class="material-symbols-outlined" style="color:oklch(35% 0.14 145);font-size:20px;">check_circle</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate" style="color:oklch(35% 0.14 145)">{{ arquivo() }}</p>
              <p class="text-xs" style="color:oklch(50% 0.12 145)">Arquivo pronto</p>
            </div>
            <button (click)="reset()" class="text-xs underline" style="color:oklch(45% 0.12 145)">Remover</button>
          </div>
        }
      </div>

      <!-- CTAs -->
      <div class="mt-8 flex items-center justify-end gap-4">
        <a routerLink="/biblioteca-de-projetos" class="text-sm" style="color:var(--text-secondary)">Cancelar</a>
        <button [disabled]="!canSubmit()"
                (click)="importar()"
                class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity"
                [style]="canSubmit()
                  ? 'background:var(--color-brand);color:var(--text-on-brand);'
                  : 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;'">
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
          Importar manuscrito
        </button>
      </div>

    </div>
  `,
})
export class UploadComponent {
  readonly MAX_MB = MAX_MB;
  readonly steps = STEPS;

  nome    = signal('');
  arquivo = signal('');
  state   = signal<UploadState>('idle');
  pct     = signal(0);
  errMsg  = signal('');

  canSubmit = computed(() => this.nome().trim().length >= 3 && this.state() === 'done');

  stepStyle(n: number) {
    if (n === 1) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }
  dotStyle(n: number) {
    if (n === 1) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) this.processFile(f);
  }
  onFileChange(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.processFile(f);
  }
  processFile(f: File) {
    const ext = '.' + f.name.split('.').pop()!.toLowerCase();
    if (!ALLOWED.includes(ext)) {
      this.state.set('error');
      this.errMsg.set(`Formato não suportado: ${ext}. Use .docx ou .md.`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      this.state.set('error');
      this.errMsg.set(`Arquivo muito grande (${(f.size/1024/1024).toFixed(1)} MB). Limite: ${MAX_MB} MB.`);
      return;
    }
    this.arquivo.set(f.name);
    this.state.set('uploading');
    let p = 0;
    const t = setInterval(() => {
      p += 25; this.pct.set(p);
      if (p >= 100) { clearInterval(t); this.state.set('done'); }
    }, 280);
  }
  reset() { this.state.set('idle'); this.arquivo.set(''); this.pct.set(0); }
  importar() { /* navegação real no handoff */ }
}
