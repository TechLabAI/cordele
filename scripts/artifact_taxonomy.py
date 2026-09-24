#!/usr/bin/env python3
"""artifact_taxonomy.py - canonical artifact categories for the Learning Layer.

The ledger's `defect_signature` convention is `<area>:<local>:<sintoma>`, and `<area>`
was meant to encode the kind of artifact the defect lives in. In practice it drifted:
114 distinct `<area>` prefixes across 286 signals, 77 of them with a single signal.
The "@Version / isNew / new entity is merged instead of persisted" defect class alone
is spread over nine spellings (`be-jpa-entity`, `be-jpa-fixture`, `be-test-fixture`,
`be-jpa-adapter`, `bdd-scaffold:jpa-entity`, `bdd-step`, `jrny-jpa-entity`,
`fe-jpa-entity`, `be-implement`), so an exact-prefix match retrieves a third of it.

This module collapses that drift onto a small closed vocabulary, matched by TOKEN
OVERLAP rather than string equality, so `jrny-jpa-entity` and `bdd-scaffold:jpa-entity`
both resolve to `jpa-entity`. Three entry points:

    canonical_from_signature(sig)  -> str | None    # from an existing slug
    canonical_from_path(path)      -> list[str]     # from a file the agent will touch
    canonical_from_row(row)        -> str | None    # signature + generator_target + layer

Used by: pipeline-context.py (retrieval boost), learning-index.py (indexing the label),
learning-normalize.py (rewriting the ledger).
"""

from __future__ import annotations

import re

# Tokens that say WHERE something lives, not WHAT it is -- they must never decide a
# category, or every `be-*` signal would collapse together.
_NOISE_TOKENS = {
    "be", "fe", "arch", "backend", "frontend", "candeeiro", "so", "techlab",
    "service", "services", "src", "main", "java", "com", "lib", "libs", "app", "apps",
}

# Module codes are location, not artifact kind (`jrny-jpa-entity` is a jpa-entity).
_MODULE_CODES = {
    "prod", "dist", "time", "aud", "auto", "data", "lead", "wrks", "jrny", "asst",
    "comm", "sale", "intl", "camp", "grow", "gwy", "reg", "mig", "intg", "ped",
    "supt", "ment", "infra",
}

# Canonical category -> tokens that identify it. Order matters only for ties: the
# category with the most matched tokens wins, then the earlier one in this dict.
CATEGORIES: dict[str, set[str]] = {
    "jpa-entity":      {"jpa", "entity", "entities", "hibernate", "persistable"},
    "jpa-adapter":     {"jpa", "adapter", "repository", "persistence", "query"},
    "migration":       {"migration", "migrations", "flyway", "ddl", "schema", "mig"},
    "bdd":             {"bdd", "cucumber", "feature", "steps", "step", "gherkin",
                        "scenario", "scenarios"},
    "e2e":             {"e2e", "playwright", "smoke"},
    "security":        {"security", "jwt", "jwks", "oauth2", "keycloak", "auth",
                        "authentication", "token"},
    "rbac":            {"rbac", "permission", "permissao", "permissoes", "role",
                        "roles", "preauthorize", "authority", "authorities"},
    "multitenancy":    {"multitenancy", "multiempresa", "empresa", "tenant", "tenancy"},
    "messaging":       {"kafka", "outbox", "producer", "consumer", "jms", "artemis",
                        "event", "events", "dlq", "topic"},
    "observability":   {"observability", "metrics", "actuator", "tracing", "logging",
                        "logback", "mdc", "health"},
    "api-controller":  {"controller", "rest", "restcontroller", "endpoint", "mvc",
                        "dto", "problemdetail"},
    "error-handling":  {"error", "errors", "exception", "handler", "catalogue"},
    "domain":          {"domain", "model", "pojo", "record", "enum"},
    "application-service": {"application", "usecase", "transactional"},
    "test-fixture":    {"fixture", "fixtures", "mock", "mocks", "stub", "stubs",
                        "testcontainers", "datajpatest", "spy"},
    "test":            {"test", "tests", "junit", "assertion"},
    "scaffold":        {"scaffold", "generator", "template", "templates", "promote"},
    "build":           {"build", "gradle", "gradlew", "deps", "dependency",
                        "dependencies", "budget", "eslint", "spotless"},
    "docker":          {"docker", "dockerfile", "compose", "container", "image"},
    # Spring wiring lives here too: bean definition, constructor injection,
    # @Autowired -- `DomainServiceConfig` is the canonical example in this project.
    "config":          {"config", "configuration", "yml", "yaml", "properties",
                        "application", "bean", "beans", "autowired", "injection",
                        "constructor"},
    "http-client":     {"feign", "feignclient", "resttemplate", "httpclient", "proxy",
                        "client", "timeout"},
    "component":       {"component", "components", "template", "ui", "signal",
                        "signals"},
    "guard":           {"guard", "guards", "canactivate"},
    "http-adapter":    {"httpadapter", "adapter", "facade", "port"},
    "state":           {"state", "store", "ngrx"},
    "routes":          {"route", "routes", "router", "navigation", "lazy"},
    "nx-boundary":     {"nx", "boundary", "boundaries", "tags", "workspace",
                        "taxmap"},
    "arch-conformance": {"archunit", "conformance", "rule", "rules"},
    "spec":            {"spec", "specs", "ears", "contract", "contracts", "openapi"},
    "plan":            {"plan", "plans", "planner", "priority", "prioridade",
                        "backlog", "issue", "issues"},
    "pipeline-tooling": {"pipeline", "autopilot", "validator", "implementer",
                         "orchestrator", "gates", "score", "checkpoint", "ledger",
                         "retrieval", "context"},
    "lgpd":            {"lgpd", "dsr", "anonymization", "pii"},
}

