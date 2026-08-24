# Cordelê — Angular Prototype

Workspace gerado automaticamente pelo `wireframe-to-angular` a partir do `wireframe.md`.

## Início rápido

```bash
npm install
npm audit fix          # corrige CVEs auto-fixáveis nas deps de build
npx nx serve cordele-web
```

Acesse `http://localhost:4200` após o servidor iniciar.

> **Sobre vulnerabilidades de npm:** as CVEs reportadas por `npm audit` estão em
> **devDependencies** (build tooling do Angular/Nx) e **não afetam o bundle de produção**.
> O `package.json` inclui uma seção `overrides` que força versões corrigidas das deps
> transitivas mais críticas (`tar`, `semver`, `micromatch`, `path-to-regexp`).
> Execute `npm audit fix` após o install para aplicar as correções restantes.

## Estrutura de estilos (Tailwind v4 + Design System)

Sem SCSS. Os tokens do design system vivem em `theme.css` (bloco `@theme`, oklch — ver `plans/design-system/FORMAT.md §2`) e o Tailwind v4 os transforma em utilitários (`--color-brand` → `bg-brand`; `--radius-card` → `rounded-card`; `--font-display` → `font-display`).

1. **Tokens** (`apps/<proj>-web/src/theme.css`) — espelho de `design/design-system/theme.css`. `styles.css` faz `@import "tailwindcss"; @import "./theme.css"`.
2. **Biblioteca DS** (`apps/<proj>-web/src/app/ui/`) — componentes standalone token-driven: `ds-button`, `ds-badge`, `ds-card`, `ds-kpi`, `ds-input` (fiéis a `plans/design-system/ds/components.jsx`). Componentes curados à mão (`tab-bar`, `modal`) convivem aqui e **não** são sobrescritos pela geração.
3. **Shell e Telas** (`app/shell/`, `app/screens/<id>/`) — componentes standalone com utilitários Tailwind inline; as telas compõem a partir da biblioteca DS.

## Telas

| ID | Label | Rota | Componente | Wireframe ref |
|---|---|---|---|---|
| `entrada` | Entrada | `/entrada` | `EntradaComponent` | §5.1–5.5 |
| `biblioteca-de-projetos` | Biblioteca De Projetos | `/biblioteca-de-projetos` | `BibliotecaDeProjetosComponent` | §5.1–5.5 |
| `upload` | Upload | `/upload` | `UploadComponent` | §5.1–5.5 |
| `revisao-de-estrutura` | Revisao De Estrutura | `/revisao-de-estrutura` | `RevisaoDeEstruturaComponent` | §5.1–5.5 |
| `configuracoes` | Configurações | `/config` | `ConfiguracoesComponent` | §5.1–5.5 |
| `editor-de-layout-preview` | Editor De Layout Preview | `/editor-de-layout-preview` | `EditorDeLayoutPreviewComponent` | §5.1–5.5 |
| `exportacao-e-validacao` | Exportacao E Validacao | `/exportacao-e-validacao` | `ExportacaoEValidacaoComponent` | §5.1–5.5 |
| `download-e-historico` | Download E Historico | `/download-e-historico` | `DownloadEHistoricoComponent` | §5.1–5.5 |

## Próximos passos

O arquivo `prototype-map.json` na raiz do workspace contém metadados de todas as telas (rota Angular, seletor, caminhos de arquivo, referência ao wireframe, objetivo e componentes). Na **fase de arquitetura**, o agente de frontend lê esse JSON para:

- Substituir os `MOCK` por chamadas reais a serviços/APIs.
- Implementar os componentes listados em `componentes` usando a biblioteca DS de `app/ui/`.
- Refinar os utilitários Tailwind sobre os tokens do `theme.css`.
- Adicionar testes unitários e e2e.
