#!/usr/bin/env python3
"""pipeline-context.py — ES context query for pipeline agents (D-417).

Queries `techlab-pipeline-events-v1` and returns a compact JSON summary of
the recent pipeline history for a module.  Agents (validator, planner) call
this at startup to pre-populate context without reading the full README.

Fallback contract: if ES is unreachable or the module has no history, exits 0
and prints `{"available": false, ...}`.  The calling agent then falls back to
the README as today.  Zero infra is always a valid state.

Env:
    TECHLAB_ES_URL      — base URL (default http://localhost:9200)
    TECHLAB_ES_DISABLE  — set to "1" to skip the query entirely

CLI:
    python scripts/pipeline-context.py module-state --module PED [--layer fe] [--limit N]
    python scripts/pipeline-context.py decision-context --tags pipeline,validator [--limit N]
    # --client is intentionally omitted: always derived from project-context.json.
    # --layer filters events to a specific pipeline layer (be | fe).
    # decision-context queries the framework decisions index (D-419); client-agnostic.
    # Never hardcode --client in templates or commands.

Exit codes: 0 always (best-effort — caller must handle available:false).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

INDEX = "techlab-pipeline-events-v2"            # D-499 — ECS-aligned (pipeline_events.py writes v2)
DECISIONS_INDEX = "techlab-framework-decisions-v2"  # D-499 — ECS-aligned (decisions-index.py writes v2)
LEARNING_INDEX = "techlab-learning-current"     # D-497/D-498 — alias of techlab-learning-events-v2 (rework_pattern)
SPECS_INDEX = "techlab-architecture-specs-v2"    # D-486 — hybrid corpus (BM25 + dense_vector)
VECTORS_INDEX = SPECS_INDEX                       # D-486 — vectors folded into SPECS_INDEX (was techlab-knowledge-chunks-v1, D-476)
TIMEOUT_S = 3.0


def _es_url() -> str | None:
    if os.getenv("TECHLAB_ES_DISABLE", "").strip() == "1":
        return None
    return os.getenv("TECHLAB_ES_URL", "http://localhost:9200").rstrip("/")


def _post(url: str, body: dict) -> dict | None:
    """stdlib-only POST; returns parsed JSON or None on any error."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def _derive_client() -> str | None:
    """Walk up from cwd looking for project-context.json → project.name."""
    for candidate in [Path("project-context.json"),
                      *[p / "project-context.json" for p in Path.cwd().parents]]:
        if candidate.exists():
            try:
                ctx = json.loads(candidate.read_text(encoding="utf-8"))
                name = ctx.get("project", {}).get("name")
                if name:
                    return name
            except Exception:
                pass
    return None


def _flatten_pipeline_event(source: dict) -> dict:
    """D-499: collapse an ECS v2 pipeline-event _source back to the flat shape the
    module-state extraction + output contract expect. ES returns nested objects for
    dotted _source paths (labels.stage → {"labels": {"stage": ...}}), so navigate."""
    labels = source.get("labels", {}) or {}
    event = source.get("event", {}) or {}
    service = source.get("service", {}) or {}
    user = source.get("user", {}) or {}
    techlab = source.get("techlab", {}) or {}
    return {
        "@timestamp": source.get("@timestamp"),
        "message":    source.get("message"),
        "category":   event.get("action"),       # v1 "category" ≈ ECS event.action
        "status":     event.get("outcome"),       # v1 "status"   ≈ ECS event.outcome
        "stage":      labels.get("stage"),
        "module":     labels.get("module"),
        "layer":      labels.get("layer"),
        "session_id": labels.get("session_id"),   # run correlation (not trace_id)
        "actor":      service.get("name") or user.get("name"),
        "details":    techlab.get("details"),
    }


def cmd_module_state(args: argparse.Namespace) -> int:
    client = args.client or _derive_client()
    if not client:
        _out({"available": False, "reason": "client not resolved (provide --client or project-context.json)"})
        return 0

    base = _es_url()
    if not base:
        _out({"available": False, "reason": "ES disabled (TECHLAB_ES_DISABLE=1)"})
        return 0

    # D-499: pipeline_events.py writes the ECS v2 index — fields live under
    # labels.* / event.* / service.name / techlab.*. Query and extract on those paths.
    # Term-match the .keyword subfields: dynamic:true maps labels.* as analyzed text
    # (+ .keyword), so a term on the text field would miss hyphenated/uppercase values
    # like "candeeiro-so" / "ASST" (D-499).
    must: list[dict] = [{"term": {"labels.client.keyword": client}}]
    if args.module:
        must.append({"term": {"labels.module.keyword": args.module}})
    if args.layer:
        must.append({"term": {"labels.layer.keyword": args.layer}})

    result = _post(f"{base}/{INDEX}/_search", {
        "query": {"bool": {"must": must}},
        "sort": [{"@timestamp": {"order": "desc"}}],
        "size": args.limit,
        # ECS paths — run correlation lives in labels.session_id (there is NO trace_id).
        "_source": ["@timestamp", "message", "event.action", "event.outcome",
                    "labels.stage", "labels.module", "labels.layer", "labels.session_id",
                    "service.name", "user.name", "techlab.details"],
    })

    if result is None:
        _out({"available": False, "reason": "ES unreachable"})
        return 0

    hits = result.get("hits", {}).get("hits", [])
    total = result.get("hits", {}).get("total", {})
    total_count = total.get("value", 0) if isinstance(total, dict) else int(total)

    if not hits:
        _out({"available": True, "client": client, "module": args.module,
              "events_count": 0, "message": "no history yet for this module"})
        return 0

    # Flatten each ECS hit back to the flat shape the rest of this function (and the
    # output JSON contract) expects. category←event.action, status←event.outcome,
    # stage←labels.stage, actor←service.name|user.name, details←techlab.details.
    events = [_flatten_pipeline_event(h.get("_source", {})) for h in hits]

    def last_for_stage(stage: str) -> dict | None:
        for e in events:
            if e.get("stage") == stage:
                entry: dict = {
                    "timestamp": e.get("@timestamp"),
                    "message": e.get("message"),
                    "status": e.get("status"),
                    "actor": e.get("actor"),
                }
                if e.get("details"):
                    entry["details"] = e["details"]
                return entry
        return None

    recent = [
        {
            "timestamp": e.get("@timestamp"),
            "category": e.get("category"),
            "message": e.get("message"),
            "status": e.get("status"),
        }
        for e in events[:10]
    ]

    _out({
        "available": True,
        "client": client,
        "module": args.module,
        "events_count": total_count,
        "last_implement": last_for_stage("implement"),
        "last_validate": last_for_stage("validate"),
        "last_plan": last_for_stage("plan"),
        "recent_events": recent,
    })
    return 0


