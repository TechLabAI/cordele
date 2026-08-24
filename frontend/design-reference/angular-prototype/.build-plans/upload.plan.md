# Build-Plan — Upload (upload)
wireframe-ref: §5.1–5.5 | component: UploadComponent | route: /upload | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
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

## Componentes
- Campo de texto "Nome do projeto" (obrigatório) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Drop zone de upload (drag-and-drop + click to select) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Barra de progresso de upload + mensagem de status → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Validação inline de tipo de arquivo → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- CTA "Importar manuscrito" (desabilitado até nome + arquivo preenchidos) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Barra de etapas no topbar (etapa 1 ativa) → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: nenhum
- escreve: ProjetoEditorial.nome
- escreve: ProjetoEditorial.status=rascunho
- escreve: Manuscrito.nomeArquivo
- escreve: Manuscrito.formato
- escreve: Manuscrito.estrutura (gerada pelo BFF)

## Mock (mock-data.json)
- nenhum: 3 instâncias de Nenhum → mock-data.json#/nenhum

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
