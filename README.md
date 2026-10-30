# Cordelê

Plataforma SaaS B2B que transforma manuscritos, textos e arquivos Markdown em publicações digitais ePub válidas, sem diagramação manual nem ferramentas técnicas especializadas.

## Para quem é

Editoras e equipes de publicação que precisam gerar ePub a partir de originais em texto. O primeiro cliente é a Editora Aetós. O modelo é multiempresa corporativo: cada unidade de um mesmo grupo tem o seu próprio schema no PostgreSQL.

## Módulos

| Código | Módulo | Serviço | Responsabilidade |
|---|---|---|---|
| IMP | Importação | `imp-service` | Recebe manuscritos, textos e Markdown |
| COMP | Composição | `comp-service` | Compõe o conteúdo e o layout da publicação |
| PROJ | Projetos | `proj-service` | Biblioteca e detalhe dos projetos editoriais |
| PUB | Publicação | `pub-service` | Gera e valida o ePub e entrega o arquivo |

## Tecnologias

- **Backend:** Node 22, NestJS, Prisma, PostgreSQL 16+, pnpm. Arquitetura hexagonal, com regras de fronteira verificadas pelo ESLint (`eslint-plugin-boundaries`).
- **Frontend:** Angular 21 em um workspace Nx 22.
- **Autenticação:** Keycloak (OIDC/JWT).
- **Infraestrutura local:** Docker Compose.

## Estrutura do repositório

```
backend/services/   imp, comp, pub e proj (um serviço NestJS por módulo)
frontend/           workspace Nx: apps/cordele-web e libs por módulo
docker/             compose de desenvolvimento, Keycloak e scripts de initdb
docs/architecture/  especificação, ADRs, contratos e issues
scripts/            gates de conformidade e automação do pipeline
```

## Como rodar

Pré-requisitos: Node 22, pnpm, Docker e Python 3.

```bash
# infraestrutura local (PostgreSQL, Keycloak)
docker compose -f docker/docker-compose.dev.yml up -d

# cada serviço do backend (imp-service, comp-service, pub-service, proj-service)
cd backend/services/<servico>
cp .env.example .env        # ajuste os valores locais
pnpm install
pnpm prisma migrate dev
pnpm start:dev

# frontend
cd frontend
npm install
npx nx serve cordele-web
```

As migrações do Prisma devem ser aplicadas antes de subir os serviços. O prefixo da API é `/api/v1`.

## Testes e qualidade

```bash
# em backend/services/<servico>
pnpm test                   # Jest
pnpm lint                   # ESLint, incluindo as regras de fronteira
pnpm exec tsc --noEmit      # checagem de tipos
pnpm build

# gate de conformidade arquitetural
python scripts/arch-conformance.py check --layer be --target backend/services/<servico>

# em frontend/
npx nx affected:test
npx nx affected:lint
```

## Status e planos

O backend dos quatro módulos está implementado e o frontend está em integração com esses serviços. O trabalho é organizado em issues atômicas por módulo (`IMP-001`, `COMP-001`, `PUB-001`, `PROJ-001`).

- Issues e planos: veja o [ROADMAP.md](ROADMAP.md)
- Progresso: veja os planos por módulo no [ROADMAP.md](ROADMAP.md)
- Decisões de arquitetura: `docs/architecture/backend/adr/`

## Contribuindo

Os branches permanentes são `dev`, `release` e `prod`. Não há push direto: toda mudança entra por Pull Request. Os escopos de commit válidos são `imp`, `comp`, `pub`, `proj`, `web`, `libs`, `docs`, `infra` e `deps`.

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