def cmd_decision_context(args: argparse.Namespace) -> int:
    """Cache-aware wrapper for decision-context (D-552). Delegates to inner fn."""
    cache_read = Path(args.cache_read) if getattr(args, "cache_read", None) else None
    cache_write = Path(args.cache_write) if getattr(args, "cache_write", None) else None
    return _run_with_cache("decision_snapshot", cache_read, cache_write,
                           None, _cmd_decision_context_inner, args)


def _cmd_decision_context_inner(args: argparse.Namespace) -> int:
    """Query the framework decisions index (D-419) for decisions relevant to the
    given tags. Used by execution agents to load applicable framework rules into
    context without reading the consolidation doc. Best-effort: available:false on
    any failure, so the agent simply proceeds without the decision pack."""
    base = _es_url()
    if not base:
        _out({"available": False, "reason": "ES disabled (TECHLAB_ES_DISABLE=1)"})
        return 0

    tags = [t.strip() for t in (args.tags or "").split(",") if t.strip()]

    # D-499: decisions-index.py writes the ECS v2 index — status/scope live under
    # labels.*, and title/rationale/tags/seq/etc. under techlab.decision.*.
    # .keyword subfields for exact match (labels.* is dynamic analyzed text, D-499).
    must: list[dict] = [{"term": {"labels.status.keyword": args.status}}] if args.status else []
    if args.scope:
        must.append({"term": {"labels.scope.keyword": args.scope}})
    bool_q: dict = {"must": must}
    if tags:
        bool_q["should"] = [{"term": {"techlab.decision.tags": t}} for t in tags]
        bool_q["minimum_should_match"] = 1

    result = _post(f"{base}/{DECISIONS_INDEX}/_search", {
        "query": {"bool": bool_q},
        # Rank by decision number desc: it is monotonic with time and immune to the
        # date-scraping imprecision of historical entries (D-419).
        "sort": [{"techlab.decision.seq": {"order": "desc", "missing": "_last"}}],
        "size": args.limit,
        "_source": ["labels.decision_id", "techlab.decision.title", "labels.status",
                    "labels.scope", "techlab.decision.tags", "techlab.decision.date",
                    "techlab.decision.impacted_files", "techlab.decision.superseded_by",
                    "techlab.decision.rationale"],
    })

    if result is None:
        _out({"available": False, "reason": "ES unreachable"})
        return 0

    hits = result.get("hits", {}).get("hits", [])
    if not hits:
        _out({"available": True, "tags": tags, "count": 0,
              "message": "no matching decisions (index empty or no tag match)"})
        return 0

    decisions = []
    for h in hits:
        s = h.get("_source", {})
        labels = s.get("labels", {}) or {}
        dec = (s.get("techlab", {}) or {}).get("decision", {}) or {}
        rationale = dec.get("rationale", "") or ""
        decisions.append({
            "decision_id": labels.get("decision_id"),
            "title": dec.get("title"),
            "status": labels.get("status"),
            "date": dec.get("date"),
            "tags": dec.get("tags", []),
            "impacted_files": dec.get("impacted_files", []),
            "superseded_by": dec.get("superseded_by"),
            "rationale": rationale[:280] + ("…" if len(rationale) > 280 else ""),
        })

    _out({"available": True, "tags": tags, "count": len(decisions),
          "decisions": decisions})
    return 0


def cmd_learning_context(args: argparse.Namespace) -> int:
    """Known-pitfalls retrieval (D-497/D-498). Queries the Learning Layer index
    (`techlab-learning-current`) for `rework_pattern` / `template_adjustment` events,
    aggregates by `defect_signature`, and returns a compact "known pitfalls" block the
    scaffold/implement agents read BEFORE generating an artifact — so they apply the
    `recommended_generator_fix` proactively instead of re-solving the same defect.

    Deliberately client-agnostic: a pitfall's value is its recurrence ACROSS clients by
    layer/module, so `--client` only `should`-boosts (never `must`-filters). Best-effort:
    `available:false` on any failure, exit 0 — the agent simply proceeds without the block.

    Field-path note (D-499 lesson): `labels.*` is `dynamic:true` → analyzed text with a
    `.keyword` subfield, so term/prefix queries target `.keyword` (else hyphenated/uppercase
    values like `candeeiro-so`/`ASST`/`be/web` silently miss). The explicitly-mapped
    `techlab.learning.*` keyword fields (e.g. `defect_signature`) are aggregated directly."""
    base = _es_url()
    if not base:
        _out({"available": False, "reason": "ES disabled (TECHLAB_ES_DISABLE=1)"})
        return 0

    # event_type term targets the .keyword subfield (D-499 lesson). Surface promotion
    # docs (`template_adjustment`) alongside raw `rework_pattern` signals.
    must: list[dict] = [
        {"terms": {"labels.event_type.keyword": ["rework_pattern", "template_adjustment"]}},
    ]
    # Sensitive rows are indexed for audit but must never surface here.
    must_not: list[dict] = [{"term": {"labels.sensitive": True}}]
    filt: list[dict] = []
    if args.layer:
        # Prefix on the .keyword subfield: `be` → all `be/*`; `be/test` → `be/test`
        # AND `be/test-config`; `be/web` → `be/web`. Exact slugs are a prefix of themselves.
        filt.append({"prefix": {"labels.layer.keyword": args.layer}})

    # should-boosts — module-specific pitfalls rank first, but cross-module/cross-client
    # recurrences for the same layer are still returned (never must-filtered).
    should: list[dict] = []
    if args.module:
        should.append({"term": {"labels.module.keyword": args.module}})
    if args.client:
        should.append({"term": {"labels.client.keyword": args.client}})

    bool_q: dict = {"must": must, "must_not": must_not}
    if filt:
        bool_q["filter"] = filt
    if should:
        bool_q["should"] = should   # pure boost: minimum_should_match stays 0 (must present)

    rep_source = ["@timestamp", "labels.module", "labels.layer", "labels.client",
                  "techlab.learning.recommended_generator_fix",
                  "techlab.learning.generator_target",
                  "techlab.learning.root_cause", "techlab.learning.fix_ref"]

    result = _post(f"{base}/{LEARNING_INDEX}/_search", {
        "size": 0,
        "query": {"bool": bool_q},
        "aggs": {
            "pitfalls": {
                # Aggregate on the explicitly-mapped keyword (no .keyword suffix, D-499).
                "terms": {"field": "techlab.learning.defect_signature",
                          "size": args.limit, "order": {"_count": "desc"}},
                "aggs": {
                    # Representative doc: newest evidence carries the canonical fix text.
                    "rep": {"top_hits": {"size": 1,
                                         "sort": [{"@timestamp": {"order": "desc"}}],
                                         "_source": rep_source}},
                },
            },
        },
    })

    if result is None:
        _out({"available": False, "reason": "ES unreachable"})
        return 0

    buckets = (result.get("aggregations", {}) or {}).get("pitfalls", {}).get("buckets", [])
    if not buckets:
        _out({"available": True, "retrieval": "learning", "module": args.module,
              "layer": args.layer, "pitfalls": [],
              "message": "no known pitfalls for this module/layer (index empty or no match)"})
        return 0

    pitfalls = []
    for b in buckets:
        rep_hits = (b.get("rep", {}) or {}).get("hits", {}).get("hits", [])
        s = rep_hits[0].get("_source", {}) if rep_hits else {}
        learning = (s.get("techlab", {}) or {}).get("learning", {}) or {}
        pitfalls.append({
            "defect_signature": b.get("key"),
            "evidence_count": b.get("doc_count", 0),
            "recommended_generator_fix": learning.get("recommended_generator_fix"),
            "generator_target": learning.get("generator_target"),
            "root_cause": learning.get("root_cause"),
            "fix_ref": learning.get("fix_ref"),
            "last_seen": s.get("@timestamp"),
        })
    pitfalls.sort(key=lambda p: p["evidence_count"], reverse=True)

    _out({"available": True, "retrieval": "learning", "module": args.module,
          "layer": args.layer, "pitfalls": pitfalls})
    return 0


