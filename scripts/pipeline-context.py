#!/usr/bin/env python3
"""pipeline-context.py — ES context query for pipeline agents (D-417).

Queries `techlab-pipeline-events-v2` and returns a compact JSON summary of
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
from datetime import datetime, timedelta
from pathlib import Path

# artifact_taxonomy lives next to this script; importing by path keeps `learning-context`
# working when the script is invoked from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))

INDEX = "techlab-pipeline-events-v2"            # D-499 — ECS-aligned (pipeline_events.py writes v2)
DECISIONS_INDEX = "techlab-framework-decisions-v2"  # D-499 — ECS-aligned (decisions-index.py writes v2)
LEARNING_INDEX = "techlab-learning-current"     # D-497/D-498 — alias of techlab-learning-events-v2 (rework_pattern)
SPECS_INDEX = "techlab-architecture-specs-v3"    # ADR-007 — one doc per spec record (BM25 + dense_vector)
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


LEARNING_RANKING = ("module_specific,artifact_specific,client_specific,"
                    "evidence_count,last_seen")
LEDGER_PATH = Path(".techlab/learning/signals.jsonl")


def _learning_rank_key(p: dict) -> tuple:
    """Specificity BEFORE recurrence. A pitfall recorded against the very module being
    worked on is the one the agent must not miss, even at a single occurrence; generic
    cross-module pitfalls are useful but never at the cost of truncating that one.

    Artifact class sits just below module (report.md rec. #3): a pitfall from ANOTHER
    module but the same artifact kind is the one that actually recurs, so it has to
    outrank the generic mass -- without ever displacing a module-specific pitfall."""
    return (0 if p.get("module_specific") else 1,
            0 if p.get("artifact_specific") else 1,
            0 if p.get("client_specific") else 1,
            -p.get("evidence_count", 0),
            p.get("last_seen") or "")


def _diversify_by_artifact(pitfalls: list[dict], limit: int, per_artifact: int) -> list[dict]:
    """Breadth before depth: take at most `per_artifact` pitfalls of each artifact class
    before spending the rest of the window on depth.

    Why this exists: `_learning_rank_key` is lexicographic and the window is global, so
    nothing guarantees COVERAGE across artifact classes -- the slots go to whatever ranks
    high, which clusters. Measured on 2026-09-17: a planner query for COMM
    (`--module COMM --layer be`, no --target-files, which is what be-planner.md actually
    runs) returned 50 pitfalls spanning 12 of the 30 artifact classes present in the `be`
    layer, leaving 66 of 252 signals unreachable -- messaging, jpa-adapter, rbac,
    migration, domain and http-client among them. Declaring the classes with --artifact
    made it WORSE (11 of 30), because boosting only adds ties that the recurrence
    tie-break then clusters again.

    The planner needs one alert per class to sequence priorities; the implementer needs
    depth on the file it is about to edit. Same call served both, so the planner lost.

    Order inside each class is preserved (the list arrives already ranked), and the
    leftover budget is filled in rank order, so a module-specific pitfall is never
    dropped in favour of breadth.
    """
    if per_artifact <= 0 or not pitfalls:
        return pitfalls[:limit]
    chosen: list[dict] = []
    seen_ids: set[int] = set()
    per_class: dict = {}
    for p in pitfalls:
        if len(chosen) >= limit:
            break
        cls = p.get("artifact") or "(sem artifact)"
        if per_class.get(cls, 0) >= per_artifact:
            continue
        per_class[cls] = per_class.get(cls, 0) + 1
        chosen.append(p)
        seen_ids.add(id(p))
    # leftover budget -> depth, still in rank order
    for p in pitfalls:
        if len(chosen) >= limit:
            break
        if id(p) not in seen_ids:
            chosen.append(p)
            seen_ids.add(id(p))
    return chosen


def _resolve_artifacts(args: argparse.Namespace) -> list[str]:
    """Canonical artifact categories for this query: explicit --artifact plus whatever
    --target-files imply. Empty list = axis inert (exactly like --client today)."""
    cats: list[str] = []
    for a in (getattr(args, "artifact", None) or []):
        c = str(a).strip().lower()
        if c and c not in cats:
            cats.append(c)
    try:
        from artifact_taxonomy import canonical_from_path
    except ImportError:
        return cats
    for path in (getattr(args, "target_files", None) or []):
        for c in canonical_from_path(path):
            if c not in cats:
                cats.append(c)
    return cats


def _learning_from_ledger(args: argparse.Namespace, artifacts: list[str],
                          reason: str) -> int:
    """Local fallback when ES is out: read `.techlab/learning/signals.jsonl` directly.

    CLAUDE.md already instructs agents to read the ledger by hand in this situation;
    doing it in code makes the retrieval work offline and makes the ranking testable
    without an ES instance. Same filters and same ordering as the indexed path."""
    if not LEDGER_PATH.is_file():
        _out({"available": False, "reason": reason,
              "detail": f"local ledger not found at {LEDGER_PATH}"})
        return 0

    by_sig: dict[str, dict] = {}
    try:
        for line in LEDGER_PATH.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("sensitive"):
                continue
            if args.layer and not str(row.get("layer") or "").startswith(args.layer):
                continue
            sig = row.get("defect_signature")
            if not sig:
                continue
            cur = by_sig.get(sig)
            seen = row.get("updated_at") or row.get("created_at") or ""
            if cur is None:
                by_sig[sig] = {
                    "defect_signature": sig,
                    "artifact": row.get("artifact"),
                    "evidence_count": 1,
                    "module_specific": row.get("module") == args.module,
                    "artifact_specific": row.get("artifact") in artifacts if artifacts else False,
                    "client_specific": bool(args.client) and row.get("project_id") == args.client,
                    "recommended_generator_fix": row.get("recommended_generator_fix"),
                    "generator_target": row.get("generator_target"),
                    "root_cause": row.get("root_cause"),
                    "fix_ref": row.get("fix_ref"),
                    "last_seen": seen,
                }
            else:
                cur["evidence_count"] += 1
                cur["module_specific"] |= row.get("module") == args.module
                if artifacts:
                    cur["artifact_specific"] |= row.get("artifact") in artifacts
                if seen > (cur["last_seen"] or ""):
                    cur.update({
                        "recommended_generator_fix": row.get("recommended_generator_fix"),
                        "generator_target": row.get("generator_target"),
                        "root_cause": row.get("root_cause"),
                        "fix_ref": row.get("fix_ref"),
                        "last_seen": seen,
                    })
    except OSError as exc:
        _out({"available": False, "reason": reason, "detail": f"ledger unreadable: {exc}"})
        return 0

    pitfalls = sorted(by_sig.values(), key=_learning_rank_key)
    truncated = len(pitfalls) > args.limit
    pitfalls = _diversify_by_artifact(pitfalls, args.limit,
                                      getattr(args, "per_artifact", 0) or 0)
    out: dict = {"available": True, "retrieval": "learning-local",
                 "source": str(LEDGER_PATH), "es_reason": reason,
                 "module": args.module, "layer": args.layer, "artifacts": artifacts,
                 "ranking": LEARNING_RANKING,
                 "pitfalls": pitfalls}
    if truncated:
        out["truncated"] = True
        out["message"] = (f"more than {args.limit} distinct pitfalls matched; "
                          "module-specific ones are ranked first and kept")
    _out(out)
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
    artifacts = _resolve_artifacts(args)

    base = _es_url()
    if not base:
        return _learning_from_ledger(args, artifacts, "ES disabled (TECHLAB_ES_DISABLE=1)")

    # event_type term targets the .keyword subfield (D-499 lesson). Surface promotion
    # docs (`template_adjustment`) alongside raw `rework_pattern` signals.
    #
    # `architecture_signal` entrou aqui em 2026-09-17 (ARCH-008): sete sinais de
    # arquitetura -- formato de codigo de permissao RBAC, resolucao de schema de tenant,
    # guards permissivos, realm Keycloak nao versionado -- estavam gravados no ledger,
    # contados pelo backfill e invisiveis a TODA consulta, porque o tipo deles nao
    # constava desta lista. Um filtro de tipo com vocabulario fechado silencia o que nao
    # reconhece: qualquer tipo novo de sinal precisa ser acrescentado aqui no mesmo
    # commit que o cria, senao ele e escrito e nunca lido.
    must: list[dict] = [
        {"terms": {"labels.event_type.keyword": [
            "rework_pattern", "template_adjustment", "architecture_signal",
        ]}},
    ]
    # Sensitive rows are indexed for audit but must never surface here.
    must_not: list[dict] = [{"term": {"labels.sensitive": True}}]
    filt: list[dict] = []
    if args.layer:
        # Prefix on the .keyword subfield: `be` → all `be/*`; `be/test` → `be/test`
        # AND `be/test-config`; `be/web` → `be/web`. Exact slugs are a prefix of themselves.
        filt.append({"prefix": {"labels.layer.keyword": args.layer}})

    # should-boosts — kept for the (unaggregated) relevance score, but NOTE: a terms agg
    # ignores _score entirely, so these alone do NOT rank module pitfalls first. The real
    # ranking happens below via the `module_hits`/`client_hits` sub-aggs (see _rank_key).
    should: list[dict] = []
    if args.module:
        # `ALL` is the cross-cutting module: a signal written for every module applies
        # to THIS one too. Matching only the exact module made those signals rank with
        # module_hits=0, so they fell outside the returned window and were, in practice,
        # unreachable -- the transversal pitfalls are exactly the ones worth surfacing.
        should.append({"terms": {"labels.module.keyword": [args.module, "ALL"]}})
    if args.client:
        should.append({"term": {"labels.client.keyword": args.client}})
    if artifacts:
        # Third axis (report.md rec. #3): the KIND of artifact being touched. A pitfall
        # of another module but the same artifact class is exactly what recurs -- the
        # WRKS @Version/isNew signals recurred in SALE P8 because nothing surfaced them.
        should.append({"terms": {"labels.artifact.keyword": artifacts}})

    bool_q: dict = {"must": must, "must_not": must_not}
    if filt:
        bool_q["filter"] = filt
    if should:
        bool_q["should"] = should   # pure boost: minimum_should_match stays 0 (must present)

    rep_source = ["@timestamp", "labels.module", "labels.layer", "labels.client",
                  "labels.artifact",
                  "techlab.learning.recommended_generator_fix",
                  "techlab.learning.generator_target",
                  "techlab.learning.root_cause", "techlab.learning.fix_ref"]

    # Fetch a WIDER bucket set than we return, then rank in Python (see _rank_key).
    # Asking ES for exactly `limit` buckets ordered by `_count` truncates on recurrence
    # alone, which silently drops a single-occurrence pitfall of THIS module below dozens
    # of generic ones — the exact failure that let three agents re-solve the same JRNY
    # MessagingIT defect while its signal sat in the index (D-497 retrieval gap).
    # Piso de 500, nao 200: a agregacao pede `size` buckets ordenados por _count desc, e a
    # camada `be` ja tem 270 assinaturas distintas no indice -- com 200 as 70 de menor
    # recorrencia nunca saiam do ES, e eram justamente as de classes raras. Medido em
    # 2026-09-17: com 200 a cota por artefato cobria 26 das 30 classes (faltando plan, rbac,
    # spec e sql, todas com evidence_count=1); ampliando a janela, 30/30. O custo e do lado do
    # ES: o tamanho da RESPOSTA continua limitado por --limit, o ranking segue em Python.
    fetch_size = max(args.limit * 4, 500)

    sub_aggs: dict = {
        # Representative doc: newest evidence carries the canonical fix text.
        "rep": {"top_hits": {"size": 1,
                             "sort": [{"@timestamp": {"order": "desc"}}],
                             "_source": rep_source}},
    }
    if args.module:
        # Same reason as the should-boost above: `ALL` counts as a hit for this module,
        # otherwise module_specific stays false and _rank_key buries the signal.
        sub_aggs["module_hits"] = {
            "filter": {"terms": {"labels.module.keyword": [args.module, "ALL"]}}}
    if args.client:
        sub_aggs["client_hits"] = {
            "filter": {"term": {"labels.client.keyword": args.client}}}
    if artifacts:
        sub_aggs["artifact_hits"] = {
            "filter": {"terms": {"labels.artifact.keyword": artifacts}}}

    result = _post(f"{base}/{LEARNING_INDEX}/_search", {
        "size": 0,
        "query": {"bool": bool_q},
        "aggs": {
            "pitfalls": {
                # Aggregate on the explicitly-mapped keyword (no .keyword suffix, D-499).
                "terms": {"field": "techlab.learning.defect_signature",
                          "size": fetch_size, "order": {"_count": "desc"}},
                "aggs": sub_aggs,
            },
        },
    })

    if result is None:
        return _learning_from_ledger(args, artifacts, "ES unreachable")

    buckets = (result.get("aggregations", {}) or {}).get("pitfalls", {}).get("buckets", [])
    if not buckets:
        _out({"available": True, "retrieval": "learning", "module": args.module,
              "layer": args.layer, "artifacts": artifacts, "pitfalls": [],
              "message": "no known pitfalls for this module/layer (index empty or no match)"})
        return 0

    pitfalls = []
    for b in buckets:
        rep_hits = (b.get("rep", {}) or {}).get("hits", {}).get("hits", [])
        s = rep_hits[0].get("_source", {}) if rep_hits else {}
        learning = (s.get("techlab", {}) or {}).get("learning", {}) or {}
        pitfalls.append({
            "defect_signature": b.get("key"),
            "artifact": (s.get("labels", {}) or {}).get("artifact"),
            "evidence_count": b.get("doc_count", 0),
            "module_specific": (b.get("module_hits", {}) or {}).get("doc_count", 0) > 0,
            "artifact_specific": (b.get("artifact_hits", {}) or {}).get("doc_count", 0) > 0,
            "client_specific": (b.get("client_hits", {}) or {}).get("doc_count", 0) > 0,
            "recommended_generator_fix": learning.get("recommended_generator_fix"),
            "generator_target": learning.get("generator_target"),
            "root_cause": learning.get("root_cause"),
            "fix_ref": learning.get("fix_ref"),
            "last_seen": s.get("@timestamp"),
        })

    pitfalls.sort(key=_learning_rank_key)
    truncated = len(pitfalls) > args.limit
    pitfalls = _diversify_by_artifact(pitfalls, args.limit,
                                      getattr(args, "per_artifact", 0) or 0)

    out: dict = {"available": True, "retrieval": "learning", "module": args.module,
                 "layer": args.layer, "artifacts": artifacts,
                 "ranking": LEARNING_RANKING,
                 "pitfalls": pitfalls}
    if truncated:
        out["truncated"] = True
        out["message"] = (f"more than {args.limit} distinct pitfalls matched; "
                          "module-specific ones are ranked first and kept")
    _out(out)
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


_RECORD_SRC = ["doc_id", "artifact_type", "artifact_name", "title", "section", "source_path", "content", "tags",
               "record_id", "record_kind", "declared", "line", "line_end", "parent", "layer",
               "module", "method", "http_path", "done"]


def _record_filters(client: str, required_tag: str | None, layer: str | None,
                    include: tuple[str, ...]) -> tuple[list[dict], list[dict]]:
    """ES filters for ADR-007 records: (must, must_not). `layer` keeps that layer plus
    `shared` (constitution, standards, shared/ apply to both). Rationale records stay out
    unless asked for (ADR-007 R4)."""
    must: list[dict] = [{"term": {"client": client}}, {"term": {"kind": "record"}}]
    if required_tag:
        must.append({"term": {"tags": required_tag}})
    if layer:
        must.append({"terms": {"layer": [layer, "shared"]}})
    must_not = [] if "rationale" in include else [{"term": {"record_kind": "rationale"}}]
    return must, must_not


def _rank_records(hits_by_list: list[list[dict]], client: str, terms: str, limit: int,
                  module: str | None, per_path: int) -> list[dict]:
    """RRF over the given ranked lists, then the D-508 priors and the D-509 module scope.
    D-508 deduped to ONE hit per document so a boilerplate doc could not fill the top-k;
    with one record per normative element that would keep a single EARS per contract, so
    the cap is per_path records per document instead."""
    rrf_k = 60
    fused: dict[str, dict] = {}
    for ranked in hits_by_list:
        for rank, h in enumerate(ranked):
            s = h.get("_source", {})
            key = s.get("doc_id") or h.get("_id")
            entry = fused.setdefault(key, {"src": s, "rrf": 0.0})
            entry["rrf"] += 1.0 / (rrf_k + rank + 1)
    scope = _module_scope_tokens(client, module)
    for e in fused.values():
        e["rrf"] *= _artifact_prior(e["src"].get("source_path", "")) \
            * _topic_boost(terms, e["src"], scope)
    ranked_all = sorted(fused.values(), key=lambda e: e["rrf"], reverse=True)
    if module:
        mod = module.strip().upper()
        in_scope = [e for e in ranked_all if e["src"].get("module") == mod
                    or _in_scope(e["src"].get("source_path", ""), scope)]
        if in_scope:   # safe fallback (D-509): never zero-out a genuinely cross-cutting answer
            ranked_all = in_scope
    per_doc: dict[str, int] = {}
    out: list[dict] = []
    for e in ranked_all:
        sp = e["src"].get("source_path", "")
        if per_doc.get(sp, 0) >= per_path:
            continue
        per_doc[sp] = per_doc.get(sp, 0) + 1
        out.append({**e["src"], "score": round(e["rrf"], 6)})
        if len(out) >= limit:
            break
    return out


def _lexical_records(client: str, terms: str, limit: int, required_tag: str | None = None,
                     module: str | None = None, layer: str | None = None,
                     include: tuple[str, ...] = (), per_path: int = 3):
    """BM25-only records (no embedder / no --semantic). None when ES is unreachable."""
    base = _es_url()
    if not base:
        return None
    must, must_not = _record_filters(client, required_tag, layer, include)
    q: dict = {"bool": {"must": must, "must_not": must_not}}
    if terms:
        q["bool"]["should"] = [{"multi_match": {
            "query": terms, "fields": ["title^2", "section^1.5", "content", "source_path^2",
                                       "tags^2", "record_id^2"]}}]
        q["bool"]["minimum_should_match"] = 1
    res = _post(f"{base}/{SPECS_INDEX}/_search",
                {"query": q, "_source": _RECORD_SRC, "size": max(limit * 5, 50)})
    if res is None:
        return None
    return _rank_records([res.get("hits", {}).get("hits", [])], client, terms, limit,
                         module, per_path)


_EXACT_MAX = 500


def _csv(values: list[str] | None) -> list[str]:
    """`--ids a,b --ids c` -> [a, b, c], blanks dropped, order kept, no duplicates."""
    out: list[str] = []
    for v in values or ():
        for x in v.split(","):
            x = x.strip()
            if x and x not in out:
                out.append(x)
    return out


def _exact_records(client: str, issues: list[str], ids: list[str], layer: str | None,
                   include: tuple[str, ...]):
    """ARCH-023 C4: records by issue code and/or record id, `term` exact, no ranking. The
    agent that already knows the code should not depend on a broad query ranking the right
    records into the top-k (ARCH-022 item 8: INTL-008's criteria came back in neither index).
    Document order (path, line). None when ES is unreachable."""
    base = _es_url()
    if not base:
        return None
    must, must_not = _record_filters(client, None, layer, include)
    should = []
    if issues:
        should.append({"bool": {"must": [{"term": {"artifact_type": "issue"}},
                                         {"terms": {"artifact_name": issues}}]}})
    if ids:
        should.append({"terms": {"record_id": ids}})
    q = {"bool": {"must": must, "must_not": must_not, "should": should,
                  "minimum_should_match": 1}}
    res = _post(f"{base}/{SPECS_INDEX}/_search",
                {"query": q, "_source": _RECORD_SRC, "size": _EXACT_MAX,
                 "sort": [{"source_path": "asc"}, {"line": "asc"}]})
    if res is None:
        return None
    return [h.get("_source", {}) for h in res.get("hits", {}).get("hits", [])]


def _hybrid_search(client: str, terms: str, limit: int,
                   required_tag: str | None = None, module: str | None = None,
                   layer: str | None = None, include: tuple[str, ...] = (),
                   per_path: int = 3):
    """D-486: hybrid retrieval over the ES specs index (techlab-architecture-specs-v3,
    one doc per ADR-007 record): BM25 (lexical) + dense_vector kNN (semantic), fused
    client-side via Reciprocal Rank Fusion (RRF). Fusion is client-side because the ES
    `rrf` retriever needs a platinum licence and this cluster is basic. Returns RRF-ranked
    records, or None when the SEMANTIC half is unavailable/empty (no terms / embedder down /
    kNN 0 rows / ES absent) → caller falls back to its honest lexical path. The `None`
    contract keeps the caller's `retrieval` label truthful ("semantic" only when vectors ran).
    Best-effort: warns on genuine degradation, never raises.
    required_tag narrows to one artifact type (e.g. "issue" for issue-context, D-460).
    layer (ARCH-022) filters in ES on the record's layer (+ shared); module (D-509) scopes to
    one domain via the record's module field or the registry path segments."""
    if not terms:
        return None  # no query — not a degradation, no warning
    base = _es_url()
    if not base:
        _warn("semantic OFF — ES disabled (TECHLAB_ES_DISABLE=1). Using lexical.")
        return None

    must, must_not = _record_filters(client, required_tag, layer, include)
    filters = {"bool": {"must": must, "must_not": must_not}}
    src = _RECORD_SRC
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
                "num_candidates": cand, "filter": filters},
        "_source": src, "size": cand,
    })
    if knn is None:
        _warn(f"semantic OFF — ES kNN failed (no response from {base}/{SPECS_INDEX}); "
              f"is the v3 record index built? run architecture-specs-index.py index. "
              f"Using lexical.")
        return None
    knn_hits = knn.get("hits", {}).get("hits", [])
    if not knn_hits:
        _warn(f"semantic OFF — 0 kNN rows for client={client!r}; corpus may lack "
              f"embeddings (run architecture-specs-index.py index). Using lexical.")
        return None

    lex = _post(f"{base}/{SPECS_INDEX}/_search", {
        "query": {"bool": {**filters["bool"],
                           "should": [{"multi_match": {
                               "query": terms,
                               "fields": ["title^2", "section^1.5", "content",
                                          "source_path^2", "tags^2", "record_id^2"]}}],
                           "minimum_should_match": 1}},
        "_source": src, "size": cand,
    })
    lex_hits = (lex or {}).get("hits", {}).get("hits", [])
    return _rank_records([knn_hits, lex_hits], client, terms, limit, module, per_path)


