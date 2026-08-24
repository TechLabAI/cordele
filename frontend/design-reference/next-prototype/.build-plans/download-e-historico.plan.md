# Build-Plan — Download E Historico (download-e-historico)
wireframe-ref: §5.1–5.5 | page: DownloadEHistoricoPage | route: /download-e-historico | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Confirmação de download e histórico de exportações do projeto. Editor pode baixar versões anteriores ou iniciar nova exportação após ajustes.

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: cordelê Projetos / Romance das Cidades
- ● Projetos
- Novo
- projeto Romance das Cidades ● Publicado
- Eliana Moraes
- Histórico de exportações
- 19/06/2026 16:30 ● Válido 1.4 MB [ ↓ Baixar ]
- (versão atual) 0 erros 2 avisos
- 14/06/2026 09:15 ✕ Erros — (inválido)
- 3 erros críticos
- [ Ajustar metadados ] [ Ajustar layout ]
- [ Nova exportação ]

## Componentes React
- Header do projeto: título, autor, badge de status atual → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Lista de exportações: data/hora, status, tamanho, botão de download → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Links de ação: voltar a T05, T06, ou gerar nova exportação (aciona T07) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Botão de download de cada versão (somente versões válidas) → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: ProjetoEditorial (nome
- lê: status)
- lê: Publicacao[] (histórico ordenado por criadoEm desc)
- lê: Metadados (autor)
- escreve: nenhum

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- publicacoes: 2 instâncias de Publicacao → mock-data.json#/publicacoes

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