def _warn(msg: str) -> None:
    """Stderr diagnostic. H2 (D-461): the semantic→lexical fallback used to be
    silent — every `--semantic` failure looked identical to a clean lexical run,
    which is exactly what masked D-458 and D-459. Each genuine degradation now says
    why + how to fix, without changing the exit code (best-effort contract intact)."""
    print(f"warning: {msg}", file=sys.stderr)


def _dsn_host(dsn: str) -> str:
    """host:port/db from a DSN, stripping credentials (never log the password)."""
    tail = dsn.rsplit("@", 1)[-1]
    return tail.replace("postgresql://", "").replace("postgres://", "") or "?"


# Padrões de path "boilerplate" — docs genéricos que têm alta similaridade semântica com
# quase qualquer pergunta (toda spec tem um ADR-single-service; plans/catálogos são amplos)
# e por isso afogam o doc canônico específico. Penalizados modestamente no prior (L3, D-508).
_BOILERPLATE_PATTERNS = (
    "-single-service",        # ADR-002-single-service (existe em todo serviço)
    "plan-",                  # planos POR-MÓDULO (plan-DIST) — NÃO o master-plan canônico
    "services-catalog", "/standards/",
    "risks-gaps-assumptions", "architectural-vision", "_brief",
    # família de docs de OVERVIEW por módulo (numerados NN-…): framing/direção genéricos,
    # nunca a resposta específica de um tópico — afogam o spec/contract canônico (D-509).
    "domain-framing", "architecture-direction",
)
_BOILERPLATE_PENALTY = 0.6   # D-509: ×0.75→×0.6; overview genérico não deve superar topic-doc


def _artifact_prior(source_path: str) -> float:
    """Multiplicador de prioridade por path (L3, D-508): penaliza boilerplate genérico
    para o doc canônico específico (spec/contract/adr-de-tópico) emergir. 1.0 = neutro."""
    p = (source_path or "").replace("\\", "/").lower()
    return _BOILERPLATE_PENALTY if any(pat in p for pat in _BOILERPLATE_PATTERNS) else 1.0


# Stopwords PT/EN comuns — não distinguem documentos; excluídas do boost de tópico.
_STOP = {
    "como", "qual", "quais", "para", "pelo", "pela", "dos", "das", "com", "que", "uma",
    "funciona", "servico", "service", "fluxo", "requisitos", "modelo", "onde", "esta",
    "estao", "sobre", "entre", "feito", "feita", "usa", "usar", "tem", "the", "what",
    "how", "are", "and", "backend", "frontend", "nao", "por", "seu", "sua", "seus",
    "seguranca",  # genérico — quase todo spec tem seção de security
}
_WORD_RE = re.compile(r"[a-z0-9]{3,}")
_BOOST_PER_TERM = 0.18    # +18% por termo distintivo no PATH/seção/título (sinal fraco)
_FILENAME_BOOST = 1.8     # +180% por termo distintivo no FILENAME-stem do doc (sinal forte:
                          # o doc canônico de um tópico quase sempre o carrega no nome do
                          # arquivo — spec-09-MESSAGING, spec-02-COMPONENT-hierarchy. D-509).


def _stem_eq(a: str, b: str) -> bool:
    """Igualdade leve com casamento de prefixo (≥5 chars) — casa variantes morfológicas
    (consume~consumer~consumed, integra~integration) sem um stemmer completo. Cross-lingual
    fica a cargo de _PT_EN; isto cobre flexões dentro do mesmo idioma (D-509)."""
    if a == b:
        return True
    lo, hi = (a, b) if len(a) <= len(b) else (b, a)
    return len(lo) >= 5 and hi.startswith(lo)


def _covered(q: set[str], hay: set[str]) -> int:
    """Nº de termos da query COBERTOS por algum termo do haystack (cobertura por termo de
    query, não contagem total — evita que uma palavra repetida no doc infle o score)."""
    return sum(1 for t in q if any(_stem_eq(t, h) for h in hay))