def _semantic_spec_chunks(client: str, terms: str, limit: int,
                          required_tag: str | None = None, module: str | None = None):
    """Hybrid retrieval shaped as excerpts, for issue-context (D-460). None → caller
    falls back to lexical."""
    hits = _hybrid_search(client, terms, limit, required_tag, module=module)
    if not hits:
        return None
    return [{"artifact_type": h.get("artifact_type"), "section": h.get("section"),
             "source_path": h.get("source_path", ""), "score": h["score"],
             "excerpt": (h.get("content") or "")[:400]
             + ("…" if len(h.get("content") or "") > 400 else "")} for h in hits]


def _public_record(h: dict, layer: str | None, module: str | None) -> dict:
    """One ADR-007 record for an agent: compact, anchored, nothing said twice. `id` only when
    the source declared it (an undeclared id is just path:line, already in `src`); the line
    range rides in `src` ("path:40-52"). Measured on INTL: declared + undeclared id + line_end
    were ~11% of the envelope with no information of their own."""
    line, end = h.get("line"), h.get("line_end")
    src = f"{h.get('source_path')}:{line}" + (f"-{end}" if end and line and end > line else "")
    score = h.get("score")
    # The file name declares the issue code (ADR-007 R2). Left inside `src` only, Haiku read
    # INT-INTL-008's criteria as INTL-008's in both proof runs (ARCH-022 item 8).
    issue = h.get("artifact_name") if h.get("artifact_type") == "issue" else None
    rec = {"id": h.get("record_id") if h.get("declared") else None, "issue": issue,
           "kind": h.get("record_kind"), "src": src, "score": round(score, 4) if isinstance(score, float) else score,
           "heading": h.get("section"), "parent": h.get("parent"),
           "method": h.get("method"), "path": h.get("http_path"), "done": h.get("done"),
           "text": h.get("content") or ""}
    if h.get("layer") != layer:
        rec["layer"] = h.get("layer")
    if h.get("module") and (module or "").upper() != h.get("module"):
        rec["module"] = h.get("module")
    return {k: v for k, v in rec.items() if v is not None}


