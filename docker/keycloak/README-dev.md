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

### Papéis e usuários de dev

**Empresa `aetos` (Editora Aetós):**

| Papel | Usuário | Senha | empresa_id | Scopes no token |
|---|---|---|---|---|
| `empresa-admin` | `admin-aetos` | `admin123` | `aetos` | todos os 9 |
| `coordenadora-editorial` | `coordenadora` | `coord123` | `aetos` | read + write (sem `proj:delete`) |
| `leitor-editorial` | `leitor` | `leitor123` | `aetos` | apenas read |

**Empresa `outra-empresa` (schema `emp_outra-empresa`):**

| Papel | Usuário | Senha | empresa_id | Scopes no token |
|---|---|---|---|---|
| `empresa-admin` | `admin-outra` | `admin123` | `outra-empresa` | todos os 9 |
| `coordenadora-editorial` | `coordenadora-outra` | `coord123` | `outra-empresa` | read + write (sem `proj:delete`) |
| `leitor-editorial` | `leitor-outra` | `leitor123` | `outra-empresa` | apenas read |

**O claim `empresa_id` carrega o slug da empresa (`aetos`), não o nome do schema.**
Os serviços que precisam do schema fazem `emp_${slug}` internamente, produzindo `emp_aetos`.

### Gating de scope (matriz papel × scope)

O SPI `cordele-effective-scope-mapper` (em `docker/keycloak/spi/`) substitui o claim `scope`
no token pelo atributo `effective_scope` do usuário. Isso garante que o token de um `leitor`
**nunca** inclua scopes de escrita, mesmo que o cliente solicite explicitamente.

| Papel | Scopes garantidos |
|---|---|
| `empresa-admin` | `openid imp:read imp:write comp:read comp:write pub:read pub:write proj:read proj:write proj:delete` |
| `coordenadora-editorial` | `openid imp:read imp:write comp:read comp:write pub:read pub:write proj:read proj:write` |
| `leitor-editorial` | `openid imp:read comp:read pub:read proj:read` |

### Client Scopes (9)

`imp:read`, `imp:write`, `comp:read`, `comp:write`, `pub:read`, `pub:write`,
`proj:read`, `proj:write`, `proj:delete`

> `imp:write` está declarado no realm para compatibilidade futura (o frontend já consome
> o scope via permission map), mas nenhum endpoint de backend exige esse scope hoje
> (gap documentado em `docs/architecture/shared/rbac/modelo.md` §6).

### Client `cordele-web`

- Public client, PKCE (S256)
- `directAccessGrantsEnabled: true` — permite password grant (dev only)
- Default scopes: `openid profile email imp:read comp:read pub:read proj:read`
- Optional scopes: `imp:write comp:write pub:write proj:write proj:delete`
- Audience mappers: `imp-service`, `comp-service`, `pub-service`, `proj-service`
- Protocol mappers: `empresa_id` (atributo do usuário) + `effective-scope-override` (SPI)

---

## Obter um token (password grant — dev only)

**IMPORTANTE:** use `host.docker.internal:8180` para obter o token — não `localhost:8180`.
O `iss` no token deve ser `http://host.docker.internal:8180/realms/cordele` para que os
serviços o validem (eles têm `JWT_ISSUER_URI: http://host.docker.internal:8180/realms/cordele`).
No Windows com Docker Desktop, `host.docker.internal` resolve para `127.0.0.1`.

```bash
# Token para coordenadora (o scope no token refletirá sempre o effective_scope do usuário,
# independentemente do scope solicitado aqui)
TOKEN=$(curl -s -X POST \
  "http://host.docker.internal:8180/realms/cordele/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=cordele-web" \
  -d "grant_type=password" \
  -d "username=coordenadora" \
  -d "password=coord123" \
  -d "scope=openid" \
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

Payload esperado para `coordenadora` (campos relevantes):

```json
{
  "iss": "http://host.docker.internal:8180/realms/cordele",
  "aud": ["imp-service", "comp-service", "pub-service", "proj-service"],
  "sub": "<uuid>",
  "preferred_username": "coordenadora",
  "realm_access": {
    "roles": ["coordenadora-editorial"]
  },
  "scope": "openid imp:read imp:write comp:read comp:write pub:read pub:write proj:read proj:write",
  "empresa_id": "aetos"
}
```

> **Gating de scope é aplicado pelo SPI** — o campo `scope` no token JWT reflete sempre
> os scopes permitidos para o papel do usuário. Um `leitor` que solicite `pub:write` não
> o receberá no token.

---

## Chamar os serviços (via nginx :4500 ou diretamente)

```bash
# GET projetos — proj-service (proj:read) — porta direta 3003
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3003/api/v1/proj/projetos | python -m json.tool

# GET metadados — comp-service (comp:read) — porta direta 3001
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/comp/projetos/<uuid>/metadados | python -m json.tool
```

---

## Caso negativo — 403 sem o scope exigido

```bash
# Token de leitor (effective_scope = somente read, nunca write)
TOKEN_LEITOR=$(curl -s -X POST \
  "http://host.docker.internal:8180/realms/cordele/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=cordele-web" \
  -d "grant_type=password" \
  -d "username=leitor" \
  -d "password=leitor123" \
  -d "scope=openid+proj:write+proj:delete" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# POST /projetos requer proj:write — leitor não tem → 403
curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN_LEITOR" \
  -H "Content-Type: application/json" \
  -d '{"nome":"test"}' \
  http://localhost:3003/api/v1/proj/projetos
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
| `docker/keycloak/spi/` | Maven project: SPI `oidc-effective-scope-mapper` |
| `docker/keycloak/Dockerfile` | Multi-stage: compila SPI + copia realm |
| `docker/docker-compose.dev.yml` | Serviço `keycloak` na porta 8180 |
| `docs/architecture/shared/rbac/modelo.md` | Matriz papel × scope e decisões de RBAC |