# Normalização cross-lingual PT→EN (D-508): as queries são em PT, mas os paths/títulos do
# corpus são em EN (mensageria≠messaging, tarefas≠task). O boost de tópico é lexical, então
# sem este mapa ele não dispara nesses casos. Mapa curado de termos de domínio (generaliza
# para qualquer query PT sobre o corpus EN — técnica de normalização cross-lingual, não
# overfit a casos específicos).
_PT_EN = {
    "mensageria": "messaging", "mensagens": "messaging", "fila": "queue",
    "tarefa": "task", "tarefas": "task", "lancamento": "launch", "lancamentos": "launch",
    "componente": "component", "componentes": "component", "hierarquia": "hierarchy",
    "evento": "event", "eventos": "event", "pagamento": "payment", "pagamentos": "payment",
    "coordenacao": "coordination", "consome": "consume", "consumir": "consume",
    "autenticacao": "authentication", "autorizacao": "authorization",
    "auditoria": "audit", "publicacao": "publish", "publicar": "publish",
    "pagina": "page", "paginas": "page", "rota": "route", "rotas": "route",
    "roteamento": "routing", "concorrencia": "concurrency", "idempotencia": "idempotency",
    "observabilidade": "observability", "saude": "health", "contrato": "contract",
    "integracao": "integration", "integracoes": "integration", "membros": "membership",
    "permissoes": "permissions", "papeis": "roles",
}


def _topic_boost(terms: str, src: dict, scope: set[str] | None = None) -> float:
    """Boost lexical de tópico (L4 D-508, reforçado L5 D-509): o doc canônico tem o tópico no
    FILENAME (ex.: 'checkout payment' → spec-02-checkout-payment), mas o sinal é diluído por
    ~14 chunks e afogado por docs genéricos do mesmo serviço (ADR-hexagonal, service-spec,
    _brief). Pesa o casamento no FILENAME-stem MUITO mais que no path/seção/título — o nome do
    arquivo é o rótulo de tópico do doc. Auto-corretivo: cada doc vence a query que nomeia seu
    tópico (a ADR-hexagonal vence 'arquitetura hexagonal'). Normalização PT→EN + casamento de
    prefixo cobrem o gap idioma/flexão. Sob escopo de --module o nome do serviço deixa de
    discriminar (está em todo path do pool), então é REMOVIDO dos termos da query."""
    q = {w for w in _WORD_RE.findall(terms.lower()) if w not in _STOP}
    if not q:
        return 1.0
    q |= {_PT_EN[w] for w in list(q) if w in _PT_EN}        # sinônimos EN (cross-lingual)
    if scope:                                               # serviço/módulo não discrimina sob escopo
        drop = set(scope) | {t for tok in scope for t in _WORD_RE.findall(tok)}
        q -= drop
    if not q:
        return 1.0
    path = (src.get("source_path", "") or "").replace("\\", "/").lower()
    head, _, stem = path.rpartition("/")
    stem = stem.rsplit(".", 1)[0]
    stem_terms = set(_WORD_RE.findall(stem.replace("-", " ")))
    rest_terms = set(_WORD_RE.findall(
        " ".join([head, src.get("section") or "", src.get("title") or ""])
        .replace("-", " ").replace("/", " ").lower())) - stem_terms
    fn_hits = _covered(q, stem_terms)                       # FILENAME = rótulo de tópico (forte)
    path_hits = _covered(q - stem_terms, rest_terms)        # path/seção/título (fraco)
    return 1.0 + _FILENAME_BOOST * fn_hits + _BOOST_PER_TERM * path_hits


# --- Module/service SCOPE (L5, D-509) ------------------------------------------------
# After D-508 the residual retrieval misses are all the SAME failure: the right artifact
# TYPE+TOPIC is retrieved, but for the WRONG service/domain (e.g. a `lead-service`
# SPEC-09-messaging outranking the `colaboradores-service` one for a colaboradores query).
# Production always names the working domain via `--module`; we use it to drop out-of-domain
# docs. The map prefix→backendService is NON-recoverable by string heuristics (TIME →
# colaboradores-service), so it is read from the client project's modules.registry — the same
# source of truth as sync-architecture.resolve_module_service.
_REGISTRY_CACHE: dict[str, list[dict]] = {}


def _client_registry(client: str) -> list[dict]:
    """modules.registry entries (prefix→backendService) for a client, read from the client
    PROJECT's project-context.json (path resolved via clients/<id>/client.json in this
    workspace). Cached per process; returns [] on any failure → scope degrades to the literal
    module token, never worse."""
    if client in _REGISTRY_CACHE:
        return _REGISTRY_CACHE[client]
    entries: list[dict] = []
    try:
        ws = Path(__file__).resolve().parent.parent
        project_path = json.loads(
            (ws / "clients" / client / "client.json").read_text(encoding="utf-8")
        ).get("project_path")
        if project_path:
            ctx = Path(project_path) / "project-context.json"
            entries = (json.loads(ctx.read_text(encoding="utf-8"))
                       .get("modules", {}).get("registry", []) or [])
    except (OSError, ValueError, KeyError):
        entries = []
    _REGISTRY_CACHE[client] = entries
    return entries


def _module_scope_tokens(client: str, module: str | None) -> set[str]:
    """Resolve a `--module` token to the path SEGMENTS that scope retrieval to its domain
    (D-509): the literal token (frontend module dir, e.g. `aud`/`asst`, or a service name
    passed directly) plus the backendService dir resolved via the registry (e.g.
    TIME→colaboradores-service — a mapping no heuristic recovers). Empty when no module is
    given → no scoping."""
    if not module:
        return set()
    mod = module.strip().lower()
    if not mod:
        return set()
    tokens = {mod}
    for entry in _client_registry(client):
        if str(entry.get("prefix", "")).lower() == mod:
            svc = entry.get("backendService")
            if svc:
                tokens.add(str(svc).lower())
            break
    return tokens


def _in_scope(source_path: str, tokens: set[str]) -> bool:
    """True if any scope token is a path SEGMENT of source_path. Segment match (not substring)
    avoids the `dist` ⊄ `distribuicao-service` trap. source_path has no `.keyword` to filter on
    in ES, so — like the other rerankers — this runs post-fusion in Python on the raw string."""
    if not tokens:
        return True
    segs = set((source_path or "").replace("\\", "/").lower().split("/"))
    return bool(tokens & segs)


