# Build-Plan — Revisao De Estrutura (revisao-de-estrutura)
wireframe-ref: §5.1–5.5 | component: RevisaoDeEstruturaComponent | route: /revisao-de-estrutura | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
> arquivo + as fatias referenciadas de `../../data-model.json` e
> `../../mock-data.json`. Não voltar ao wireframe. DESCARTÁVEL (regenera com --force).

## Objetivo
Exibe a estrutura detectada no manuscrito após o parsing. Editor confirma, ignora trechos não reconhecidos ou decide reimportar. Garante o princípio 2.1 (nada some sem aviso).

## Regiões / layout (best-effort da §5.2)
- SIDEBAR TOPBAR: cordelê Projetos / Romance das Cidades
- [1 Importar] [2 Configurar] 3 Visualizar 4 Exportar
- ● Projetos
- Novo
- projeto Estrutura detectada romance-das-cidades.docx
- ✓ 18 capítulos encontrados
- ✓ 3 imagens referenciadas
- ⚠ 2 trechos com formatação não reconhecida
- SUMÁRIO PENDÊNCIAS
- ▸ Capítulo 1 — O Rio ⚠ Pág. 34: tabela
- ▸ Capítulo 2 — A Cidade de formatação
- ▸ Capítulo 3 — O Retorno não suportada.

## Componentes
- Resumo de parsing: contadores de capítulos, imagens, pendências → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Lista de capítulos detectados (sumário colapsável) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Painel de pendências: cada trecho não reconhecido com localização, descrição e ações (Ignorar / Ver detalhes) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- CTA "Confirmar" (avança para T05) — habilitado mesmo com pendências (editor decide) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Link "Reimportar outro arquivo" (volta a T03) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Barra de etapas no topbar (etapa 1 completa, etapa 2 selecionada) → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: Manuscrito (estrutura
- lê: totalCapitulos
- lê: totalImagens
- lê: trechosNaoParseados)
- escreve: nenhum (read-only — manifesto do parsing)

## Mock (mock-data.json)
- manuscrito: 1 instâncias de Manuscrito → mock-data.json#/manuscrito

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
