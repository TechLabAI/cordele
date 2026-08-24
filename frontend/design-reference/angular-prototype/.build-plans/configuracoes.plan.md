# Build-Plan — Configurações (configuracoes)
wireframe-ref: §5.1–5.5 | component: ConfiguracoesComponent | route: /config | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
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

## Componentes
- Campos de texto: Título*, Autor*, ISBN (opcional), Categoria (opcional) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Select de Idioma (pt, en, es, fr) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Drop zone de imagem de capa com preview miniatura → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Validação inline de campos obrigatórios (marcados com *) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- CTA "Ir para preview" (desabilitado até campos obrigatórios preenchidos) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Barra de etapas: etapa 2 ativa → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: Metadados (existente se projeto já tinha metadados)
- escreve: Metadados.titulo
- escreve: Metadados.autor
- escreve: Metadados.isbn
- escreve: Metadados.idioma
- escreve: Metadados.categoria
- escreve: Metadados.capaUrl

## Mock (mock-data.json)
- metadados: 1 instâncias de Metadados → mock-data.json#/metadados

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