def _hybrid_search(client: str, terms: str, limit: int,
                   required_tag: str | None = None, module: str | None = None):
    """D-486: hybrid retrieval over the ES specs index (techlab-architecture-specs-v2):
    BM25 (lexical) + dense_vector kNN (semantic), fused client-side via Reciprocal Rank
    Fusion (RRF). Fusion is client-side because the ES `rrf` retriever needs a platinum
    licence and this cluster is basic. Returns RRF-ranked raw hits (full content), or
    None when the SEMANTIC half is unavailable/empty (no terms / embedder down / kNN 0
    rows / ES absent) → caller falls back to its honest lexical path. The `None` contract
    keeps the caller's `retrieval` label truthful ("semantic" only when vectors ran).
    Best-effort: warns on genuine degradation, never raises.
    required_tag narrows to one artifact type (e.g. "issue" for issue-context, D-460).
    module (D-509) scopes results to one domain (drops cross-service docs of the right type
    but wrong service) — resolved to path segments via the client's modules.registry."""
    if not terms:
        return None  # no query — not a degradation, no warning
    base = _es_url()
    if not base:
        _warn("semantic OFF — ES disabled (TECHLAB_ES_DISABLE=1). Using lexical.")
        return None

    filters: list[dict] = [{"term": {"client": client}}, {"term": {"kind": "chunk"}}]
    if required_tag:
        filters.append({"term": {"tags": required_tag}})
    src = ["doc_id", "artifact_type", "title", "section", "source_path", "content", "tags"]
    cand = max(limit * 5, 50)

    # --- semantic half (dense_vector kNN) — gates whether we return hybrid at all ---
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from embeddings import embed_query
        vec = embed_query(terms)
    except ImportError as exc:
        _warn(f"semantic OFF — embedder import failed ({exc}); ensure "
              f"scripts/embeddings.py is present. Using lexical.")
        return None
    except Exception as exc:
        _warn(f"semantic OFF — embedding failed ({exc}). Using lexical.")
        return None
    if not vec:
        _warn(f"semantic OFF — query embedding empty; is Ollama serving "
              f"{os.environ.get('TECHLAB_EMBED_MODEL', 'nomic-embed-text')} at "
              f"{os.environ.get('OLLAMA_HOST', 'http://localhost:11434')}? Using lexical.")
        return None
    knn = _post(f"{base}/{SPECS_INDEX}/_search", {
        "knn": {"field": "embedding", "query_vector": vec, "k": cand,
                "num_candidates": cand, "filter": {"bool": {"must": filters}}},
        "_source": src, "size": cand,
    })
    if knn is None:
        _warn(f"semantic OFF — ES kNN failed (no response from {base}/{SPECS_INDEX}); "
              f"is the v2 hybrid index migrated? run architecture-specs-index.py index. "
              f"Using lexical.")
        return None
    knn_hits = knn.get("hits", {}).get("hits", [])
    if not knn_hits:
        _warn(f"semantic OFF — 0 kNN rows for client={client!r}; corpus may lack "
              f"embeddings (run architecture-specs-index.py index). Using lexical.")
        return None

    # --- lexical half (BM25) ---
    lex = _post(f"{base}/{SPECS_INDEX}/_search", {
        "query": {"bool": {"must": filters,
                           "should": [{"multi_match": {
                               "query": terms,
                               "fields": ["title^2", "section^1.5", "content",
                                          "source_path^2", "tags^2"]}}],
                           "minimum_should_match": 1}},
        "_source": src, "size": cand,
    })
    lex_hits = (lex or {}).get("hits", {}).get("hits", [])

    # --- Reciprocal Rank Fusion (k=60, the canonical constant) ---
    rrf_k = 60
    fused: dict[str, dict] = {}
    for ranked in (knn_hits, lex_hits):
        for rank, h in enumerate(ranked):
            s = h.get("_source", {})
            key = s.get("doc_id") or h.get("_id")
            entry = fused.setdefault(key, {"src": s, "rrf": 0.0})
            entry["rrf"] += 1.0 / (rrf_k + rank + 1)

    # --- L1 dedup por documento (D-508): o corpus tem vários chunks por doc; sem dedup
    # um doc boilerplate ocupa 2-4 vagas do top-k e afoga o doc canônico. Colapsa por
    # source_path mantendo o MELHOR chunk (max rrf), não a soma (não premiar doc com mais
    # chunks). ---
    by_path: dict[str, dict] = {}
    for e in sorted(fused.values(), key=lambda e: e["rrf"], reverse=True):
        sp = e["src"].get("source_path", "") or (e["src"].get("doc_id") or "")
        if sp not in by_path:
            by_path[sp] = e

    # --- L3 prior de artifact_type/path (D-508): docs genéricos (ADR *-single-service,
    # plans/, standards/catalog) têm cosine alto para quase toda pergunta. Penaliza o
    # boilerplate para o doc específico (spec/contract/adr-de-tópico) subir. Modesto
    # (×0.75) para não enterrar um boilerplate genuinamente relevante. ---
    # Scope tokens (service/module) drive BOTH the topic boost (drop the non-discriminative
    # service name from the query terms) and the post-fusion domain filter below (D-509).
    scope = _module_scope_tokens(client, module)
    for e in by_path.values():
        e["rrf"] *= _artifact_prior(e["src"].get("source_path", "")) \
            * _topic_boost(terms, e["src"], scope)
    ranked = sorted(by_path.values(), key=lambda e: e["rrf"], reverse=True)

    # --- L5 module/service SCOPE (D-509): when the caller names a --module, drop docs of
    # other domains — the residual D-508 miss is right TYPE + wrong SERVICE. HARD filter with
    # SAFE FALLBACK: if nothing in the named scope is present in the pool (unknown token, or a
    # genuinely cross-cutting answer), keep the unscoped ranking. Monotonic — never zero-out. ---
    if scope:
        in_scope = [e for e in ranked if _in_scope(e["src"].get("source_path", ""), scope)]
        if in_scope:
            ranked = in_scope
    ordered = ranked[:limit]
    return [{
        "doc_id": e["src"].get("doc_id"),
        "artifact_type": e["src"].get("artifact_type"),
        "section": e["src"].get("section") or e["src"].get("title", ""),
        "source_path": e["src"].get("source_path", ""),
        "content": e["src"].get("content") or "",
        "tags": e["src"].get("tags") or [],
        "score": round(e["rrf"], 6),
    } for e in ordered]


