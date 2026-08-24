# Prototype README — Cordelê

> **Status:** gerado em 2026-06-19 · versão 1.0  
> **Tipo:** Angular 21 + Nx 22 + Tailwind v4 + CDK  
> **⚠️ DESCARTÁVEL** — este protótipo é descartável após aprovação do sponsor.  
> A fonte de verdade de longo prazo é `wireframe.md` (PERSISTENTE).

---

## Acesso rápido

```bash
cd projects/cordele/design/angular-prototype
npm install          # uma vez
npx nx serve cordele-web --port 4201
# → http://localhost:4201
```

---

## Telas implementadas

| # | Rota | Componente | Notas |
|---|------|------------|-------|
| T01 | `/entrada` | `EntradaComponent` | **Tela-momento** — full-bleed, fora do shell; "ê" decorativo; CTA principal |
| T02 | `/biblioteca-de-projetos` | `BibliotecaDeProjetosComponent` | Grid 2 colunas; badges de status (rascunho/andamento/válido/erros); estado vazio |
| T03 | `/upload` | `UploadComponent` | Drag-drop + click; validação de tipo (.docx/.md) e tamanho (50 MB); progresso simulado |
| T04 | `/revisao-de-estrutura` | `RevisaoDeEstruturaComponent` | Contadores de parsing; sumário de capítulos; painel de pendências com "Ignorar" |
| T05 | `/config` | `ConfiguracoesComponent` | Form de metadados; validação inline; drop zone de capa com preview |
| T06 | `/editor-de-layout-preview` | `EditorDeLayoutPreviewComponent` | Preview página a página; painel lateral de estilos com sliders em tempo real |
| T07 | `/exportacao-e-validacao` | `ExportacaoEValidacaoComponent` | 3 estados: gerando / válido+avisos / erros; seletor de estado para demo |
| T08 | `/download-e-historico` | `DownloadEHistoricoComponent` | Header do projeto; histórico de exportações; download de versões válidas |

---

## Navegação

```
/entrada  →  login  →  /biblioteca-de-projetos
                            ↓ "Novo projeto"
                       /upload  →  /revisao-de-estrutura  →  /config
                                                                ↓
                                                   /editor-de-layout-preview
                                                                ↓
                                                   /exportacao-e-validacao
                                                                ↓
                                                   /download-e-historico
```

---

## Funcionalidades interativas

| Tela | Interatividade |
|------|---------------|
| T01 Entrada | Links de navegação funcionais |
| T02 Biblioteca | Grid real com mock data; estado vazio se lista = [] |
| T03 Upload | Drag-drop real; validação de tipo e tamanho; progresso simulado (setInterval) |
| T04 Revisão | Botão "Ignorar" baixa a opacidade dos trechos; link "Reimportar" navega |
| T05 Metadados | Form editável com validação; preview de capa via FileReader |
| T06 Editor | Preview tipográfico em tempo real; sliders atualizam fontes, tamanhos, espaçamento, margens |
| T07 Exportação | Progresso animado; auto-transição para estado "válido"; seletor manual de estado |
| T08 Histórico | Lista de exportações com botão de download (links); badges de status |

---

## Design system aplicado

- **Tokens:** oklch via `theme.css` (`--color-brand`, `--text-primary`, `--bg-surface`, etc.)
- **Fontes:** Poppins (display) · Inter (body) · JetBrains Mono (mono)
- **Ícones:** Material Symbols Outlined
- **Tema:** claro por padrão (`:root`); dark disponível via `[data-theme="dark"]`
- **Sidebar:** sempre escura (oklch 18%) em ambos os temas
- **T01:** full-bleed, fora do shell — fundo navy escuro + "ê" decorativo tipográfico

---

## Discrepâncias wireframe ↔ protótipo

| Item | Wireframe | Protótipo | Resolução |
|------|-----------|-----------|-----------|
| `configuracoes` slug | T05 como "Metadados" | Rota `/config` | Funcional; slug gerado automaticamente; wireframe é a referência |
| Preview T06 | Página a página do manuscrito real | Capítulos mock (5 de 18) | Dados de demonstração; BFF entrega a estrutura real no produto |
| Exportação T07 | epubcheck real | Progresso e estados simulados | Prototipo estático; handoff ao BFF para integração real |

> **Wireframe vence** em caso de divergência. Se necessário, wireframe deve ser atualizado (não o protótipo).

---

## Vida útil

**Até aprovação do sponsor (gate Fase 0.4 — reconciliação).**  
Após aprovação, o arquiteto consome:
- `design/wireframe.md` (PERSISTENTE) — especificação de longo prazo
- `design/data-model.json` — contrato de dados (draft BA)
- `design/prototype-map.json` — mapa de telas para o pipeline `fe-ui-*`

---

## Histórico de revisões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 2026-06-19 | Danielle Antunes (BA/PM) | Geração inicial — 8 telas, tema DS ingerido do logotipo, mock data Editora Aetós |
