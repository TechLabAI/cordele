import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

// T01 — Entrada (momento-marca: true) — full-bleed, fora do shell

const FEATURES = [
  {
    icon: 'description',
    color: 'oklch(58% 0.19 245)',
    bg: 'oklch(58% 0.19 245 / 0.10)',
    label: 'Importa .docx e .md',
    desc: 'Arraste seu manuscrito. Cordelê detecta a estrutura automaticamente.',
  },
  {
    icon: 'palette',
    color: 'oklch(55% 0.22 290)',
    bg: 'oklch(55% 0.22 290 / 0.10)',
    label: 'Layout editorial',
    desc: 'Tipografia, margens e espaçamento ajustados em tempo real, página a página.',
  },
  {
    icon: 'verified',
    color: 'oklch(58% 0.18 145)',
    bg: 'oklch(58% 0.18 145 / 0.10)',
    label: 'ePub 3 validado',
    desc: 'epubcheck embutido. Arquivo pronto para Kindle, Apple Books e distribuidoras.',
  },
];

@Component({
  selector: 'app-entrada',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-screen flex flex-col overflow-hidden"
         style="background: oklch(11% 0.06 245); font-family: var(--font-body, 'Inter', sans-serif);">

      <!-- ── Camadas decorativas ────────────────────────────── -->

      <!-- Gradiente radial topo-esquerda — brilho brand -->
      <div class="pointer-events-none absolute"
           style="top:-160px;left:-80px;width:640px;height:640px;
                  border-radius:50%;
                  background:radial-gradient(circle,oklch(58% 0.19 245 / 0.18) 0%,transparent 70%);
                  filter:blur(20px);"></div>

      <!-- Gradiente radial inferior-direita — toque de profundidade -->
      <div class="pointer-events-none absolute"
           style="bottom:-120px;right:-60px;width:500px;height:500px;
                  border-radius:50%;
                  background:radial-gradient(circle,oklch(55% 0.22 290 / 0.10) 0%,transparent 70%);
                  filter:blur(30px);"></div>

      <!-- "ê" decorativo tipográfico -->
      <span aria-hidden="true"
            class="pointer-events-none select-none absolute font-display font-bold leading-none"
            style="font-family:'Poppins',sans-serif;
                   font-size:clamp(18rem,45vw,42rem);
                   color:oklch(20% 0.10 245);
                   right:-0.06em;bottom:-0.22em;
                   line-height:1;">ê</span>

      <!-- Linha de borda no topo (acento brand) -->
      <div style="height:3px;background:linear-gradient(90deg,oklch(58% 0.19 245),oklch(48% 0.22 220),transparent);flex-shrink:0;"></div>

      <!-- ── Navbar mínima — só link de acesso ──────────────── -->
      <header class="relative z-10 flex items-center justify-end px-8 sm:px-16 py-5 flex-shrink-0">
        <a routerLink="/biblioteca-de-projetos"
           class="text-sm font-medium transition-opacity hover:opacity-70"
           style="color:oklch(55% 0.015 265);">
          Entrar na conta →
        </a>
      </header>

      <!-- ── Hero ───────────────────────────────────────────── -->
      <main class="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-4">

        <!-- Logo com glow -->
        <div class="relative mb-6 flex items-center justify-center">
          <!-- Glow difuso sob o logo -->
          <div class="absolute pointer-events-none"
               style="width:340px;height:120px;
                      background:radial-gradient(ellipse,oklch(58% 0.19 245 / 0.28) 0%,transparent 70%);
                      filter:blur(18px);
                      top:50%;left:50%;transform:translate(-50%,-50%);"></div>
          <img src="assets/logo_white.png" alt="Cordelê"
               style="position:relative;height:clamp(80px,14vw,130px);width:auto;
                      filter:drop-shadow(0 0 32px oklch(58% 0.19 245 / 0.50));" />
        </div>

        <!-- Badge -->
        <div class="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
             style="background:oklch(58% 0.19 245 / 0.12);
                    border:1px solid oklch(58% 0.19 245 / 0.30);">
          <span class="inline-block size-1.5 rounded-full" style="background:oklch(65% 0.19 245);"></span>
          <span class="text-xs font-semibold tracking-wide" style="color:oklch(72% 0.15 245);">
            ePub publishing · versão beta
          </span>
        </div>

        <!-- Headline -->
        <h1 class="font-display font-bold leading-tight max-w-3xl"
            style="font-family:'Poppins',sans-serif;
                   font-size:clamp(2.2rem,5.5vw,4rem);
                   color:oklch(97% 0.005 265);
                   letter-spacing:-0.02em;">
          Seu manuscrito.<br>
          <span style="color:oklch(65% 0.19 245);">Publicado.</span>
        </h1>

        <!-- Subheadline -->
        <p class="mt-4 max-w-xl text-lg leading-relaxed"
           style="color:oklch(60% 0.015 265);">
          Cordelê transforma arquivos <code style="font-size:0.9em;color:oklch(72% 0.15 245);">.docx</code>
          ou <code style="font-size:0.9em;color:oklch(72% 0.15 245);">.md</code>
          em ePub 3 validado — com layout editorial ajustável e sem intermediários.
        </p>

        <!-- Transformação visual -->
        <div class="mt-8 flex items-center gap-3 flex-wrap justify-center">
          <!-- Arquivo de entrada -->
          <div class="flex items-center gap-2 rounded-xl px-4 py-2.5"
               style="background:oklch(18% 0.08 245);border:1px solid oklch(30% 0.12 245);">
            <span class="material-symbols-outlined" style="font-size:20px;color:oklch(65% 0.015 265);">article</span>
            <span class="text-sm font-mono" style="color:oklch(75% 0.015 265);">romance.docx</span>
          </div>

          <!-- Seta de transformação -->
          <div class="flex items-center gap-1">
            <div style="height:2px;width:24px;background:linear-gradient(90deg,oklch(40% 0.15 245),oklch(65% 0.19 245));"></div>
            <span class="material-symbols-outlined" style="font-size:20px;color:oklch(65% 0.19 245);">arrow_forward</span>
          </div>

          <!-- Cordelê badge -->
          <div class="flex items-center gap-2 rounded-xl px-4 py-2.5"
               style="background:oklch(58% 0.19 245 / 0.12);border:1px solid oklch(58% 0.19 245 / 0.35);">
            <span class="material-symbols-outlined" style="font-size:18px;color:oklch(65% 0.19 245);">auto_fix_high</span>
            <span class="text-sm font-medium" style="color:oklch(72% 0.15 245);">Cordelê</span>
          </div>

          <!-- Seta -->
          <div class="flex items-center gap-1">
            <div style="height:2px;width:24px;background:linear-gradient(90deg,oklch(45% 0.15 145),oklch(65% 0.19 145));"></div>
            <span class="material-symbols-outlined" style="font-size:20px;color:oklch(65% 0.19 145);">arrow_forward</span>
          </div>

          <!-- Arquivo de saída -->
          <div class="flex items-center gap-2 rounded-xl px-4 py-2.5"
               style="background:oklch(58% 0.18 145 / 0.10);border:1px solid oklch(58% 0.18 145 / 0.35);">
            <span class="material-symbols-outlined" style="font-size:20px;color:oklch(65% 0.19 145);">import_contacts</span>
            <span class="text-sm font-mono" style="color:oklch(72% 0.17 145);">romance.epub</span>
            <span class="material-symbols-outlined" style="font-size:14px;color:oklch(65% 0.19 145);">verified</span>
          </div>
        </div>

        <!-- CTAs -->
        <div class="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <a routerLink="/upload"
             class="inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.02]"
             style="background:oklch(65% 0.19 245);
                    color:oklch(11% 0.06 245);
                    box-shadow:0 0 28px oklch(58% 0.19 245 / 0.30);">
            <span class="material-symbols-outlined" style="font-size:18px;">upload_file</span>
            Enviar meu manuscrito
          </a>
          <a routerLink="/biblioteca-de-projetos"
             class="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium transition-opacity hover:opacity-70"
             style="color:oklch(65% 0.015 265);
                    border:1px solid oklch(32% 0.08 265);">
            <span class="material-symbols-outlined" style="font-size:16px;">library_books</span>
            Ver projetos
          </a>
        </div>

      </main>

      <!-- ── Features ───────────────────────────────────────── -->
      <section class="relative z-10 px-6 sm:px-16 pb-12 flex-shrink-0">
        <div class="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          @for (f of features; track f.label) {
            <div class="rounded-2xl p-5"
                 style="background:oklch(16% 0.07 245 / 0.70);
                        border:1px solid oklch(28% 0.12 245 / 0.60);
                        backdrop-filter:blur(10px);">
              <div class="mb-3 inline-flex size-10 items-center justify-center rounded-xl"
                   [style]="'background:' + f.bg + ';border:1px solid ' + f.color + '/0.25'">
                <span class="material-symbols-outlined" [style]="'font-size:20px;color:' + f.color">{{ f.icon }}</span>
              </div>
              <h3 class="text-sm font-bold mb-1" style="color:oklch(92% 0.005 265);">{{ f.label }}</h3>
              <p class="text-xs leading-relaxed" style="color:oklch(55% 0.012 265);">{{ f.desc }}</p>
            </div>
          }
        </div>
      </section>

      <!-- ── Footer ─────────────────────────────────────────── -->
      <footer class="relative z-10 text-center pb-5 text-xs flex-shrink-0"
              style="color:oklch(30% 0.06 265);">
        © 2026 Cordelê · Editora Aetós
      </footer>

    </div>
  `,
})
export class EntradaComponent {
  readonly features = FEATURES;
}
