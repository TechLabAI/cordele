# Roadmap

O trabalho do Cordelê é planejado por módulo, em issues atômicas. Cada módulo tem o seu plano e as suas issues, no backend e no frontend. Este arquivo só indica onde cada coisa está.

## Por módulo

### IMP, Importação
- Plano: [backend](docs/architecture/backend/plans/plan-IMP.md) · [frontend](docs/architecture/frontend/plans/plan-FE-IMP.md)
- Issues: backend `IMP-NNN` em [backend/issues](docs/architecture/backend/issues/) · frontend [`FE-IMP-NNN`](docs/architecture/frontend/modules/imp/frontend/issues/)

### COMP, Composição
- Plano: [backend](docs/architecture/backend/plans/plan-COMP.md) · [frontend](docs/architecture/frontend/plans/plan-FE-COMP.md)
- Issues: backend `COMP-NNN` em [backend/issues](docs/architecture/backend/issues/) · frontend [`FE-COMP-NNN`](docs/architecture/frontend/modules/comp/frontend/issues/)

### PUB, Publicação
- Plano: [backend](docs/architecture/backend/plans/plan-PUB.md) · [frontend](docs/architecture/frontend/plans/plan-FE-PUB.md)
- Issues: backend `PUB-NNN` em [backend/issues](docs/architecture/backend/issues/) · frontend [`FE-PUB-NNN`](docs/architecture/frontend/modules/pub/frontend/issues/)

### PROJ, Projetos
- Plano: [backend](docs/architecture/backend/plans/plan-PROJ.md) · [frontend](docs/architecture/frontend/plans/plan-FE-PROJ.md)
- Issues: backend `PROJ-NNN` em [backend/issues](docs/architecture/backend/issues/) · frontend [`FE-PROJ-NNN`](docs/architecture/frontend/modules/proj/frontend/issues/)

## Visão geral

- Ordem de execução: [master plan do backend](docs/architecture/backend/plans/architecture-master-plan.md) e [do frontend](docs/architecture/frontend/plans/architecture-master-plan.md)
- Andamento: o estado de cada módulo está no `module-state.md` do frontend (`docs/architecture/frontend/modules/<módulo>/frontend/`) e nos planos acima
- Decisões de arquitetura: [ADRs do backend](docs/architecture/backend/adr/), [ADRs do frontend](docs/architecture/frontend/adr/) e, por módulo, `docs/architecture/frontend/modules/<módulo>/frontend/adr/`
