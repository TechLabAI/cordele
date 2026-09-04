# Stage 1 — compile the Effective Scope SPI
FROM maven:3.9-eclipse-temurin-21 AS spi-builder
WORKDIR /build
COPY spi/pom.xml .
# Pre-fetch dependencies (Docker layer cache)
RUN mvn -q dependency:go-offline
COPY spi/src ./src
RUN mvn -q package -DskipTests

# Stage 2 — Keycloak 26.1.4 with realm + SPI
FROM quay.io/keycloak/keycloak:26.1.4

# SPI JAR — automatically picked up from providers/ in start-dev mode
COPY --from=spi-builder /build/target/cordele-effective-scope-mapper-1.0.0.jar \
     /opt/keycloak/providers/cordele-effective-scope-mapper.jar

# Realm definition imported via --import-realm flag
COPY realms/cordele-realm.json /opt/keycloak/data/import/cordele-realm.json
