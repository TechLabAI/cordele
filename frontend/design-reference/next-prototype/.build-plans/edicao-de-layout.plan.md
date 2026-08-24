# Build-Plan — Edicao De Layout (edicao-de-layout)
wireframe-ref: §5.1–5.5 | page: EdicaoDeLayoutPage | route: /edicao-de-layout | ai-drawer: não

> Contrato gerado por wireframe-to-react. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Editor visualiza o manuscrito renderizado página a página com os estilos aplicados. Ajusta tipografia, espaçamento e hierarquia de títulos em tempo real. Pode adicionar páginas em branco, inserir imagens e remover páginas. Confirma que o resultado visual está correto antes de exportar.

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: Romance das Cidades PAINEL DE
- 1 2 [3 Edição] 4 ESTILOS
- ● Projetos
- Novo BARRA DE FERRAMENTAS DE EDIÇÃO Tipografia
- projeto [ Página ] [ ↑ Imagem ] [ ✕ Pág. ] Fonte corpo
- Revisão [ Serif ▾ ]
- Metad. Tamanho: 16px
- ●Edição
- Export. Espaçamento
- Histórico Capítulo 1 Linha: 1.6
- O Rio
- Hierarquia

## Componentes React
- **Barra de ferramentas de edição** (nova — entre topbar e conteúdo): → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Botão "Adicionar página" — insere página em branco após a atual (folha de rosto, página de direitos etc.) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Botão "Inserir imagem" — abre file picker (JPG/PNG/SVG), insere imagem no início da página atual → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Botão "Remover página" — modal de confirmação antes de remover; irreversível na sessão → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Área de visualização: renderiza capítulo ativo com estilos aplicados → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Paginador: página atual / total de páginas (anterior / próxima) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Painel de estilos lateral (desktop) / gaveta inferior (mobile): → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Select de fonte de corpo (Serif / Sans-serif) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Slider de tamanho de fonte (12px–20px) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Slider de espaçamento de linha (1.2–2.0) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Sliders H1/H2/H3 tamanho → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Slider de margens laterais → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Botão "Exportar" (CTA primário) → local → inline em app/{sid}/page.tsx ou components/{sid}/
- Barra de etapas: etapa 3 ativa → local → inline em app/{sid}/page.tsx ou components/{sid}/

> RSC por padrão — adicionar `'use client'` só se houver estado/eventos interativos.

## Ligações de dados (data-model.json)
- lê: Manuscrito.estrutura (capítulos renderizados)  (id, projetoId, nomeArquivo, formato, totalCapitulos, totalImagens, trechosNaoParseados, estrutura)
- lê: Metadados (titulo
- lê: autor)
- lê: ConfiguracaoLayout (valores atuais dos sliders)
- escreve: ConfiguracaoLayout (todos os campos ao ajustar slider)
- escreve: Manuscrito.estrutura (ao adicionar/remover páginas — apenas na sessão
- escreve: não persiste no arquivo original)
- enum: Manuscrito.formato = docx | markdown

> Fetch em RSC: `const data = await fetch('/api/...').then(r => r.json())`
> Mutações: Server Actions em `app/{sid}/actions.ts` ou API Route.

## Mock (mock-data.json)
- manuscrito: 1 instâncias de Manuscrito → mock-data.json#/manuscrito

> Importar de `lib/mock-data.ts` — não reinventar `const MOCK` na page.

## Estados obrigatórios
- empty, loading, error
> loading: usar `<Skeleton>` de components/ui/skeleton.tsx
> error: usar `<ErrorBoundary>` ou fallback no layout

## IA inline
- IA não disponível nesta tela.
