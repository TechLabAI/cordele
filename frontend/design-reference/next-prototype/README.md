# Cordelê — Protótipo Next.js 15

> Gerado por `wireframe-to-react`. **Não editar manualmente** — regenerar com `python main.py cordele --force`.

## Como rodar

```bash
npm install
npm run dev
# Abrir http://localhost:3000
```

## Telas (8)

- `/entrada` — Entrada
- `/biblioteca-de-projetos` — Biblioteca De Projetos
- `/upload` — Upload
- `/revisao-de-estrutura` — Revisao De Estrutura
- `/configuracoes` — Configurações
- `/edicao-de-layout` — Edicao De Layout
- `/exportacao-e-validacao` — Exportacao E Validacao
- `/download-e-historico` — Download E Historico

## Estrutura

```
app/               ← App Router (uma pasta por tela)
components/
  shell/           ← Sidebar, Topbar, AiPanel
  ui/              ← Primitivos DS (Button, Badge, Card, Input, Skeleton)
  shared/          ← Componentes compartilhados entre telas
lib/               ← utils, data-model, mock-data
.build-plans/      ← Contratos por tela (lidos pelo implementer)
```

## Design System

Dark-only, glass, AlumIA amarela. Tokens em `app/globals.css`.
Ver `knowledges/techlab-ui-design-system.md` §11 para equivalências React.

## Build Plans

Cada tela tem um `.build-plans/<screen_id>.plan.md` com:
- objetivo, regiões, componentes, ligações de dados, mock e estados obrigatórios.