_SPLIT_RE = re.compile(r"[^A-Za-z0-9]+")


def _tokens(text: str) -> set[str]:
    """Lowercased, de-noised tokens. Also splits camelCase so `OportunidadeJpaEntity`
    yields {oportunidade, jpa, entity}."""
    if not text:
        return set()
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", str(text))
    raw = {t.lower() for t in _SPLIT_RE.split(spaced) if t}
    return {t for t in raw if t not in _NOISE_TOKENS and t not in _MODULE_CODES}


def _best_category(tokens: set[str], limit: int = 1) -> list[str]:
    """Categories ranked by how many of their tokens the input matched."""
    scored = []
    for cat, cat_tokens in CATEGORIES.items():
        hits = len(tokens & cat_tokens)
        if hits:
            scored.append((hits, cat))
    if not scored:
        return []
    # More matched tokens wins; CATEGORIES order breaks ties (sort is stable).
    scored.sort(key=lambda p: -p[0])
    return [cat for _, cat in scored[:limit]]


def canonical_from_signature(signature: str, limit: int = 1) -> str | None:
    """Canonical category for a `<area>:<local>:<sintoma>` slug.

    `<area>` is authoritative and is resolved ALONE first. Scoring it together with
    `<local>` lets an incidental word in `<local>` outvote the real area: the ledger
    has `pipeline-tooling:pipeline-guard:...` (a python script, not an Angular guard)
    and `pipeline-tooling:plan-state-extractor:...` (not FE state). Only when `<area>`
    says nothing do `<local>` and then the whole slug get a turn.
    """
    if not signature:
        return None
    parts = str(signature).split(":")
    area = parts[0] if parts else ""

    # An area already spelled as a canonical category wins outright.
    normalized = area.strip().lower()
    if normalized in CATEGORIES:
        return normalized

    for probe in (area, ":".join(parts[1:2]), signature):
        cats = _best_category(_tokens(probe), limit)
        if cats:
            return cats[0]
    return None


def canonical_from_path(path: str) -> list[str]:
    """Categories for a file the agent is about to create or edit.

    Path shape decides first (a file under `.../bdd/` is bdd whatever its name),
    then the filename. Returns [] when nothing is recognizable -- callers treat an
    empty result as "no artifact axis", never as an error.
    """
    if not path:
        return []
    p = str(path).replace("\\", "/")
    low = p.lower()
    name = low.rsplit("/", 1)[-1]
    cats: list[str] = []

    def add(c: str) -> None:
        if c not in cats:
            cats.append(c)

    # Shape-based rules, most specific first.
    if re.search(r"/v\d+__.*\.sql$", low) or "/db/migration/" in low:
        add("migration")
    if low.endswith(".feature") or "/bdd/" in low or "cucumber" in name:
        add("bdd")
    if "/e2e/" in low or low.endswith(".e2e.ts") or "playwright" in low:
        add("e2e")
    if "/src/test/" in low or name.startswith("test") or low.endswith(".spec.ts"):
        add("test")
    if "/persistence/entity/" in low or name.endswith(("jpaentity.java", "entity.java")):
        add("jpa-entity")
    if "/persistence/adapter/" in low or "/persistence/repository/" in low:
        add("jpa-adapter")
    if "/messaging/" in low or "kafka" in name or "outbox" in name:
        add("messaging")
    if "/controller/" in low or name.endswith("controller.java"):
        add("api-controller")
    if "/domain/" in low:
        add("domain")
    if "/application/service/" in low or name.endswith("usecase.java"):
        add("application-service")
    if "/clients/" in low or "feign" in name:
        add("http-client")
    if "security" in low or "jwt" in name:
        add("security")
    if name.endswith((".component.ts", ".component.html", ".component.scss")):
        add("component")
    if name.endswith(".guard.ts"):
        add("guard")
    if name.endswith((".routes.ts", ".router.ts")):
        add("routes")
    if name.endswith((".adapter.ts", ".facade.ts", ".port.ts")):
        add("http-adapter")
    if name in ("build.gradle.kts", "settings.gradle.kts", "package.json") \
            or name.endswith(".gradle.kts"):
        add("build")
    if name.startswith("dockerfile") or "docker-compose" in name:
        add("docker")
    if name.endswith((".yml", ".yaml")) and "application" in name:
        add("config")
    if name.endswith((".md",)) and "/plans/" in low:
        add("plan")

    # Filename tokens as a fallback (catches *SecurityConfig.java, *Fixture.java, ...).
    if not cats:
        cats = _best_category(_tokens(name), limit=2)
    return cats


def canonical_from_row(row: dict) -> str | None:
    """Category for a ledger row -- signature first, `generator_target` as tiebreaker.

    `generator_target` usually names the template or file the fix belongs in, which
    disambiguates rows whose slug is generic (`be-implement:*`, `wrks-b6:*`).
    """
    sig = row.get("defect_signature") or ""
    cat = canonical_from_signature(sig)
    if cat:
        return cat
    for field in ("generator_target", "fix_ref"):
        value = row.get(field)
        if value:
            for candidate in str(value).replace(";", " ").split():
                found = canonical_from_path(candidate)
                if found:
                    return found[0]
            cat = _best_category(_tokens(str(value)))
            if cat:
                return cat[0]
    return None
