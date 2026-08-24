# Build-Plan — Biblioteca De Projetos (biblioteca-de-projetos)
wireframe-ref: §5.1–5.5 | component: BibliotecaDeProjetosComponent | route: /biblioteca-de-projetos | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
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

## Componentes
- Grid de cards de projeto (2 colunas desktop, 1 coluna mobile) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Card: título, autor, contagem de capítulos/imagens, data, badge de status → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Badge de status: Válido (success) · N avisos (warning) · N erros (error) · Rascunho (neutral) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- CTA "Abrir" (primário) e botão de download ícone (secundário) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Botão "Novo projeto" no header (vai para T03) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Estado vazio com CTA → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: ProjetoEditorial[] (filtrado pela editora logada)
- lê: Publicacao (última por projeto
- lê: para badge de status)
- escreve: nenhum nesta tela

## Mock (mock-data.json)
- projetos: 3 instâncias de ProjetoEditorial → mock-data.json#/projetos

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
