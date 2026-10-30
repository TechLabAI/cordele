#!/usr/bin/env bash
# provision-tenant.sh — aplica todas as migrations Prisma para um novo schema de empresa.
#
# Uso:
#   bash provision-tenant.sh <SLUG>
#
# Exemplo:
#   bash provision-tenant.sh outra-empresa
#
# O script espera que o PostgreSQL esteja acessível em:
#   postgresql://cordele:cordele@localhost:5434/cordele_dev
#
# Para customizar host/porta/user/senha/banco exporte as variáveis antes de chamar:
#   export DB_HOST=localhost DB_PORT=5434 DB_USER=cordele DB_PASS=cordele DB_NAME=cordele_dev
#   bash provision-tenant.sh outra-empresa

set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Uso: $0 <SLUG>" >&2
  echo "  Exemplo: $0 outra-empresa" >&2
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5434}"
DB_USER="${DB_USER:-cordele}"
DB_PASS="${DB_PASS:-cordele}"
DB_NAME="${DB_NAME:-cordele_dev}"

BASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
SCHEMA_NAME="emp_${SLUG}"
DATABASE_URL="${BASE_URL}?schema=${SCHEMA_NAME}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICES_DIR="${REPO_ROOT}/services"

echo "=== Provisionando tenant: ${SCHEMA_NAME} ==="
echo "    DB: ${BASE_URL}"
echo ""

SERVICES=(
  "proj-service"
  "imp-service"
  "comp-service"
  "pub-service"
)

for SERVICE in "${SERVICES[@]}"; do
  SERVICE_DIR="${SERVICES_DIR}/${SERVICE}"
  if [[ ! -d "${SERVICE_DIR}/prisma" ]]; then
    echo "[AVISO] ${SERVICE}: diretório prisma/ não encontrado, pulando."
    continue
  fi

  echo "--- ${SERVICE} ---"
  (
    export DATABASE_URL="${DATABASE_URL}"
    cd "${SERVICE_DIR}"
    npx prisma migrate deploy
  )
  echo ""
done

echo "=== Provisionamento concluido: ${SCHEMA_NAME} ==="
