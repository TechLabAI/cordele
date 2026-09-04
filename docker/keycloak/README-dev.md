# Keycloak — Ambiente de Desenvolvimento

> **AVISO:** Esta configuração é para desenvolvimento local **exclusivamente**.
> H2 embarcado, HTTPS desabilitado, senhas fixas — nada disso é adequado para produção.

---

## Subindo o Keycloak

```bash
# Na raiz do projeto
docker compose -f docker/docker-compose.dev.yml up -d keycloak

# Aguardar o healthcheck passar (~60–90 s na primeira inicialização)
docker compose -f docker/docker-compose.dev.yml ps keycloak
# Status desejado: "healthy"
```

Keycloak Admin Console: http://localhost:8180  
Login: `admin` / `admin`

---

## Realm `cordele` — O que foi criado

### Papéis (realm roles)

| Papel | Usuário de dev | Senha |
|---|---|---|
| `empresa-admin` | `admin-aetos` | `admin123` |
| `coordenadora-editorial` | `coordenadora` | `coord123` |
| `leitor-editorial` | `leitor` | `leitor123` |

Todos os usuários têm o atributo `empresa_id = emp_aetos` (schema `emp_aetos` — Editora Aetós).

### Client Scopes (9)

`imp:read`, `imp:write`, `comp:read`, `comp:write`, `pub:read`, `pub:write`,
`proj:read`, `proj:write`, `proj:delete`

> `imp:write` está declarado no realm para compatibilidade futura (o frontend já consome
> o scope via permission map), mas nenhum endpoint de backend exige esse scope hoje
> (gap documentado em `docs/architecture/shared/rbac/modelo.md` §6).

### Client `cordele-web`

- Public client, PKCE (S256)
- `directAccessGrantsEnabled: true` — permite password grant (dev only)
- Default scopes: todos os 9 custom + `openid profile email`
- Audience mappers: `imp-service`, `comp-service`, `pub-service`, `proj-service`
- Protocol mapper: `empresa_id` ← atributo do usuário

---

## Obter um token (password grant — dev only)

**IMPORTANTE:** use `host.docker.internal:8180` para obter o token — não `localhost:8180`.
O `iss` no token deve ser `http://host.docker.internal:8180/realms/cordele` para que os
serviços o validem (eles têm `JWT_ISSUER_URI: http://host.docker.internal:8180/realms/cordele`).
No Windows com Docker Desktop, `host.docker.internal` resolve para `127.0.0.1`.

```bash
# Token com write scopes para coordenadora-editorial (scopes de escrita são opcionais)
TOKEN=$(curl -s -X POST \
  "http://host.docker.internal:8180/realms/cordele/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=cordele-web" \
  -d "grant_type=password" \
  -d "username=coordenadora" \
  -d "password=coord123" \
  -d "scope=openid imp:write comp:write pub:write proj:write proj:delete" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo $TOKEN
```

### Decodificar o payload (sem verificar assinatura)

```bash
# macOS / Linux com python3
echo $TOKEN | cut -d'.' -f2 | python3 -c "
import sys, base64, json
b = sys.stdin.read().strip()
b += '=' * (4 - len(b) % 4)
print(json.dumps(json.loads(base64.b64decode(b)), indent=2))
"
```

Payload esperado (campos relevantes):

```json
{
  "iss": "http://host.docker.internal:8180/realms/cordele",
  "aud": ["imp-service", "comp-service", "pub-service", "proj-service"],
  "sub": "<uuid>",
  "preferred_username": "coordenadora",
  "realm_access": {
    "roles": ["coordenadora-editorial"]
  },
  "scope": "openid imp:read comp:read pub:read proj:read imp:write comp:write pub:write proj:write proj:delete",
  "empresa_id": "emp_aetos"
}
```

> **Scopes de escrita são OPCIONAIS** no client `cordele-web`. Inclua-os explicitamente
> no `scope` do token request quando precisar chamar endpoints de escrita. O Keycloak só
> inclui scopes opcionais quando solicitados; scopes default (read) são sempre incluídos.

---

## Chamar os serviços (via nginx :4500)

```bash
# GET projetos — proj-service (proj:read)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4500/api/v1/proj/projetos | python -m json.tool

# GET manuscritos — imp-service (imp:read)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4500/api/v1/imp/manuscripts | python -m json.tool
```

---

## Caso negativo — 403 sem o scope exigido

```bash
# Token com apenas imp:read (sem comp:write, pub:write, etc.)
TOKEN_READONLY=$(curl -s -X POST \
  "http://host.docker.internal:8180/realms/cordele/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=cordele-web" \
  -d "grant_type=password" \
  -d "username=coordenadora" \
  -d "password=coord123" \
  -d "scope=openid imp:read" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# comp:write é exigido pelo PUT /api/v1/comp/metadados
# Espera-se 403 (token válido, scope ausente)
curl -s -o /dev/null -w "%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer $TOKEN_READONLY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:4500/api/v1/comp/metadados
# → 403
```

---

## OIDC Discovery

```bash
curl http://localhost:8180/realms/cordele/.well-known/openid-configuration | python -m json.tool
```

---

## Arquivos

| Arquivo | Descrição |
|---|---|
| `docker/keycloak/realms/cordele-realm.json` | Realm JSON versionado — fonte de verdade |
| `docker/docker-compose.dev.yml` | Serviço `keycloak` na porta 8180 |
| `docs/architecture/shared/rbac/modelo.md` | Matriz papel × scope e decisões de RBAC |
