#!/usr/bin/env python3
"""pipeline_events.py â€” Derived Elasticsearch sink for pipeline observability (D-412).

The journal `.md` files remain the canonical, Git-versioned source of truth.
This module emits a structured copy of each event to the index
`techlab-pipeline-events-v1` (alias `techlab-pipeline-current`) so that
progress and current status are queryable in Kibana in real time.

Contract (D-412):
- Best-effort: any failure (ES down, timeout, bad mapping) prints a warning
  to stderr and returns False. It NEVER raises and NEVER blocks the caller â€”
  the generator must keep working with zero infra (offline CI, R3).
- Stdlib only (urllib). No dependency on techlab-runtime.
- Deterministic `_id` (sha1 of client+timestamp+category+message) so that
  re-emission and backfill are idempotent.

Env:
    TECHLAB_ES_URL      â€” base URL (default http://localhost:9200)
    TECHLAB_ES_DISABLE  â€” set to "1" to turn the sink off entirely
    TECHLAB_AI_URL      â€” when set, route events through techlab-ai's managed sink
                          (POST /v1/framework/record-activity) instead of writing ES
                          directly (D-428 dual-mode). Direct ES is the fallback.

CLI (for ops, not for the pipeline hot path):
    python scripts/pipeline_events.py ensure-index [--mapping PATH]
    python scripts/pipeline_events.py backfill --journal PATH --client ID [--module M] [--stage S]
    python scripts/pipeline_events.py emit --client ID --category C --message M [...]

Exit codes (R3): 0 success | 1 user error | 2 sink unreachable (CLI only).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime
from pathlib import Path


def _load_canonical_mapping(filename: str, embedded: dict) -> dict:
    """Load a mapping from techlab-infra (canonical, D-424), falling back to the
    embedded dict. Import is best-effort so this script keeps working standalone."""
    try:
        from es_mappings import load_mapping
    except ImportError:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        try:
            from es_mappings import load_mapping
        except ImportError:
            return embedded
    return load_mapping(filename, embedded)


INDEX_V1 = "techlab-pipeline-events-v1"   # source for reindex only (D-482)
INDEX    = "techlab-pipeline-events-v2"    # canonical ECS-aligned index
ALIAS    = "techlab-pipeline-current"
TIMEOUT_S = 2.0

# ECS-aligned mapping (D-482).  Field-set layout:
#   ECS base       â€” @timestamp, message
#   ECS event.*    â€” id, action, category, type, outcome, duration, provider
#   ECS service.*  â€” name  (for command/script/agent actors)
#   ECS user.*     â€” name  (for human actors)
#   labels.*       â€” open KV (dynamic:true) for simple metadata
#   techlab.*      â€” structured complex objects (tokens, workspace, details, â€¦)
DEFAULT_MAPPING = {
    "aliases": {ALIAS: {}},
    "mappings": {
        "dynamic": "strict",
        "properties": {
            "@timestamp": {"type": "date"},
            "message": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
            },
            "event": {
                "type": "object",
                "properties": {
                    "id":       {"type": "keyword"},
                    "action":   {"type": "keyword"},
                    "category": {"type": "keyword"},
                    "type":     {"type": "keyword"},
                    "outcome":  {"type": "keyword"},
                    "duration": {"type": "long"},
                    "provider": {"type": "keyword"},
                },
            },
            "service": {
                "type": "object",
                "properties": {"name": {"type": "keyword"}},
            },
            "user": {
                "type": "object",
                "properties": {"name": {"type": "keyword"}},
            },
            "labels": {
                "type": "object",
                "dynamic": "true",
            },
            "techlab": {
                "type": "object",
                "properties": {
                    "tokens": {
                        "type": "object",
                        "properties": {
                            "input":  {"type": "long"},
                            "output": {"type": "long"},
                        },
                    },
                    "workspace": {
                        "type": "object",
                        "properties": {
                            "repo":    {"type": "keyword"},
                            "git_sha": {"type": "keyword", "index": False},
                            "version": {"type": "keyword"},
                        },
                    },
                    "artifacts":    {"type": "keyword"},
                    "decision_ids": {"type": "keyword"},
                    "details":      {"type": "flattened"},
                },
            },
        },
    },
}

# Map legacy category values â†’ (event.action, event.type array).
_ACTION_TYPE_MAP: dict[str, tuple[str, list[str]]] = {
    "PHASE-START":  ("phase-start",  ["start"]),
    "PLAN-START":   ("plan-start",   ["start"]),
    "PHASE-END":    ("phase-end",    ["end"]),
    "PLAN-END":     ("plan-end",     ["end"]),
    "DECISION":     ("decision",     ["info"]),
    "VALIDATION":   ("validation",   ["info"]),
    "BASELINE":     ("baseline",     ["info"]),
    "PHASE_START":  ("phase-start",  ["start"]),
    "PHASE_END":    ("phase-end",    ["end"]),
}

# Map legacy status values â†’ ECS event.outcome (success|failure|unknown).
_STATUS_OUTCOME: dict[str, str] = {
    "completed": "success",
    "done":      "success",
    "success":   "success",
    "failed":    "failure",
    "error":     "failure",
    "blocked":   "failure",
    "failure":   "failure",
}

_DECISION_RE = re.compile(r"\bD-\d{3}\b")


def _es_url() -> str | None:
    if os.environ.get("TECHLAB_ES_DISABLE") == "1":
        return None
    return os.environ.get("TECHLAB_ES_URL", "http://localhost:9200").rstrip("/")


def _techlab_ai_url() -> str | None:
    """Managed-activity endpoint base URL (D-428). When set, events route through
    techlab-ai instead of being written straight to ES."""
    url = os.environ.get("TECHLAB_AI_URL")
    return url.rstrip("/") if url else None


def _emit_via_techlab_ai(base_url: str, doc: dict) -> bool:
    """Managed path (D-428): POST the event to techlab-ai, which owns the ES write.
    The run trace_id travels in X-Correlation-Id so the activity correlates with the
    LLM/RAG documents techlab-ai emits for the same run.

    Returns True iff the event was accepted (2xx). On any failure returns False; the
    caller (``emit``) then falls back to a direct-ES write (D-511 â€” "se techlab falhar
    vai para ES direto"). This is safe against double-writes because both paths upsert
    the SAME idempotent ``event.id`` via ``_update``/``doc_as_upsert`` â€” a re-write is a
    no-op merge, not a duplicate. Best-effort: never raises."""
    try:
        data = json.dumps(doc).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        tid = (doc.get("labels") or {}).get("session_id")
        if tid:
            headers["X-Correlation-Id"] = tid
        req = urllib.request.Request(
            f"{base_url}/v1/framework/record-activity",
            data=data, method="POST", headers=headers,
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"warning: techlab-ai activity sink failed, "
              f"falling back to ES direct ({exc})", file=sys.stderr)
        return False


def _request(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw.strip() else {}


def event_id(client: str, timestamp: str, category: str, message: str) -> str:
    raw = f"{client}|{timestamp}|{category}|{message}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


# Git Bash on Windows converts POSIX-style command names like "/be-architect-vision"
# to absolute Windows paths ("C:/Program Files/Git/be-architect-vision") before the
# Python process ever sees them. Detect and reverse this mangling so actors are stored
# as their canonical slash-prefixed form (e.g. "/be-architect-vision").
_GIT_BASH_MANGLE_RE = re.compile(r'^[A-Za-z]:[/\\](?:[^/\\]+[/\\])*Git[/\\](.+)$')


def _normalize_actor(actor: str) -> str:
    """Restore Git Bash POSIX-path-mangled actor names to their canonical form."""
    m = _GIT_BASH_MANGLE_RE.match(actor)
    return '/' + m.group(1) if m else actor


# â”€â”€ Trace context (F2, D-423) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# One logical command run shares a single trace_id so all its events (and, in F4,
# the techlab-ai LLM/RAG calls it triggers) correlate. Bash tool calls don't share
# shell state, so env vars alone don't survive across the separate `python` processes
# a command spawns â€” the trace_id is therefore persisted to a small file that every
# emit path reads. Env still wins when set (single-process / wrapper flows).
TRACE_DIR = ".techlab"
TRACE_FILE = "trace-context.json"
TOKEN_DELTA_FILE = "token-delta.json"   # D-462: per-gate token attribution


def _trace_file() -> Path:
    return Path.cwd() / TRACE_DIR / TRACE_FILE


def _token_delta_file() -> Path:
    return Path.cwd() / TRACE_DIR / TOKEN_DELTA_FILE


def _read_token_delta() -> tuple[int, int]:
    """Return (pending_input, pending_output) from the delta file. Best-effort."""
    for base in [Path.cwd(), *Path.cwd().parents]:
        f = base / TRACE_DIR / TOKEN_DELTA_FILE
        if f.is_file():
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                return int(d.get("pending_input", 0)), int(d.get("pending_output", 0))
            except Exception:
                pass
            break
    return 0, 0


def _consume_token_delta() -> tuple[int, int]:
    """Read pending tokens and reset them to zero. Atomic write. Best-effort."""
    for base in [Path.cwd(), *Path.cwd().parents]:
        f = base / TRACE_DIR / TOKEN_DELTA_FILE
        if f.is_file():
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                pending_in  = int(d.get("pending_input", 0))
                pending_out = int(d.get("pending_output", 0))
                if pending_in == 0 and pending_out == 0:
                    return 0, 0
                d["pending_input"]  = 0
                d["pending_output"] = 0
                tmp = f.with_suffix(".tmp")
                tmp.write_text(json.dumps(d), encoding="utf-8")
                tmp.replace(f)
                return pending_in, pending_out
            except Exception:
                pass
            break
    return 0, 0


def _resolve_trace_context() -> dict:
    """Active trace context (trace_id, model, command, module). File walked up from
    cwd; env (TECHLAB_TRACE_ID / TECHLAB_MODEL) overrides. Best-effort, never raises."""
    ctx: dict = {}
    for base in [Path.cwd(), *Path.cwd().parents]:
        f = base / TRACE_DIR / TRACE_FILE
        if f.is_file():
            try:
                ctx = json.loads(f.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                ctx = {}
            break
    if os.environ.get("TECHLAB_TRACE_ID"):
        ctx["trace_id"] = os.environ["TECHLAB_TRACE_ID"]
    if os.environ.get("TECHLAB_MODEL"):
        ctx["model"] = os.environ["TECHLAB_MODEL"]
    return ctx


def trace_start(*, trace_id: str | None = None, command: str | None = None,
                module: str | None = None, model: str | None = None) -> str:
    """Mint (or set) the trace_id for the current run and persist it atomically.
    Returns the trace_id. Subsequent emits in this run inherit it automatically."""
    tid = trace_id or f"tr_{uuid.uuid4().hex[:12]}"
    ctx = {"trace_id": tid,
           "started_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")}
    if command:
        ctx["command"] = command
    if module:
        ctx["module"] = module
    if model:
        ctx["model"] = model
    f = _trace_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(ctx, indent=2), encoding="utf-8")
    tmp.replace(f)  # atomic (R3)
    return tid


def trace_ensure(*, command: str | None = None, module: str | None = None,
                 model: str | None = None) -> str:
    """Idempotent trace bootstrap (D-511): return the active run's trace_id,
    minting one only if no `.techlab/trace-context.json` exists yet.

    Unlike `trace_start` (which always mints a fresh id and clobbers context),
    this reuses an in-flight trace so a single-stage command called *inside* an
    autopilot inherits the parent trace, while the same command run *standalone*
    still gets a real trace_id instead of emitting orphan (session_id-less)
    events. Backfills missing command/module/model onto an existing context
    without overwriting the trace_id or started_at. Best-effort, never raises."""
    ctx = _resolve_trace_context()
    tid = ctx.get("trace_id")
    if not tid:
        return trace_start(command=command, module=module, model=model)
    # Reuse: fill in any metadata the parent didn't record, keep id/started_at.
    patched = dict(ctx)
    if command and not patched.get("command"):
        patched["command"] = command
    if module and not patched.get("module"):
        patched["module"] = module
    if model and not patched.get("model"):
        patched["model"] = model
    if patched != ctx:
        try:
            f = _trace_file()
            f.parent.mkdir(parents=True, exist_ok=True)
            tmp = f.with_suffix(".tmp")
            tmp.write_text(json.dumps(patched, indent=2), encoding="utf-8")
            tmp.replace(f)  # atomic (R3)
        except OSError:
            pass  # best-effort: a read-only fs must not break the run
    return tid


def trace_end() -> bool:
    """Clear the active trace context. Returns True if a file was removed."""
    f = _trace_file()
    if f.is_file():
        f.unlink()
        return True
    return False


def build_event(
    *,
    client: str,
    category: str,
    message: str,
    timestamp: str | None = None,
    module: str | None = None,
    layer: str | None = None,
    stage: str | None = None,
    status: str | None = None,
    actor: str | None = None,
    actor_type: str | None = None,
    details: dict | None = None,
    session_id: str | None = None,
    model: str | None = None,
    duration_ms: int | None = None,
    tokens_input: int | None = None,
    tokens_output: int | None = None,
    source: str = "journal",
) -> dict:
    """Build an ECS-aligned pipeline event document (D-482).

    ECS layout:
      @timestamp / message  â€” ECS base
      event.*               â€” id, action, category, type, outcome, duration, provider
      service.name          â€” actor when actor_type is command/script/agent
      user.name             â€” actor when actor_type is human
      labels.*              â€” flat KV metadata (client, module, layer, stage, model, session_id)
      techlab.*             â€” structured objects (tokens, workspace, decision_ids, details)
    """
    ts = timestamp or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    ev_id = event_id(client, ts, category, message)

    action, ev_type = _ACTION_TYPE_MAP.get(category.upper(), (category.lower(), ["info"]))
    outcome = _STATUS_OUTCOME.get((status or "").lower()) if status else None

    ev: dict = {
        "id":       ev_id,
        "action":   action,
        "category": ["process"],
        "type":     ev_type,
        "provider": source,
    }
    if outcome:
        ev["outcome"] = outcome
    if duration_ms is not None:
        ev["duration"] = duration_ms * 1_000_000  # ECS: nanoseconds

    doc: dict = {
        "@timestamp": ts,
        "message":    message,
        "event":      ev,
        "labels":     {"client": client},
    }

    if module:
        doc["labels"]["module"] = module
    if layer:
        doc["labels"]["layer"] = layer
    if stage:
        doc["labels"]["stage"] = stage

    if actor:
        actor = _normalize_actor(actor)
        a_type = actor_type or (
            "command" if actor.startswith("/")
            else "script" if actor.endswith(".py")
            else "human" if actor == "human"
            else "agent"
        )
        doc["labels"]["actor_type"] = a_type
        if a_type == "human":
            doc["user"] = {"name": actor}
        else:
            doc["service"] = {"name": actor}

    # F2 (D-423): trace_id and model auto-resolve from run context when not passed.
    if session_id is None or model is None:
        tctx = _resolve_trace_context()
        session_id = session_id or tctx.get("trace_id")
        model = model or tctx.get("model")
    # D-511: defence-in-depth â€” never index an orphan (session_id-less) event.
    # If no trace context exists (command emitted without trace-ensure), mint one
    # so every event is correlatable. trace_ensure persists it for sibling emits.
    if not session_id:
        session_id = trace_ensure(command=actor, module=module, model=model)
    if session_id:
        doc["labels"]["session_id"] = session_id
    if model:
        doc["labels"]["model"] = model

    # techlab namespace: complex objects
    techlab: dict = {}
    ids = sorted(set(_DECISION_RE.findall(message)))
    if ids:
        techlab["decision_ids"] = ids
    if details:
        techlab["details"] = details
    tokens: dict = {}
    if tokens_input is not None:
        tokens["input"] = tokens_input
    if tokens_output is not None:
        tokens["output"] = tokens_output
    if tokens:
        techlab["tokens"] = tokens
    if techlab:
        doc["techlab"] = techlab

    return doc


# Transport actually used by the most recent emit() â€” surfaced by the CLI so commands
# can report it (and flag a fallback) in the D-511 final summary instead of guessing.
LAST_TRANSPORT: str | None = None


def emit(doc: dict) -> bool:
    """Upsert one event using the ES Update API (doc_as_upsert=true).

    Using _update instead of _doc PUT ensures idempotent *merging*: fields
    present in an existing document but absent from the new `doc` are preserved.
    This is critical for backfill re-runs â€” they must correct specific fields
    (e.g. actor normalization) without wiping fields set by the live emitter
    (e.g. module, stage set when the live journal.py call included --module).

    Transport (D-428): when ``TECHLAB_AI_URL`` is set the event is routed through
    techlab-ai's managed sink (single writer, central redaction/correlation);
    otherwise it is written straight to ES (the zero-infra fallback). Both paths
    are best-effort and share the same idempotent ``event.id`` upsert semantics.
    """
    global LAST_TRANSPORT
    managed = _techlab_ai_url()
    fellback = False
    if managed is not None:
        if _emit_via_techlab_ai(managed, doc):
            LAST_TRANSPORT = "techlab-ai"
            return True
        # techlab-ai failed â†’ fall back to ES direct (D-511). Idempotent by event.id,
        # so this never duplicates. Managed mode skips the upfront ensure_index â€” run
        # it now so the direct write has a target index. The fallback is announced
        # explicitly (stderr warning above + transport label below) so a silent
        # degradation never passes for "routed via techlab-ai".
        fellback = True
        ensure_index()
    base = _es_url()
    if base is None:
        LAST_TRANSPORT = "dropped"
        return False
    try:
        doc_id = doc["event"]["id"]
        body = {"doc": doc, "doc_as_upsert": True}
        _request("POST", f"{base}/{INDEX}/_update/{doc_id}", body)
        LAST_TRANSPORT = "ES-direct(fallback:techlab-ai-down)" if fellback else "ES-direct"
        return True
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"warning: ES sink skipped ({exc})", file=sys.stderr)
        LAST_TRANSPORT = "dropped"
        return False


def emit_project_event(
    context_path: Path,
    *,
    category: str,
    message: str,
    module: str | None = None,
    stage: str | None = None,
    status: str | None = None,
    actor: str | None = None,
    details: dict | None = None,
    source: str = "context",
) -> bool:
    """Emit an event for a project mutation, deriving `client` from
    project-context.json (`project.name`). Best-effort: never raises."""
    try:
        ctx = json.loads(Path(context_path).read_text(encoding="utf-8"))
        client = ctx.get("project", {}).get("name")
        if not client:
            return False
        # In managed mode techlab-ai owns the index; don't gate on a direct-ES probe.
        if _techlab_ai_url() is None and not ensure_index():
            return False
        doc = build_event(
            client=client, category=category, message=message,
            module=module, stage=stage, status=status, actor=actor,
            details=details, source=source,
        )
        return emit(doc)
    except Exception as exc:
        print(f"warning: ES sink skipped ({exc})", file=sys.stderr)
        return False


# Maps project/checklist status vocabulary â†’ event status (D-412).
EVENT_STATUS = {
    "in-progress": "started",
    "done": "completed",
    "blocked": "blocked",
    "skipped": "info",
    "pending": "info",
}


def ensure_index(mapping_path: Path | None = None) -> bool:
    base = _es_url()
    if base is None:
        return False
    if mapping_path:
        body = json.loads(mapping_path.read_text(encoding="utf-8"))
    else:
        # Canonical mapping lives in techlab-infra (D-424); DEFAULT_MAPPING is the
        # offline fallback. A CI parity check keeps the two from drifting.
        body = _load_canonical_mapping("pipeline_events_v2_mapping.json", DEFAULT_MAPPING)
    try:
        _request("HEAD", f"{base}/{INDEX}")
        return True
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            print(f"warning: ES sink skipped ({exc})", file=sys.stderr)
            return False
    except (urllib.error.URLError, OSError) as exc:
        print(f"warning: ES sink skipped ({exc})", file=sys.stderr)
        return False
    try:
        _request("PUT", f"{base}/{INDEX}", body)
        print(f"OK: created index {INDEX} (alias {ALIAS})", file=sys.stderr)
        return True
    except (urllib.error.URLError, OSError) as exc:
        print(f"warning: could not create {INDEX} ({exc})", file=sys.stderr)
        return False


# â”€â”€ Backfill from an existing journal .md â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_DATE_RE = re.compile(r"^## (\d{4}-\d{2}-\d{2})\s*$")
_ENTRY_RE = re.compile(r"^### (\d{2}:\d{2}:\d{2}) UTC â€” \[([A-Z\-]+)\] (.+)$")
_ACTOR_RE = re.compile(r"^- \*\*Ator:\*\* (.+)$")


def backfill(journal: Path, client: str, module: str | None, stage: str | None) -> int:
    """Parse a project-journal.md and index every entry. Returns count indexed."""
    count = 0
    current_date = None
    pending: dict | None = None
    lines = journal.read_text(encoding="utf-8").splitlines()
    for line in [*lines, ""]:
        m = _DATE_RE.match(line)
        if m:
            current_date = m.group(1)
            continue
        e = _ENTRY_RE.match(line)
        a = _ACTOR_RE.match(line)
        if e and current_date:
            if pending and emit(pending):
                count += 1
            ts = f"{current_date}T{e.group(1)}Z"
            pending = build_event(
                client=client, category=e.group(2), message=e.group(3),
                timestamp=ts, module=module, stage=stage, source="backfill",
            )
        elif a and pending:
            actor = _normalize_actor(a.group(1))
            a_type = (
                "command" if actor.startswith("/")
                else "script" if actor.endswith(".py")
                else "human" if actor == "human" else "agent"
            )
            pending.setdefault("labels", {})["actor_type"] = a_type
            if a_type == "human":
                pending["user"] = {"name": actor}
            else:
                pending["service"] = {"name": actor}
    if pending and emit(pending):
        count += 1
    return count


# â”€â”€ Reindex v1 â†’ v2 (D-482) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def _transform_v1_to_v2(src: dict) -> dict:
    """Convert a v1 flat document to the ECS v2 structure."""
    category = src.get("category", "")
    action, ev_type = _ACTION_TYPE_MAP.get(category.upper(), (category.lower(), ["info"]))
    status = src.get("status")
    outcome = _STATUS_OUTCOME.get((status or "").lower()) if status else None
    duration_ms = src.get("duration_ms")

    ev: dict = {
        "id":       src.get("event_id", ""),
        "action":   action,
        "category": ["process"],
        "type":     ev_type,
        "provider": src.get("source", "backfill"),
    }
    if outcome:
        ev["outcome"] = outcome
    if duration_ms is not None:
        ev["duration"] = duration_ms * 1_000_000

    labels: dict = {"client": src.get("client", "")}
    for f in ("module", "layer", "stage", "model", "session_id"):
        val = src.get(f)
        if val:
            labels[f] = val
    actor = src.get("actor")
    if actor:
        a_type = src.get("actor_type", "agent")
        labels["actor_type"] = a_type

    doc: dict = {
        "@timestamp": src.get("@timestamp", ""),
        "message":    src.get("message", ""),
        "event":      ev,
        "labels":     labels,
    }

    if actor:
        if labels.get("actor_type") == "human":
            doc["user"] = {"name": actor}
        else:
            doc["service"] = {"name": actor}

    techlab: dict = {}
    for f in ("decision_ids", "artifacts"):
        val = src.get(f)
        if val:
            techlab[f] = val
    for f in ("tokens", "workspace", "details"):
        val = src.get(f)
        if val:
            techlab[f] = val
    if techlab:
        doc["techlab"] = techlab

    return doc


def reindex_v1_to_v2(*, dry_run: bool = False) -> int:
    """Scroll v1, transform each doc to ECS v2, bulk-index into v2.
    Idempotent: uses doc_as_upsert via emit(). Returns 0 on success."""
    base = _es_url()
    if base is None:
        print("error: ES_URL not available (TECHLAB_ES_DISABLE=1?)", file=sys.stderr)
        return 2
    ensure_index()
    scroll_size = 500
    try:
        body = {"query": {"match_all": {}}, "size": scroll_size}
        resp = _request("POST", f"{base}/{INDEX_V1}/_search?scroll=2m", body)
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"error: could not scroll {INDEX_V1} ({exc})", file=sys.stderr)
        return 2

    scroll_id = resp.get("_scroll_id")
    hits = resp.get("hits", {}).get("hits", [])
    total = resp.get("hits", {}).get("total", {}).get("value", 0)
    print(f"info: reindexing {total} docs from {INDEX_V1} -> {INDEX}")

    count = 0
    while hits:
        for hit in hits:
            doc = _transform_v1_to_v2(hit["_source"])
            if not dry_run:
                emit(doc)
            count += 1
        try:
            resp = _request("POST", f"{base}/_search/scroll",
                            {"scroll": "2m", "scroll_id": scroll_id})
            scroll_id = resp.get("_scroll_id", scroll_id)
            hits = resp.get("hits", {}).get("hits", [])
        except (urllib.error.URLError, OSError, ValueError):
            break

    try:
        _request("DELETE", f"{base}/_search/scroll", {"scroll_id": scroll_id})
    except Exception:
        pass

    label = "dry-run, " if dry_run else ""
    print(f"OK: {label}reindexed {count} docs from {INDEX_V1} to {INDEX}")
    return 0


# â”€â”€ CLI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline_events.py",
                                     description="Derived ES sink for pipeline events (D-412)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_idx = sub.add_parser("ensure-index", help="Create the events index if absent")
    p_idx.add_argument("--mapping", type=Path, default=None,
                       help="Mapping JSON (default: built-in, mirrors techlab-infra)")

    p_emit = sub.add_parser("emit", help="Emit a single event")
    p_emit.add_argument("--client", default=None,
                        help="Client/project ID (default: derived from project-context.json)")
    p_emit.add_argument("--category", required=True)
    p_emit.add_argument("--message", required=True)
    p_emit.add_argument("--module", default=None)
    p_emit.add_argument("--layer", default=None)
    p_emit.add_argument("--stage", default=None)
    p_emit.add_argument("--status", default=None)
    p_emit.add_argument("--actor", default=None)
    p_emit.add_argument("--details", default=None,
                        help="Structured payload as a JSON string (score, checklist, gates, â€¦)")
    # F2 (D-423): correlation + cost fields. trace-id/model auto-resolve from the run's
    # trace context when omitted; pass explicitly to override.
    p_emit.add_argument("--trace-id", dest="trace_id", default=None,
                        help="Correlation id for the run (default: trace context / env)")
    p_emit.add_argument("--model", default=None,
                        help="LLM model the agent ran on (default: trace context / env)")
    p_emit.add_argument("--duration-ms", dest="duration_ms", type=int, default=None)
    p_emit.add_argument("--tokens-input", dest="tokens_input", type=int, default=None)
    p_emit.add_argument("--tokens-output", dest="tokens_output", type=int, default=None)

    p_ts = sub.add_parser("trace-start",
                          help="Mint/set the run trace_id (.techlab/trace-context.json)")
    p_ts.add_argument("--trace-id", dest="trace_id", default=None,
                      help="Use this id instead of minting one")
    # dest must NOT be "command": the subparsers already bind args.command to the
    # subcommand name; a --command flag with the default dest would clobber it.
    p_ts.add_argument("--command", dest="run_command", default=None)
    p_ts.add_argument("--module", default=None)
    p_ts.add_argument("--model", default=None)

    p_te = sub.add_parser("trace-ensure",
                          help="Return the run trace_id, minting only if none exists (D-511)")
    p_te.add_argument("--command", dest="run_command", default=None)
    p_te.add_argument("--module", default=None)
    p_te.add_argument("--model", default=None)

    sub.add_parser("trace-end", help="Clear the active run trace context")

    p_bf = sub.add_parser("backfill", help="Index all entries of an existing journal .md")
    p_bf.add_argument("--journal", type=Path, required=True)
    p_bf.add_argument("--client", required=True)
    p_bf.add_argument("--module", default=None)
    p_bf.add_argument("--stage", default=None)

    p_rx = sub.add_parser("reindex",
                          help=f"Transform {INDEX_V1} â†’ {INDEX} (ECS migration, D-482)")
    p_rx.add_argument("--dry-run", action="store_true",
                      help="Count docs to migrate without writing to v2")

    args = parser.parse_args(argv)

    if args.command == "ensure-index":
        return 0 if ensure_index(args.mapping) else 2
    if args.command == "emit":
        client = args.client
        if not client:
            # Auto-derive from project-context.json (walk up from cwd)
            for candidate in [Path("project-context.json"),
                               *[p / "project-context.json" for p in Path.cwd().parents]]:
                if candidate.exists():
                    try:
                        ctx = json.loads(candidate.read_text(encoding="utf-8"))
                        client = ctx.get("project", {}).get("name")
                    except Exception:
                        pass
                    if client:
                        break
        if not client:
            print("error: --client not provided and project-context.json not found", file=sys.stderr)
            return 1
        details = None
        if args.details:
            try:
                details = json.loads(args.details)
            except json.JSONDecodeError as exc:
                print(f"error: --details is not valid JSON: {exc}", file=sys.stderr)
                return 1
        # D-462: auto-read accumulated token delta when caller doesn't supply counts.
        # The Stop hook writes deltas to .techlab/token-delta.json after each agent
        # turn; emit consumes and resets them so each gate event carries its own cost.
        tokens_input  = args.tokens_input
        tokens_output = args.tokens_output
        if tokens_input is None and tokens_output is None:
            tokens_input, tokens_output = _consume_token_delta()
            if tokens_input == 0 and tokens_output == 0:
                tokens_input = tokens_output = None  # nothing pending â€” omit field

        if _techlab_ai_url() is None:
            ensure_index()  # managed mode: techlab-ai creates the index on write
        doc = build_event(client=client, category=args.category, message=args.message,
                          module=args.module, layer=args.layer, stage=args.stage,
                          status=args.status, actor=args.actor, details=details,
                          session_id=args.trace_id, model=args.model,
                          duration_ms=args.duration_ms, tokens_input=tokens_input,
                          tokens_output=tokens_output, source="direct")
        if emit(doc):
            print(f"OK: emitted {doc['event']['id'][:12]} [{args.category}] via={LAST_TRANSPORT}")
            if LAST_TRANSPORT and LAST_TRANSPORT.startswith("ES-direct(fallback"):
                print("warning: techlab-ai sink unavailable â€” event routed to ES direct "
                      "(fallback). Report this in the run summary.", file=sys.stderr)
            return 0
        print(f"warning: event NOT recorded (transport={LAST_TRANSPORT})", file=sys.stderr)
        return 2
    if args.command == "trace-start":
        tid = trace_start(trace_id=args.trace_id, command=args.run_command,
                          module=args.module, model=args.model)
        print(tid)
        return 0
    if args.command == "trace-ensure":
        tid = trace_ensure(command=args.run_command,
                           module=args.module, model=args.model)
        print(tid)
        return 0
    if args.command == "trace-end":
        trace_end()
        print("OK: trace context cleared")
        return 0
    if args.command == "backfill":
        if not args.journal.exists():
            print(f"error: journal not found: {args.journal}", file=sys.stderr)
            return 1
        ensure_index()
        n = backfill(args.journal, args.client, args.module, args.stage)
        print(f"OK: backfilled {n} event(s) from {args.journal.name}")
        return 0
    if args.command == "reindex":
        return reindex_v1_to_v2(dry_run=args.dry_run)
    return 1


if __name__ == "__main__":
    sys.exit(main())