def _semantic_spec_chunks(client: str, terms: str, limit: int,
                          required_tag: str | None = None, module: str | None = None):
    """Hybrid (BM25 + dense_vector kNN, RRF-fused) spec-chunk retrieval (D-486;
    was kNN-only in D-476). Returns excerpt-shaped chunks or None → caller falls
    back to lexical. Shape preserved for cmd_spec_context / issue-context callers.
    module (D-509) scopes to one domain via the registry."""
    hits = _hybrid_search(client, terms, limit, required_tag, module=module)
    if not hits:
        return None
    _atypes = {"index-design", "service-spec", "contract", "adr", "design", "doc",
               "issue"}  # D-460
    out = []
    for h in hits:
        content = h["content"]
        out.append({
            "artifact_type": h.get("artifact_type") or next(
                (t for t in h["tags"] if t in _atypes), None),
            "section": h["section"],
            "source_path": h["source_path"],
            "score": h["score"],
            "excerpt": content[:400] + ("…" if len(content) > 400 else ""),
        })
    return out


def _assemble_spec_pack(client: str, module: str | None, terms: str, budget: int):
    """D-486: token-budgeted spec pack assembled from the ES HYBRID index
    (BM25 + dense_vector RRF, via _hybrid_search). Replaces the pgVector
    ContextPackAssembler path (D-434) — pgVector is now a SECONDARY store
    (oversized assets only). Returns (pack, markdown) or None when the hybrid
    retrieval yields nothing → caller falls through to the JSON lexical path."""
    query = terms or (module or client)
    hits = _hybrid_search(client, query, max(40, budget // 400), module=module)
    if not hits:
        _warn("pack OFF — hybrid retrieval empty (semantic unavailable?). "
              "Falling back to JSON chunks.")
        return None
    lines: list[str] = [f"# Spec context — {client}"
                        + (f" / {module}" if module else ""), ""]
    used = 0
    included = 0
    for h in hits:
        content = h["content"]
        cost = max(1, len(content) // 4)
        if used + cost > budget and included > 0:
            break
        lines.append(f"## [{h.get('artifact_type') or 'doc'}] {h['section']}".rstrip())
        if h["source_path"]:
            lines.append(f"`{h['source_path']}`")
        lines.append("")
        lines.append(content)
        lines.append("")
        used += cost
        included += 1
    pack = {
        "pack_id": f"spec-{client}-{module or 'all'}",
        "total_token_count": used,
        "budget_remaining": max(0, budget - used),
        "chunks_included": included,
        "retrieval": "hybrid",
    }
    return pack, "\n".join(lines)


def cmd_spec_context(args: argparse.Namespace) -> int:
    """Cache-aware wrapper for spec-context (D-552). Delegates to inner fn."""
    cache_read = Path(args.cache_read) if getattr(args, "cache_read", None) else None
    cache_write = Path(args.cache_write) if getattr(args, "cache_write", None) else None
    return _run_with_cache("spec_context_packed", cache_read, cache_write,
                           args.module, _cmd_spec_context_inner, args)


def _cmd_spec_context_inner(args: argparse.Namespace) -> int:
    """Query the architecture-specs corpus (D-432) for the specs relevant to a
    module/task. Used by execution agents (be/fe-implement, validator, planner)
    to load spec context from ES instead of reading raw .md (D-434). Returns the
    STRUCTURED index-spec docs (fields by role) + the most relevant spec CHUNKS.
    Best-effort: available:false on any failure, agent falls back to the .md."""
    client = args.client or _derive_client()
    if not client:
        _out({"available": False, "reason": "client not resolved"})
        return 0
    terms = " ".join(x for x in (args.module, args.query) if x).strip()

    # Token-budgeted pack (D-486) — prompt-ready markdown assembled from the ES
    # hybrid index (BM25 + dense_vector RRF). Falls back to JSON on empty retrieval.
    if getattr(args, "pack", False):
        result = _assemble_spec_pack(client, args.module, terms, args.budget)
        if result is not None:
            pack, md = result
            sys.stdout.write(md)
            print(f"\n<!-- pack_id={pack['pack_id']} budget={args.budget} "
                  f"used={pack['total_token_count']} remaining={pack['budget_remaining']} -->")
            return 0
        # _assemble_spec_pack already emitted a specific reason (H2); fall through to JSON.

    base = _es_url()
    if not base:
        _out({"available": False, "reason": "ES disabled (TECHLAB_ES_DISABLE=1)"})
        return 0

    # (1) Structured index-spec docs for the client — small, always included.
    specs_res = _post(f"{base}/{SPECS_INDEX}/_search", {
        "query": {"bool": {"must": [{"term": {"client": client}},
                                    {"term": {"kind": "index-spec"}}]}},
        "size": 20,
        "_source": ["index_slug", "index_name", "index_class", "time_field",
                    "fields", "artifact_name"],
    })
    # (2) Relevant spec chunks — hybrid BM25+dense_vector RRF (D-486) when requested
    # and the semantic half is available, else lexical ES. Best-effort; warns on degrade.
    retrieval = "lexical"
    chunks = None
    if getattr(args, "semantic", False):
        sem = _semantic_spec_chunks(client, terms, args.limit, module=args.module)
        if sem is not None:
            chunks, retrieval = sem, "semantic"

    chunks_res = None
    if chunks is None:
        chunk_query: dict = {"bool": {"must": [{"term": {"client": client}},
                                               {"term": {"kind": "chunk"}}]}}
        if terms:
            chunk_query["bool"]["should"] = [{"multi_match": {
                "query": terms, "fields": ["title^2", "content", "source_path^2", "tags^2"]}}]
            chunk_query["bool"]["minimum_should_match"] = 1
        chunks_res = _post(f"{base}/{SPECS_INDEX}/_search", {
            "query": chunk_query, "size": args.limit,
            "_source": ["artifact_type", "artifact_name", "section", "source_path", "content"],
        })

    if specs_res is None and chunks is None and chunks_res is None:
        _out({"available": False, "reason": "ES unreachable"})
        return 0

    index_specs = []
    for h in (specs_res or {}).get("hits", {}).get("hits", []):
        s = h["_source"]
        fields = s.get("fields", []) or []
        roles: dict = {}
        for f in fields:
            roles[f["role"]] = roles.get(f["role"], 0) + 1
        index_specs.append({
            "index_slug": s.get("index_slug"), "index_name": s.get("index_name"),
            "index_class": s.get("index_class"), "time_field": s.get("time_field"),
            "field_count": len(fields), "roles": roles,
            "dimensions": [f["path"] for f in fields if f["role"] == "dimension"],
            "metrics": [f["path"] for f in fields if f["role"] == "metric"],
        })

    if chunks is None:
        chunks = []
        for h in (chunks_res or {}).get("hits", {}).get("hits", []):
            s = h["_source"]
            c = s.get("content", "") or ""
            chunks.append({
                "artifact_type": s.get("artifact_type"), "artifact": s.get("artifact_name"),
                "section": s.get("section"), "source_path": s.get("source_path"),
                "excerpt": c[:400] + ("…" if len(c) > 400 else ""),
            })

    # H2 (D-461): expose the degradation programmatically too, not just on stderr.
    # `degraded` = caller asked for semantic but got lexical → assert on it when
    # precision matters (see docs/how-to/semantic-search-cookbook.md R7).
    semantic_requested = bool(getattr(args, "semantic", False))
    _out({"available": True, "client": client, "module": args.module,
          "query": args.query, "retrieval": retrieval,
          "semantic_requested": semantic_requested,
          "degraded": semantic_requested and retrieval != "semantic",
          "index_specs": index_specs,
          "chunk_count": len(chunks), "chunks": chunks})
    return 0


def cmd_issue_context(args: argparse.Namespace) -> int:
    """Related-issues retrieval (D-460). The execution agents read the TARGET
    issue raw (it is the unit of work); this surfaces SIBLING issues — similar
    flows, prior implementations, INT seams — from the corpus, where issues are
    indexed with artifact_type="issue". Semantic via pgVector when requested
    (tag-filtered), lexical ES otherwise. Best-effort, same contract as
    spec-context."""
    client = args.client or _derive_client()
    if not client:
        _out({"available": False, "reason": "client not resolved"})
        return 0
    terms = " ".join(x for x in (args.module, args.query) if x).strip()

    retrieval = "lexical"
    issues = None
    if getattr(args, "semantic", False):
        sem = _semantic_spec_chunks(client, terms, args.limit, required_tag="issue")
        if sem is not None:
            issues, retrieval = sem, "semantic"

    if issues is None:
        base = _es_url()
        if not base:
            _out({"available": False, "reason": "ES disabled (TECHLAB_ES_DISABLE=1)"})
            return 0
        q: dict = {"bool": {"must": [{"term": {"client": client}},
                                     {"term": {"kind": "chunk"}},
                                     {"term": {"artifact_type": "issue"}}]}}
        if terms:
            q["bool"]["should"] = [{"multi_match": {
                "query": terms,
                "fields": ["title^2", "content", "source_path^2", "artifact_name^2"]}}]
            q["bool"]["minimum_should_match"] = 1
        res = _post(f"{base}/{SPECS_INDEX}/_search", {
            "query": q, "size": args.limit,
            "_source": ["artifact_name", "section", "source_path", "content"],
        })
        if res is None:
            _out({"available": False, "reason": "ES unreachable"})
            return 0
        issues = []
        for h in res.get("hits", {}).get("hits", []):
            s = h["_source"]
            c = s.get("content", "") or ""
            issues.append({"issue": s.get("artifact_name"), "section": s.get("section"),
                           "source_path": s.get("source_path"),
                           "excerpt": c[:400] + ("…" if len(c) > 400 else "")})

    semantic_requested = bool(getattr(args, "semantic", False))
    _out({"available": True, "client": client, "module": args.module,
          "query": args.query, "retrieval": retrieval,
          "semantic_requested": semantic_requested,
          "degraded": semantic_requested and retrieval != "semantic",
          "issue_count": len(issues), "issues": issues})
    return 0


# ---- Cache helpers (D-552: pipeline-cycle handoff.json) ----------------------------------

def _utcnow() -> datetime:
    return datetime.utcnow()


def _cache_valid(cache_path: Path) -> bool:
    """True if cache file exists and TTL has not expired."""
    if not cache_path or not cache_path.is_file():
        return False
    try:
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        ts = datetime.fromisoformat(cached["timestamp"])
        ttl = int(cached.get("ttl_minutes", 60))
        return (_utcnow() - ts).total_seconds() < ttl * 60
    except Exception:
        return False


def _cache_read_field(cache_path: Path, field: str) -> str | None:
    """Return the named field from the cache as a string. None on miss or error."""
    try:
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        val = cached.get(field)
        if val is None:
            return None
        return val if isinstance(val, str) else json.dumps(val, indent=2, ensure_ascii=False)
    except Exception:
        return None


def _cache_write_field(cache_path: Path, field: str, content: str,
                       module: str | None) -> None:
    """Upsert `field=content` in the handoff.json cache. Atomic write (temp + rename)."""
    try:
        existing: dict = {}
        if cache_path.is_file():
            try:
                existing = json.loads(cache_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        cycle_id = existing.get("cycle_id") or str(uuid.uuid4())
        existing.update({
            "cycle_id": cycle_id,
            "module": module or existing.get("module"),
            field: content,
            "timestamp": _utcnow().isoformat(),
            "ttl_minutes": 60,
        })
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, cache_path)
    except Exception as exc:
        _warn(f"cache write failed ({exc}); continuing without cache.")


def _run_with_cache(field: str, cache_read_path: Path | None, cache_write_path: Path | None,
                    module: str | None, fn, args) -> int:
    """Wrap a command function with cache read/write semantics (D-552).

    - cache_read only: return cached `field` content without calling fn.
    - cache_write only / both: run fn, capturing its stdout; persist output to cache.
    - neither: call fn directly (no overhead).

    Cache hit requires the file to exist AND TTL to be valid. On hit, the cached
    content is printed and the function returns 0 immediately (best-effort).
    On miss the function runs normally and (when cache_write_path is set) its
    stdout output is persisted so subsequent callers hit the cache.
    """
    # --- cache read ---
    if cache_read_path and _cache_valid(cache_read_path):
        content = _cache_read_field(cache_read_path, field)
        if content is not None:
            try:
                sys.stdout.write(content)
                if not content.endswith("\n"):
                    sys.stdout.write("\n")
                sys.stdout.flush()
            except UnicodeEncodeError:
                sys.stdout.buffer.write(content.encode("utf-8", "replace"))
                sys.stdout.buffer.write(b"\n")
                sys.stdout.buffer.flush()
            return 0

    # --- run fn, optionally capturing output for cache write ---
    if cache_write_path:
        buf = io.StringIO()
        saved_stdout = sys.stdout
        sys.stdout = buf
        try:
            rc = fn(args)
        finally:
            sys.stdout = saved_stdout
        output = buf.getvalue()
        try:
            sys.stdout.write(output)
            sys.stdout.flush()
        except UnicodeEncodeError:
            sys.stdout.buffer.write(output.encode("utf-8", "replace"))
            sys.stdout.buffer.flush()
        if output.strip():
            _cache_write_field(cache_write_path, field, output, module)
        return rc

    return fn(args)


# ------------------------------------------------------------------------------------------


def _out(obj: dict) -> None:
    text = json.dumps(obj, indent=2, ensure_ascii=False)
    try:
        print(text)
    except UnicodeEncodeError:
        print(json.dumps(obj, indent=2, ensure_ascii=True))


def main(argv: list[str] | None = None) -> int:
    # D-486: pack markdown carries Unicode (→, §, …) — force UTF-8 stdout so the
    # Windows cp1252 console doesn't crash the write (agents read this via pipe).
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    parser = argparse.ArgumentParser(
        prog="pipeline-context.py",
        description="ES context query for pipeline agents (D-417)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("module-state",
                       help="Return recent pipeline history for a module as JSON")
    p.add_argument("--module", default=None,
                   help="Module ID (e.g. PED); omit to query all modules for the client")
    p.add_argument("--client", default=None,
                   help="Client/project ID (default: derived from project-context.json)")
    p.add_argument("--layer", default=None,
                   help="Filter events by pipeline layer (be | fe)")
    p.add_argument("--limit", type=int, default=20,
                   help="Max events to fetch (default: 20)")

    d = sub.add_parser("decision-context",
                       help="Return framework decisions matching tags as JSON (D-419)")
    d.add_argument("--tags", default=None,
                   help="Comma-separated tags to match (e.g. pipeline,validator); "
                        "omit to get the most recent decisions regardless of tag")
    d.add_argument("--status", default="active",
                   help="Filter by status (default: active; pass empty to include all)")
    d.add_argument("--scope", default=None,
                   help="Filter by scope (framework | project | module)")
    d.add_argument("--limit", type=int, default=8,
                   help="Max decisions to return (default: 8)")
    d.add_argument("--cache-read", default=None, metavar="PATH",
                   help="(D-552) Read decision_snapshot from handoff.json cache if valid; "
                        "skip ES query on hit")
    d.add_argument("--cache-write", default=None, metavar="PATH",
                   help="(D-552) Persist output to handoff.json cache after ES query")

    lc = sub.add_parser("learning-context",
                        help="Return known pitfalls (rework_pattern) for a module/layer "
                             "as JSON (D-497/D-498); client-agnostic by design")
    lc.add_argument("--module", default=None,
                    help="Module ID to should-boost (e.g. ASST); never filtered out")
    lc.add_argument("--layer", default=None,
                    help="Pipeline layer prefix to filter (e.g. be, be/test, be/web)")
    lc.add_argument("--client", default=None,
                    help="Client to should-boost (OPTIONAL — pitfalls are cross-client; "
                         "never required, never must-filtered)")
    lc.add_argument("--limit", type=int, default=8,
                    help="Max distinct pitfalls (defect_signatures) to return (default: 8)")

    s = sub.add_parser("spec-context",
                       help="Return architecture specs from the corpus as JSON (D-432/D-434)")
    s.add_argument("--module", default=None,
                   help="Module/service to bias the chunk search (e.g. PED, orders)")
    s.add_argument("--query", default=None,
                   help="Free-text to bias the chunk search (e.g. 'data model invariants')")
    s.add_argument("--client", default=None,
                   help="Client/project ID (default: derived from project-context.json)")
    s.add_argument("--limit", type=int, default=8,
                   help="Max spec chunks to return (default: 8)")
    s.add_argument("--semantic", action="store_true",
                   help="hybrid BM25+dense_vector retrieval, RRF-fused, on the ES "
                        "specs index (D-486); falls back to lexical when the semantic "
                        "half is unavailable")
    s.add_argument("--pack", action="store_true",
                   help="assemble a token-budgeted context pack (markdown) from the ES "
                        "hybrid index (D-486; was pgVector ContextPackAssembler, D-434); "
                        "falls back to JSON")
    s.add_argument("--budget", type=int, default=4000,
                   help="total token budget for --pack (default: 4000)")
    s.add_argument("--cache-read", default=None, metavar="PATH",
                   help="(D-552) Read spec_context_packed from handoff.json cache if valid; "
                        "skip ES query on hit")
    s.add_argument("--cache-write", default=None, metavar="PATH",
                   help="(D-552) Persist output to handoff.json cache after ES query")

    i = sub.add_parser("issue-context",
                       help="Return related issues from the corpus as JSON (D-460)")
    i.add_argument("--module", default=None,
                   help="Module to bias the search (e.g. PROD, FE-PROD)")
    i.add_argument("--query", default=None,
                   help="Free-text issue theme (e.g. 'optimistic reorder rollback')")
    i.add_argument("--client", default=None,
                   help="Client/project ID (default: derived from project-context.json)")
    i.add_argument("--limit", type=int, default=6,
                   help="Max related issues to return (default: 6)")
    i.add_argument("--semantic", action="store_true",
                   help="hybrid BM25+dense_vector retrieval, RRF-fused (D-486); "
                        "falls back to lexical when the semantic half is unavailable")

    args = parser.parse_args(argv)
    if args.command == "module-state":
        return cmd_module_state(args)
    if args.command == "decision-context":
        return cmd_decision_context(args)
    if args.command == "learning-context":
        return cmd_learning_context(args)
    if args.command == "spec-context":
        return cmd_spec_context(args)
    if args.command == "issue-context":
        return cmd_issue_context(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
