# Imagem de desenvolvimento do Keycloak para o Cordelê.
#
# Estende a imagem oficial embutindo o realm JSON diretamente.
# Motivo: Docker Desktop (WSL2) tem instabilidade com bind mounts em caminhos
# do host Windows que contém espaços; embutir o JSON evita o mount e é
# igualmente versionado em git.
#
# USO EXCLUSIVO DE DESENVOLVIMENTO. Não usar em produção sem:
#   - banco externo (Postgres em vez de H2)
#   - HTTPS habilitado
#   - secrets gerenciados externamente

FROM quay.io/keycloak/keycloak:26.1.4

# Copia o realm no diretório de importação — lido por `--import-realm`
COPY realms/cordele-realm.json /opt/keycloak/data/import/cordele-realm.json
