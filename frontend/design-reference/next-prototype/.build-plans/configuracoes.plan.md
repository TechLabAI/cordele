# Build-Plan — Configurações (configuracoes)
wireframe-ref: §5.1–5.5 | page: ConfiguracoesPage | route: /configuracoes | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Editor preenche os metadados editoriais: título, autor, ISBN, capa, idioma, categoria. Campos obrigatórios são claramente marcados.

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: cordelê Projetos / Romance das Cidades
- 1 Importar [2 Configurar] 3 Visualizar 4 Exportar
- ● Projetos
- Novo
- projeto Metadados do livro
- Título * Autor *
- Romance das Eliana Moraes
- Cidades
- ISBN Idioma *
- 978-65-... Português ▾
- Capa do livro
- Arraste uma imagem ou clique

## Componentes React
- Campos de texto: Título*, Autor*, ISBN (opcional), Categoria (opcional) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Select de Idioma (pt, en, es, fr) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Drop zone de imagem de capa com preview miniatura → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Validação inline de campos obrigatórios (marcados com *) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- CTA "Ir para preview" (desabilitado até campos obrigatórios preenchidos) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Barra de etapas: etapa 2 ativa → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: Metadados (existente se projeto já tinha metadados)
- escreve: Metadados.titulo
- escreve: Metadados.autor
- escreve: Metadados.isbn
- escreve: Metadados.idioma
- escreve: Metadados.categoria
- escreve: Metadados.capaUrl

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- metadados: 1 instâncias de Metadados → mock-data.json#/metadados

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
