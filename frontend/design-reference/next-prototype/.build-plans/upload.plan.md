# Build-Plan — Upload (upload)
wireframe-ref: §5.1–5.5 | page: UploadPage | route: /upload | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Editor nomeia o projeto e faz upload do manuscrito (DOCX ou Markdown). Ponto de entrada de dados no sistema.

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: cordelê Projetos / Novo projeto
- ● Projetos [1 Importar] 2 Configurar 3 Visualizar 4 Exportar
- Novo
- ●projeto
- Novo projeto
- Nome do projeto *
- ex.: Romance das Cidades — Aetós 2026
- Manuscrito *
- ↑ Arraste seu arquivo aqui
- ou clique para selecionar
- Formatos aceitos: .docx .md
- Tamanho máximo: 50 MB

## Componentes React
- Campo de texto "Nome do projeto" (obrigatório) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Drop zone de upload (drag-and-drop + click to select) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Barra de progresso de upload + mensagem de status → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Validação inline de tipo de arquivo → local → inline em app/{sid}/page.tsx ou components/{sid}/
- CTA "Importar manuscrito" (desabilitado até nome + arquivo preenchidos) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Barra de etapas no topbar (etapa 1 ativa) → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: nenhum
- escreve: ProjetoEditorial.nome
- escreve: ProjetoEditorial.status=rascunho
- escreve: Manuscrito.nomeArquivo
- escreve: Manuscrito.formato
- escreve: Manuscrito.estrutura (gerada pelo BFF)

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- nenhum: 3 instâncias de Nenhum → mock-data.json#/nenhum

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
