# Build-Plan — Download E Historico (download-e-historico)
wireframe-ref: §5.1–5.5 | component: DownloadEHistoricoComponent | route: /download-e-historico | ai-drawer: não

> Contrato gerado por wireframe-to-angular. O implementer lê **só** este
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

## Componentes
- Header do projeto: título, autor, badge de status atual → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Lista de exportações: data/hora, status, tamanho, botão de download → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Links de ação: voltar a T05, T06, ou gerar nova exportação (aciona T07) → local → inline no .component.ts (compor da biblioteca DS app/ui/)
- Botão de download de cada versão (somente versões válidas) → local → inline no .component.ts (compor da biblioteca DS app/ui/)

## Ligações de dados (data-model.json)
- lê: ProjetoEditorial (nome
- lê: status)
- lê: Publicacao[] (histórico ordenado por criadoEm desc)
- lê: Metadados (autor)
- escreve: nenhum

## Mock (mock-data.json)
- publicacoes: 2 instâncias de Publicacao → mock-data.json#/publicacoes

> Importar do `mock-data.json` — **não** reinventar `const MOCK` no componente.

## Estados obrigatórios
- empty, loading, error

## IA inline
- IA não disponível nesta tela.
