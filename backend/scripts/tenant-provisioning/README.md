# tenant-provisioning

Scripts para provisionar um novo schema de empresa no PostgreSQL de desenvolvimento.

## provision-tenant.sh

Aplica todas as migrations Prisma dos 4 servicos (`proj-service`, `imp-service`,
`comp-service`, `pub-service`) para o schema `emp_<SLUG>` no banco configurado.

### Pre-requisitos

- Node.js 22 e `pnpm` instalados
- PostgreSQL acessivel em `localhost:5434` (container `cordele-postgres` rodando)
- Cada servico deve ter suas dependencias instaladas (`pnpm install`)

### Uso

```bash
# Na raiz do repositorio
bash backend/scripts/tenant-provisioning/provision-tenant.sh <SLUG>

# Exemplo: provisiona emp_outra-empresa
bash backend/scripts/tenant-provisioning/provision-tenant.sh outra-empresa
```

### Variaveis de ambiente (opcional)

| Variavel | Default | Descricao |
|---|---|---|
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5434` | Porta do PostgreSQL |
| `DB_USER` | `cordele` | Usuario do banco |
| `DB_PASS` | `cordele` | Senha do banco |
| `DB_NAME` | `cordele_dev` | Nome do banco |

```bash
export DB_PORT=5433
bash backend/scripts/tenant-provisioning/provision-tenant.sh minha-empresa
```

### O que o script faz

1. Deriva o `DATABASE_URL` com `?schema=emp_<SLUG>` para cada servico
2. Executa `npx prisma migrate deploy` em cada diretorio de servico
3. O Prisma cria o schema se ele nao existir e aplica as migrations pendentes

### Adicionar usuarios Keycloak

Apos provisionar o schema no banco, adicione os usuarios correspondentes em
`docker/keycloak/realms/cordele-realm.json` e reinicie o Keycloak:

```bash
docker compose -f docker/docker-compose.dev.yml restart keycloak
```

Consulte `docker/keycloak/README-dev.md` para o formato dos usuarios e credenciais
de exemplo.

### Idempotencia

O script e idempotente: se o schema ja existir e as migrations ja tiverem sido
aplicadas, `prisma migrate deploy` nao faz nada. Pode ser chamado multiplas vezes
com seguranca.
