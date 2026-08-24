# Build-Plan — Exportacao E Validacao (exportacao-e-validacao)
wireframe-ref: §5.1–5.5 | page: ExportacaoEValidacaoPage | route: /exportacao-e-validacao | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Exibe o processo de geração do ePub e o resultado da validação epubcheck. Se válido: libera download. Se com erros: exibe lista com localização e orientação de correção.

## Regiões / layout (best-effort da §5.2)
- ESTADO: GERANDO
- SIDEBAR TOPBAR: Romance das Cidades 1 2 3 [4 Exportar]
- ● Projetos
- Novo
- projeto Gerando seu ePub...
- Compilando capítulos
- ESTADO: VÁLIDO
- SIDEBAR
- ● Projetos ✓ ePub válido e pronto para download
- projeto romance-das-cidades.epub 1.4 MB
- 156 páginas 18 capítulos 3 imagens
- epubcheck: 0 erros 2 avisos

## Componentes React
- Barra de progresso de geração com status textual → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Painel de resultado: badge de status (válido / avisos / erros) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Resumo do ePub: nome, tamanho, páginas, capítulos, imagens → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Lista de avisos (dobráveis, não bloqueantes) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Lista de erros críticos com: código epubcheck + descrição legível + ação de correção → local → inline em app/{sid}/page.tsx ou components/{sid}/
- CTA primário: "Baixar ePub" (só se válido) ou "Corrigir [localização]" → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Link "Ajustar layout" (volta a T06) → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: Publicacao (gerada nesta sessão — status
- lê: erros
- lê: avisos
- lê: arquivoUrl)
- lê: Manuscrito (totalCapitulos
- lê: totalImagens)
- escreve: Publicacao (criada ao acionar exportação)

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- publicacao: 1 instâncias de Publicacao → mock-data.json#/publicacao

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