def _spec_context_cache_field(args: argparse.Namespace) -> str:
    """D-552 cache key derived from every argument that changes the result. The old fixed
    `spec_context_packed` key served one caller's output to another (ARCH-022 C1)."""
    import hashlib
    key = json.dumps({k: getattr(args, k, None) for k in
                      ("client", "module", "layer", "query", "limit", "budget", "pack",
                       "semantic", "include", "per_path", "issue", "ids")},
                     sort_keys=True, default=str)
    return "spec_context:" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def cmd_spec_context(args: argparse.Namespace) -> int:
    """Cache-aware wrapper for spec-context (D-552). Delegates to inner fn."""
    cache_read = Path(args.cache_read) if getattr(args, "cache_read", None) else None
    cache_write = Path(args.cache_write) if getattr(args, "cache_write", None) else None
    return _run_with_cache(_spec_context_cache_field(args), cache_read, cache_write,
                           args.module, _cmd_spec_context_inner, args)


def _cmd_spec_context_inner(args: argparse.Namespace) -> int:
    """Spec records (ADR-007) relevant to a module/task, for the execution agents
    (be/fe validator, planner, implement). Always one compact JSON envelope — never
    markdown: {"v":1,"available":true,...,"records":[...]} or {"v":1,"available":false,
    "reason":...}. --pack caps the records by a token budget instead of a count.
    Best-effort: available:false on any failure, the agent falls back to the .md."""
    client = args.client or _derive_client()
    if not client:
        _out({"v": 1, "available": False, "reason": "client not resolved"})
        return 0
    if not _es_url():
        _out({"v": 1, "available": False, "reason": "ES disabled (TECHLAB_ES_DISABLE=1)"})
        return 0
    terms = " ".join(x for x in (args.module, args.query) if x).strip()
    include = tuple(args.include or ())
    pack = bool(getattr(args, "pack", False))
    limit = max(40, args.budget // 100) if pack else args.limit
    common = dict(module=args.module, layer=args.layer, include=include, per_path=args.per_path)
    issues = [x.upper() for x in _csv(getattr(args, "issue", None))]
    ids = _csv(getattr(args, "ids", None))
    exact = bool(issues or ids)

    retrieval, hits = "lexical", None
    semantic_requested = bool(getattr(args, "semantic", False))
    missing: list[str] = []
    if exact:
        retrieval = "exact"
        hits = _exact_records(client, issues, ids, args.layer, include)
        if hits is not None:
            # An exact lookup that finds nothing is an answer, not an empty success: name
            # what was asked and not found, so "no records" cannot pass for "no criteria".
            found_issues = {h.get("artifact_name") for h in hits if h.get("artifact_type") == "issue"}
            found_ids = {h.get("record_id") for h in hits}
            missing = [c for c in issues if c not in found_issues] + \
                      [i for i in ids if i not in found_ids]
    elif semantic_requested:
        hits = _hybrid_search(client, terms or (args.module or client), limit, **common)
        if hits is not None:
            retrieval = "semantic"
    if hits is None:
        hits = _lexical_records(client, terms, limit, **common)
    if hits is None:
        _out({"v": 1, "available": False, "reason": "ES unreachable"})
        return 0

    # Budget counts the serialized record, not just its text: chars/4 on the text alone
    # undercounted a 4000-token pack at ~7000 real tokens (ARCH-022 item 8). Spec JSON in
    # Portuguese measured 2.9-3.3 chars/token (cl100k); 3.0 keeps the estimate on the safe side.
    records, used = [], 0
    for h in hits:
        rec = _public_record(h, args.layer, args.module)
        cost = max(1, -(-len(json.dumps(rec, ensure_ascii=False, separators=(",", ":"))) // 3))
        if pack and used + cost > args.budget and records:
            break
        records.append(rec)
        used += cost

    env = {"v": 1, "available": True, "client": client, "layer": args.layer,
           "module": args.module, "query": args.query, "retrieval": retrieval,
           # H2 (D-461): degradation is programmatic, not just stderr
           "degraded": semantic_requested and retrieval != "semantic"}
    if exact:
        env.update(issue=issues or None, ids=ids or None, missing=missing)
    if pack:
        env.update(budget=args.budget, used=used)
    env["records"] = records
    _out({k: v for k, v in env.items() if v is not None})
    return 0


_EVIDENCE_HEAD = re.compile(r"^\s*(?:#+\s*)?Evid[eê]ncias consultadas", re.IGNORECASE)
_EVIDENCE_ENTRY = re.compile(r"^\s+\d+\.\s+(?P<body>.+?)\s*$")
_EVIDENCE_FONTE = re.compile(r"^\s*-\s*fonte:\s*(?P<v>.+?)\s*$", re.IGNORECASE)
_SCORE_TAIL = re.compile(r"\s*\(score[^)]*\)\s*$", re.IGNORECASE)
_SRC = re.compile(r"^(?P<path>[^\s:]+):(?P<a>\d+)(?:-(?P<b>\d+))?$")
_NO_ID = {"", "-", "—", "sem-id", "(sem id)"}


def _parse_evidence(text: str) -> tuple[list[str], list[str]]:
    """(fontes, citations) from every "Evidencias consultadas" block of an agent report.
    A block runs from its header to the next markdown heading; citations are the numbered
    lines under it (the top-N of the molde in be/fe-validator.md)."""
    fontes: list[str] = []
    cites: list[str] = []
    inside = False
    for line in text.splitlines():
        if _EVIDENCE_HEAD.match(line):
            inside = True
            continue
        if not inside:
            continue
        if line.lstrip().startswith("#"):
            inside = False
            continue
        m = _EVIDENCE_FONTE.match(line)
        if m:
            fontes.append(m.group("v"))
            continue
        m = _EVIDENCE_ENTRY.match(line)
        if m:
            cites.append(m.group("body"))
    return fontes, cites


def _resolve_doc(path: str) -> Path | None:
    """source_path in the v3 index is relative to docs/architecture/ (backend/issues/...);
    repo-root relative is accepted too."""
    root = Path(__file__).resolve().parent.parent
    for p in (root / "docs" / "architecture" / path, root / path):
        if p.is_file():
            return p
    return None


def _check_citation(cite: str, client: str, base: str, cache: dict) -> str | None:
    """None when the citation holds, else the reason it does not. The cited range must fall
    inside an INDEXED record's line..line_end, not match a line exactly: a doc edited after
    indexing moves lines, and the index is what the agent was actually shown."""
    body = _SCORE_TAIL.sub("", cite).strip().strip("`")
    rid, _, src = body.rpartition(" @ ") if " @ " in body else ("", "", body)
    rid, src = rid.strip().strip("`"), src.strip().strip("`")
    m = _SRC.match(src)
    if not m:
        return "unparseable src (expected <id> @ <path:line[-end]>)"
    path, a = m.group("path"), int(m.group("a"))
    b = int(m.group("b") or a)
    doc = _resolve_doc(path)
    if doc is None:
        return "file not found"
    if b < a:
        return "inverted line range"
    n_lines = len(doc.read_text(encoding="utf-8", errors="replace").splitlines())
    if b > n_lines:
        return f"line {b} beyond end of file ({n_lines} lines)"
    if path not in cache:
        res = _post(f"{base}/{SPECS_INDEX}/_search", {
            "query": {"bool": {"must": [{"term": {"client": client}}, {"term": {"kind": "record"}},
                                        {"term": {"source_path": path}}]}},
            "_source": ["record_id", "line", "line_end"], "size": _EXACT_MAX})
        if res is None:
            raise ConnectionError("ES unreachable")
        cache[path] = [h["_source"] for h in res.get("hits", {}).get("hits", [])]
    records = cache[path]
    if not records:
        return "no record indexed for this file"

    def covers(r: dict) -> bool:
        lo = r.get("line") or 0
        return lo <= a and b <= (r.get("line_end") or lo)

    if rid not in _NO_ID:
        rec = next((r for r in records if r.get("record_id") == rid), None)
        if rec is None:
            return f"id {rid!r} not indexed for {path}"
        if not covers(rec):
            return f"src outside record range {rec.get('line')}-{rec.get('line_end')}"
        return None
    if not any(covers(r) for r in records):
        return "src not inside any indexed record"
    return None


def cmd_verify_citations(args: argparse.Namespace) -> int:
    """ARCH-023 C5: check the `<id> @ <src>` citations of an agent report against the v3
    index. Deterministic, run by the ORCHESTRATOR next to accept-verdict -- never a tool the
    agent chooses to call. Exit 0 = all hold; 2 = at least one invalid (or no evidence block,
    or a non-NENHUMA source with an empty top-N); 1 = could not verify (ES/report missing)."""
    report = Path(args.report)
    if not report.is_file():
        _out({"v": 1, "ok": False, "verified": False, "reason": f"report not found: {report}"})
        return 1
    text = report.read_text(encoding="utf-8", errors="replace")
    fontes, cites = _parse_evidence(text)
    invalid: list[dict] = []
    if not fontes and not cites:
        invalid.append({"cite": None, "reason": "no 'Evidencias consultadas' block"})
    elif not cites and not all(f.upper().startswith("NENHUMA") for f in fontes):
        invalid.append({"cite": None, "reason": f"top-N empty but fonte is {fontes[0]!r}"})
    if cites:
        client = args.client or _derive_client()
        base = _es_url()
        if not client or not base:
            _out({"v": 1, "ok": False, "verified": False,
                  "reason": "client not resolved" if not client else "ES disabled"})
            return 1
        cache: dict = {}
        try:
            for c in cites:
                reason = _check_citation(c, client, base, cache)
                if reason:
                    invalid.append({"cite": c, "reason": reason})
        except ConnectionError as exc:
            _out({"v": 1, "ok": False, "verified": False, "reason": str(exc)})
            return 1
    _out({"v": 1, "ok": not invalid, "checked": len(cites), "invalid": invalid})
    return 2 if invalid else 0


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
                                     {"term": {"kind": "record"}},
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
    # ADR-007: agents get compact JSON. main() forces UTF-8 stdout, so no ASCII fallback —
    # ensure_ascii turned every accented letter into a 6-char escape (+23% tokens, ARCH-022).
    print(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


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
                    help="Module ID to rank first (e.g. ASST); pitfalls recorded against "
                         "this module sort ahead of generic ones and survive --limit. "
                         "Other modules' pitfalls are still returned, never filtered out")
    lc.add_argument("--layer", default=None,
                    help="Pipeline layer prefix to filter (e.g. be, be/test, be/web)")
    lc.add_argument("--client", default=None,
                    help="Client to should-boost (OPTIONAL — pitfalls are cross-client; "
                         "never required, never must-filtered)")
    lc.add_argument("--limit", type=int, default=50,
                    help="Max distinct pitfalls (defect_signatures) to return (default: 50)")
    lc.add_argument("--per-artifact", type=int, default=0, metavar="N",
                    dest="per_artifact",
                    help="Breadth mode: take at most N pitfalls of each artifact class "
                         "before spending the rest of --limit on depth. 0 (default) keeps "
                         "the pure ranking. Use it when PLANNING a service, where the "
                         "files are not known yet and --target-files cannot be given: the "
                         "planner needs one alert per class, not the deepest cluster. "
                         "The implementer, which does know the file, should keep "
                         "--target-files and leave this at 0")
    lc.add_argument("--artifact", action="append", default=[],
                    help="Canonical artifact category to rank up (e.g. jpa-entity, bdd, "
                         "security); repeat for several. See scripts/artifact_taxonomy.py. "
                         "Like --module, it boosts and never filters out")
    lc.add_argument("--target-files", dest="target_files", action="append", default=[],
                    help="File the agent is about to create/edit; its artifact category "
                         "is derived automatically (e.g. *JpaEntity.java -> jpa-entity). "
                         "Repeat for each target. Prefer this over --artifact: it removes "
                         "the judgment call that agents forget to make")

    s = sub.add_parser("spec-context",
                       help="Return typed spec records (ADR-007) as one compact JSON "
                            "envelope -- never markdown")
    s.add_argument("--module", default=None,
                   help="Module to scope the search (e.g. INTL); records of other modules "
                        "are dropped unless none match")
    s.add_argument("--layer", default=None, choices=("be", "fe"),
                   help="Keep only this layer's records (+ shared). Pass the agent's own layer")
    s.add_argument("--query", default=None,
                   help="Free-text to bias the search (e.g. 'data model invariants')")
    s.add_argument("--client", default=None,
                   help="Client/project ID (default: derived from project-context.json)")
    s.add_argument("--limit", type=int, default=8,
                   help="Max records to return without --pack (default: 8)")
    s.add_argument("--semantic", action="store_true",
                   help="hybrid BM25+dense_vector retrieval, RRF-fused, on the ES "
                        "specs index (D-486); falls back to lexical when the semantic "
                        "half is unavailable (degraded=true)")
    s.add_argument("--pack", action="store_true",
                   help="cap the records by --budget tokens instead of --limit (still JSON)")
    s.add_argument("--budget", type=int, default=4000,
                   help="token budget for --pack (default: 4000)")
    s.add_argument("--include", action="append", choices=("rationale",), default=None,
                   help="also return rationale records (context, alternatives, "
                        "consequences), left out by default (ADR-007 R4)")
    s.add_argument("--per-path", dest="per_path", type=int, default=3,
                   help="max records from one source document (default: 3)")
    s.add_argument("--issue", action="append", default=None, metavar="CODE[,CODE]",
                   help="(ARCH-023) every record of these issues, exact match on the code, "
                        "no ranking, document order. Use it when the code is known -- a "
                        "broad query may not rank the right criteria into the top-k. "
                        "--layer/--include still apply; --query/--semantic/--module do not")
    s.add_argument("--ids", action="append", default=None, metavar="ID[,ID]",
                   help="(ARCH-023) records by record id (declared id, or path:line for "
                        "undeclared ones), exact match. Combinable with --issue. Codes/ids "
                        "not found are listed in the envelope's `missing`")
    s.add_argument("--cache-read", default=None, metavar="PATH",
                   help="(D-552) Read this call's cached output from handoff.json if valid "
                        "(key derived from the arguments); skip ES query on hit")
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

    vc = sub.add_parser("verify-citations",
                        help="(ARCH-023) check the '<id> @ <path:line>' citations of an agent "
                             "report against the v3 spec index; exit 2 on any invalid one")
    vc.add_argument("--report", required=True,
                    help="File with the agent's final message (its 'Evidencias consultadas' block)")
    vc.add_argument("--client", default=None,
                    help="Client/project ID (default: derived from project-context.json)")

    args = parser.parse_args(argv)
    if args.command == "verify-citations":
        return cmd_verify_citations(args)
    if args.command == "spec-context" and (args.issue or args.ids) and (args.query or args.semantic):
        parser.error("spec-context: --issue/--ids is an exact lookup; drop --query/--semantic")
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
