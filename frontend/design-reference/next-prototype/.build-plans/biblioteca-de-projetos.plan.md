# Build-Plan — Biblioteca De Projetos (biblioteca-de-projetos)
wireframe-ref: §5.1–5.5 | page: BibliotecaDeProjetosPage | route: /biblioteca-de-projetos | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Lista todos os projetos editoriais da editora. Ponto de partida para retomar projetos existentes ou iniciar um novo.

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: cordelê [avatar]
- ● Projetos
- Novo Seus projetos [ Novo projeto ]
- projeto
- Romance das Poemas do
- Cidades Sertão
- Eliana Moraes Aécio Ribeiro
- 18 cap 3 img 12 cap 0 img
- 14/06 ● Válido 10/06 ⚠ 1 aviso
- [ Abrir ] [↓] [ Abrir ] [↓]
- Contos Urbanos
- (em andamento)

## Componentes React
- Grid de cards de projeto (2 colunas desktop, 1 coluna mobile) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Card: título, autor, contagem de capítulos/imagens, data, badge de status → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Badge de status: Válido (success) · N avisos (warning) · N erros (error) · Rascunho (neutral) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- CTA "Abrir" (primário) e botão de download ícone (secundário) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Botão "Novo projeto" no header (vai para T03) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Estado vazio com CTA → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: ProjetoEditorial[] (filtrado pela editora logada)
- lê: Publicacao (última por projeto
- lê: para badge de status)
- escreve: nenhum nesta tela

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- projetos: 3 instâncias de ProjetoEditorial → mock-data.json#/projetos

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
