# Build-Plan — Editor De Layout Preview (editor-de-layout-preview)
wireframe-ref: §5.1–5.5 | component: EditorDeLayoutPreviewComponent | route: /editor-de-layout-preview | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Editor visualiza o manuscrito renderizado página a página com os estilos aplicados. Ajusta tipografia, espaçamento e hierarquia de títulos em tempo real. Confirma que o resultado visual está correto antes de exportar.

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: Romance das Cidades PAINEL DE ESTILOS
- 1 2 [3 Visualizar] 4
- ● Projetos Tipografia
- Novo Fonte corpo
- projeto [ Serif ▾ ]
- Tamanho: 16px
- Capítulo 1
- O Rio Espaçamento
- Linha: 1.6
- A cidade acordou...
- texto do capítulo Hierarquia
- fluindo natural... H1: 28px

## Componentes
- Área de preview: renderiza capítulo ativo com estilos aplicados → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Paginador: página atual / total de páginas (anterior / próxima) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Painel de estilos lateral (desktop) / gaveta inferior (mobile): → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Select de fonte de corpo (Serif / Sans-serif) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Slider de tamanho de fonte (12px–20px) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Slider de espaçamento de linha (1.2–2.0) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Sliders H1/H2/H3 tamanho → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Slider de margens laterais → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Botão "Exportar" (CTA primário) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Barra de etapas: etapa 3 ativa → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: Manuscrito.estrutura (capítulos renderizados)  (id, projetoId, nomeArquivo, formato, totalCapitulos, totalImagens, trechosNaoParseados, estrutura)
- lê: Metadados (titulo
- lê: autor)
- lê: ConfiguracaoLayout (valores atuais dos sliders)
- escreve: ConfiguracaoLayout (todos os campos ao ajustar slider)
- enum: Manuscrito.formato = docx | markdown

## Mock (mock-data.json)
- manuscrito: 1 instâncias de Manuscrito → mock-data.json#/manuscrito

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
