#!/usr/bin/env python3
"""issue-tracker.py — Issue status lifecycle: .md write-back + GitHub Projects v2 + ES (D-481).

Manages issue status across three surfaces kept in sync:
  1. .md files (source of truth) — adds/updates <!-- status: X --> comment
  2. GitHub Projects v2 — updates the Status field via gh CLI + GraphQL
  3. Elasticsearch — snapshot in techlab-issues-v1 + transitions in techlab-issue-transitions-v1

Status board (aligned with GitHub Projects v2 board columns):
  backlog → ready → in-progress → in-review → done
                                      ↑              │
                                      └── (reopen) ──┘

Agent → status transition table:
  be-architect-backlog   creates issue .md       → backlog
  be-validator           BASELINE approval        → ready
  be-implement           starts priority          → in-progress
  be-implement           finishes priority        → in-review
  be-validator           VALIDATION pass          → done
  be-validator           VALIDATION fail (reopen) → in-progress

Subcommands:
  github-setup   Discover GitHub Project + Status field options; cache in .techlab/
  set-status     Transition one issue across all three surfaces
  sync           Bulk-sync all .md files → ES snapshot index (idempotent)
  list           Read current status from .md files (no writes)

Exit codes (R3): 0 success | 1 user error | 2 partial/validation failure.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────────────

VALID_STATUSES = ("backlog", "ready", "in-progress", "in-review", "done")

# Regex anchors in .md files
_STATUS_RE  = re.compile(r"<!--\s*status:\s*(\S+?)\s*-->")
_GITHUB_RE  = re.compile(r"<!--\s*github-issue:\s*(\d+)\s*-->")
_H1_RE      = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
_PRIO_RE    = re.compile(r"(?:Prioridade|Priority)[:\s]+\**(P[1-9])\**", re.IGNORECASE)
_MODULE_RE  = re.compile(r"^([A-Z]+-[A-Z]+|[A-Z]+)-\d+")  # AUD-001, INT-FE-001

# ES
ES_URL          = os.environ.get("TECHLAB_ES_URL", "http://localhost:9200")
ES_TIMEOUT      = 3.0
IDX_SNAPSHOT    = "techlab-issues-v1"
IDX_TRANSITIONS = "techlab-issue-transitions-v1"

# Issue directories per layer
LAYER_DIRS = {
    "be": "docs/architecture/backend/issues",
    "fe": "docs/architecture/frontend/issues",
}
_SKIP_RE = re.compile(r"^(issues_map|index|readme)", re.IGNORECASE)

# GitHub Projects v2 config cache (relative to project root)
GH_CONFIG_PATH = ".techlab/github-project-config.json"


# ── Project root resolution ────────────────────────────────────────────────────

def find_project_root(override: str | None = None) -> Path:
    """Walk up from cwd looking for project-context.json (R3)."""
    if override:
        return Path(override).resolve()
    cur = Path.cwd().resolve()
    for p in (cur, *cur.parents):
        if (p / "project-context.json").exists():
            return p
        if (p / "docs" / "architecture").is_dir():
            return p
    return cur


def find_workspace_root() -> Path:
    """Walk up from cwd looking for techlab-architecture workspace."""
    cur = Path.cwd().resolve()
    for p in (cur, *cur.parents):
        if (p / "pyproject.toml").exists() and (p / "scripts" / "issue-tracker.py").exists():
            return p
        if (p / "clients").is_dir() and (p / "scripts").is_dir():
            return p
    return cur


def resolve_client_root(client: str) -> Path:
    """Resolve project root for a client registered in this workspace."""
    ws = find_workspace_root()
    client_json = ws / "clients" / client / "client.json"
    if client_json.exists():
        data = json.loads(client_json.read_text(encoding="utf-8"))
        raw = data.get("project_path") or data.get("path", "")
        path = Path(raw)
        if raw and path.is_dir():
            return path
    # fallback: try as direct path
    p = Path(client)
    if p.is_dir():
        return p.resolve()
    raise SystemExit(f"error: client '{client}' not found in clients/ registry and is not a valid path")


# ── .md file helpers ───────────────────────────────────────────────────────────

def issue_files(root: Path) -> list[Path]:
    """All .md issue files across be and fe layers."""
    files: list[Path] = []
    for layer_dir in LAYER_DIRS.values():
        d = root / layer_dir
        if d.is_dir():
            files.extend(
                sorted(f for f in d.glob("*.md") if not _SKIP_RE.match(f.name))
            )
    return files


def issue_files_for_layer(root: Path, layer: str) -> list[Path]:
    d = root / LAYER_DIRS[layer]
    if not d.is_dir():
        return []
    return sorted(f for f in d.glob("*.md") if not _SKIP_RE.match(f.name))


def parse_issue_md(path: Path) -> dict:
    """Extract metadata from an issue .md file."""
    text = path.read_text(encoding="utf-8", errors="replace")
    h1 = _H1_RE.search(text)
    gh = _GITHUB_RE.search(text)
    st = _STATUS_RE.search(text)
    pr = _PRIO_RE.search(text)
    stem = path.stem  # e.g. AUD-001
    m = _MODULE_RE.match(stem)
    module = m.group(1) if m else stem.rsplit("-", 1)[0]
    layer = "fe" if "frontend" in str(path) else "be"
    return {
        "issue_id":           stem,
        "module":             module,
        "layer":              layer,
        "title":              h1.group(1).strip() if h1 else stem,
        "status":             st.group(1).strip() if st else "backlog",
        "priority":           pr.group(1) if pr else None,
        "github_issue_number": int(gh.group(1)) if gh else None,
        "_text":              text,
        "_path":              path,
    }


def write_status_marker(path: Path, text: str, status: str) -> None:
    """Insert or update <!-- status: X --> in the .md file (atomic write, R3)."""
    if _STATUS_RE.search(text):
        new_text = _STATUS_RE.sub(f"<!-- status: {status} -->", text, count=1)
    else:
        # Insert after <!-- github-issue: NNN --> if present, else after H1
        lines = text.splitlines(keepends=True)
        out: list[str] = []
        inserted = False
        for line in lines:
            out.append(line)
            if not inserted:
                is_github_marker = bool(_GITHUB_RE.match(line.strip()))
                is_h1 = line.lstrip().startswith("# ")
                if is_github_marker or (is_h1 and not any(_GITHUB_RE.search(ln) for ln in lines)):
                    out.append(f"<!-- status: {status} -->\n")
                    inserted = True
        if not inserted:
            out.insert(0, f"<!-- status: {status} -->\n")
        new_text = "".join(out)

    tmp = path.with_suffix(".md.tmp")
    tmp.write_text(new_text, encoding="utf-8")
    tmp.replace(path)


# ── ES helpers ────────────────────────────────────────────────────────────────

def _es_request(method: str, path: str, body: dict | None = None) -> dict | None:
    """Best-effort ES request (R3: never blocks caller)."""
    url = ES_URL.rstrip("/") + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=ES_TIMEOUT) as resp:
            return json.loads(resp.read())
    except Exception as exc:
        print(f"warning: ES {method} {path} failed: {exc}", file=sys.stderr)
        return None


def _event_id(*parts: str) -> str:
    """Deterministic SHA1 event ID (idempotent upsert)."""
    return hashlib.sha1("|".join(parts).encode()).hexdigest()


def es_upsert_snapshot(issue: dict, client: str, service: str | None = None) -> bool:
    """Upsert one issue into the snapshot index."""
    now = datetime.now(UTC).isoformat()
    doc = {
        "@timestamp":          now,
        "issue_id":            issue["issue_id"],
        "client":              client,
        "module":              issue["module"],
        "layer":               issue["layer"],
        "service":             service or issue["module"].lower(),
        "title":               issue["title"],
        "status":              issue["status"],
        "priority":            issue["priority"],
        "github_issue_number": issue.get("github_issue_number"),
        "updated_at":          now,
    }
    doc_id = f"{client}_{issue['issue_id']}"
    result = _es_request("POST", f"/{IDX_SNAPSHOT}/_update/{doc_id}",
                         {"doc": doc, "doc_as_upsert": True})
    return result is not None


def es_emit_transition(issue_id: str, client: str, from_status: str | None,
                       to_status: str, agent: str, phase: str,
                       session_id: str | None) -> bool:
    """Append one transition event to the transitions index."""
    now = datetime.now(UTC).isoformat()
    eid = _event_id(client, issue_id, to_status, now[:16], agent)
    doc = {
        "@timestamp":  now,
        "event_id":    eid,
        "issue_id":    issue_id,
        "client":      client,
        "from_status": from_status,
        "to_status":   to_status,
        "changed_by":  agent,
        "agent_phase": phase,
        "session_id":  session_id,
    }
    result = _es_request("POST", f"/{IDX_TRANSITIONS}/_update/{eid}",
                         {"doc": doc, "doc_as_upsert": True})
    return result is not None


def ensure_es_indices() -> None:
    """Create ES indices with mappings if they do not exist (idempotent)."""
    snapshot_mapping = {
        "settings": {"number_of_shards": 1, "number_of_replicas": 1},
        "mappings": {
            "dynamic": "strict",
            "properties": {
                "@timestamp":          {"type": "date"},
                "issue_id":            {"type": "keyword"},
                "client":              {"type": "keyword"},
                "module":              {"type": "keyword"},
                "layer":               {"type": "keyword"},
                "service":             {"type": "keyword"},
                "title":               {"type": "text",
                                        "fields": {"keyword": {"type": "keyword"}}},
                "status":              {"type": "keyword"},
                "priority":            {"type": "keyword"},
                "github_issue_number": {"type": "integer"},
                "updated_at":          {"type": "date"},
            },
        },
    }
    transitions_mapping = {
        "settings": {"number_of_shards": 2, "number_of_replicas": 1},
        "mappings": {
            "dynamic": "strict",
            "properties": {
                "@timestamp":  {"type": "date"},
                "event_id":    {"type": "keyword"},
                "issue_id":    {"type": "keyword"},
                "client":      {"type": "keyword"},
                "from_status": {"type": "keyword"},
                "to_status":   {"type": "keyword"},
                "changed_by":  {"type": "keyword"},
                "agent_phase": {"type": "keyword"},
                "session_id":  {"type": "keyword"},
            },
        },
    }
    for idx, mapping in [(IDX_SNAPSHOT, snapshot_mapping),
                          (IDX_TRANSITIONS, transitions_mapping)]:
        resp = _es_request("HEAD", f"/{idx}")
        if resp is None:  # index does not exist (HEAD returns None on 404 or error)
            _es_request("PUT", f"/{idx}", mapping)


# ── GitHub helpers ────────────────────────────────────────────────────────────

def _gh(*args: str, stdin: str | None = None) -> tuple[int, str, str]:
    """Run gh CLI; return (returncode, stdout, stderr)."""
    proc = subprocess.run(
        ["gh", *args],
        input=stdin, capture_output=True, text=True,
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def _gh_graphql(query: str, variables: dict | None = None) -> dict | None:
    """Call GitHub GraphQL via gh cli."""
    args = ["api", "graphql", "-f", f"query={query}"]
    if variables:
        for k, v in variables.items():
            args += ["-F", f"{k}={v}"]
    rc, out, err = _gh(*args)
    if rc != 0:
        print(f"warning: gh graphql failed: {err}", file=sys.stderr)
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def load_gh_config(root: Path) -> dict | None:
    cfg_path = root / GH_CONFIG_PATH
    if cfg_path.exists():
        return json.loads(cfg_path.read_text(encoding="utf-8"))
    return None


def save_gh_config(root: Path, config: dict) -> None:
    cfg_path = root / GH_CONFIG_PATH
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = cfg_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(cfg_path)


def gh_update_project_status(root: Path, github_issue_number: int,
                              status: str) -> bool:
    """Update the Status field in GitHub Projects v2 for an issue."""
    cfg = load_gh_config(root)
    if not cfg:
        print("warning: github-project-config not found — run github-setup first",
              file=sys.stderr)
        return False

    option_id = cfg.get("status_options", {}).get(status)
    if not option_id:
        print(f"warning: no GitHub Projects option mapped for status '{status}'",
              file=sys.stderr)
        return False

    project_id = cfg["project_id"]
    status_field_id = cfg["status_field_id"]
    owner = cfg["owner"]
    repo_name = cfg.get("repo", "").split("/")[-1]

    # 1. Find the project item ID for this issue
    find_item_query = """
    query($owner: String!, $repo: String!, $issue: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issue) {
          projectItems(first: 10) {
            nodes { id project { id } }
          }
        }
      }
    }
    """
    resp = _gh_graphql(find_item_query, {
        "owner": owner, "repo": repo_name, "issue": str(github_issue_number)
    })
    if not resp:
        return False

    nodes = (resp.get("data", {})
                 .get("repository", {})
                 .get("issue", {})
                 .get("projectItems", {})
                 .get("nodes", []))
    item_id = next(
        (n["id"] for n in nodes if n.get("project", {}).get("id") == project_id),
        None,
    )
    if not item_id:
        print(f"warning: issue #{github_issue_number} not found in project",
              file=sys.stderr)
        return False

    # 2. Update the Status field
    update_mutation = """
    mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project
        itemId: $item
        fieldId: $field
        value: { singleSelectOptionId: $option }
      }) {
        projectV2Item { id }
      }
    }
    """
    result = _gh_graphql(update_mutation, {
        "project": project_id,
        "item":    item_id,
        "field":   status_field_id,
        "option":  option_id,
    })
    return result is not None


def gh_resolve_repo(explicit: str | None) -> str | None:
    if explicit:
        return explicit
    rc, out, _ = _gh("repo", "view", "--json", "nameWithOwner",
                      "-q", ".nameWithOwner")
    return out if rc == 0 and out else None


def read_session_id() -> str | None:
    """Read trace_id from .techlab/trace-context.json if present."""
    for candidate in [Path(".techlab/trace-context.json"),
                      Path.cwd() / ".techlab" / "trace-context.json"]:
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                return data.get("trace_id") or data.get("session_id")
            except Exception:
                pass
    return None


# ── Subcommand: github-setup ──────────────────────────────────────────────────

def cmd_github_setup(args: argparse.Namespace) -> int:
    """Discover GitHub Projects v2 config and cache it."""
    root = resolve_client_root(args.client)

    import shutil
    if shutil.which("gh") is None:
        print("error: gh CLI not found", file=sys.stderr)
        return 1

    repo = gh_resolve_repo(getattr(args, "repo", None))
    if not repo:
        print("error: could not resolve GitHub repo (configure gh or pass --repo)",
              file=sys.stderr)
        return 1

    owner, repo_name = repo.split("/", 1)

    # List projects
    list_query = """
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        projectsV2(first: 20) {
          nodes {
            id number title
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id name
                  options { id name }
                }
              }
            }
          }
        }
      }
    }
    """
    resp = _gh_graphql(list_query, {"owner": owner, "repo": repo_name})
    if not resp:
        print("error: could not query GitHub Projects v2", file=sys.stderr)
        return 1

    projects = (resp.get("data", {})
                    .get("repository", {})
                    .get("projectsV2", {})
                    .get("nodes", []))

    if not projects:
        print(f"error: no GitHub Projects v2 found for {repo}", file=sys.stderr)
        return 1

    # Select project
    if getattr(args, "project_number", None):
        project = next((p for p in projects
                        if p["number"] == args.project_number), None)
        if not project:
            print(f"error: project #{args.project_number} not found", file=sys.stderr)
            return 1
    elif len(projects) == 1:
        project = projects[0]
    else:
        print("Available projects:")
        for p in projects:
            print(f"  #{p['number']}  {p['title']}")
        print("\nRe-run with --project-number N to select one.")
        return 1

    print(f"Using project: #{project['number']} — {project['title']}")

    # Find Status field
    status_field = None
    for field in project.get("fields", {}).get("nodes", []):
        if field.get("name", "").lower() == "status" and "options" in field:
            status_field = field
            break

    if not status_field:
        print("error: no 'Status' single-select field found in this project",
              file=sys.stderr)
        print("Available fields:", [f.get("name") for f
                                     in project.get("fields", {}).get("nodes", [])])
        return 1

    print(f"Status field: {status_field['id']}")
    print("Available options:")
    for opt in status_field["options"]:
        print(f"  {opt['id']}  →  {opt['name']}")

    # Interactive mapping
    print(f"\nMap GitHub option names to TechLab statuses {VALID_STATUSES}.")
    print("For each TechLab status, type the exact GitHub option name (or Enter to skip):")

    status_options: dict[str, str] = {}
    option_by_name = {o["name"]: o["id"] for o in status_field["options"]}
    option_by_name_lower = {k.lower(): v for k, v in option_by_name.items()}

    for ts in VALID_STATUSES:
        # Try auto-match first (case-insensitive)
        auto = option_by_name_lower.get(ts) or option_by_name_lower.get(ts.replace("-", " "))
        if auto:
            matched = next(k for k, v in option_by_name.items() if v == auto)
            print(f"  {ts} → auto-matched: {matched}")
            status_options[ts] = auto
        else:
            val = input(f"  {ts} → GitHub option name: ").strip()
            if val and val in option_by_name:
                status_options[ts] = option_by_name[val]
            elif val:
                print(f"    warning: '{val}' not found in options — skipping")

    config = {
        "owner":            owner,
        "repo":             repo,
        "project_number":   project["number"],
        "project_id":       project["id"],
        "project_title":    project["title"],
        "status_field_id":  status_field["id"],
        "status_options":   status_options,
    }

    save_gh_config(root, config)
    print(f"\nOK: config saved to {root / GH_CONFIG_PATH}")
    print(f"    Mapped {len(status_options)}/{len(VALID_STATUSES)} statuses")

    unmapped = [s for s in VALID_STATUSES if s not in status_options]
    if unmapped:
        print(f"    Not mapped: {unmapped} — GitHub will not be updated for these")
    return 0


# ── Subcommand: set-status ────────────────────────────────────────────────────

def cmd_set_status(args: argparse.Namespace) -> int:
    """Transition one issue: update .md + GitHub Projects + ES."""
    if args.status not in VALID_STATUSES:
        print(f"error: invalid status '{args.status}'. Valid: {VALID_STATUSES}",
              file=sys.stderr)
        return 1

    root = resolve_client_root(args.client)
    issue_id = args.issue.upper()

    # Locate the .md file
    issue_file: Path | None = None
    for layer_dir in LAYER_DIRS.values():
        candidate = root / layer_dir / f"{issue_id}.md"
        if candidate.exists():
            issue_file = candidate
            break

    if not issue_file:
        print(f"error: issue file '{issue_id}.md' not found in be or fe issue dirs",
              file=sys.stderr)
        return 1

    issue = parse_issue_md(issue_file)
    from_status = issue["status"]

    if from_status == args.status and not getattr(args, "force", False):
        print(f"info: issue {issue_id} is already '{args.status}' — no change")
        return 0

    errors = 0

    # 1. Write .md
    write_status_marker(issue_file, issue["_text"], args.status)
    print(f"OK: .md updated  {issue_id}  {from_status} → {args.status}")

    # 2. GitHub Projects v2
    gh_num = issue.get("github_issue_number")
    if gh_num:
        ok = gh_update_project_status(root, gh_num, args.status)
        if ok:
            print(f"OK: GitHub #{ gh_num} Status → {args.status}")
        else:
            print(f"warn: GitHub update failed for #{gh_num} (best-effort)")
    else:
        print(f"info: no github-issue marker in {issue_id}.md — skipping GitHub update")

    # 3. ES
    ensure_es_indices()
    session_id = getattr(args, "session_id", None) or read_session_id()
    agent = getattr(args, "agent", "unknown")
    phase = getattr(args, "phase", "MANUAL")

    # Update snapshot
    issue["status"] = args.status
    ok_snap = es_upsert_snapshot(issue, args.client)
    if ok_snap:
        print(f"OK: ES snapshot updated  {IDX_SNAPSHOT}")
    else:
        print("warn: ES snapshot failed (best-effort)")

    # Append transition
    ok_trans = es_emit_transition(
        issue_id=issue_id,
        client=args.client,
        from_status=from_status,
        to_status=args.status,
        agent=agent,
        phase=phase,
        session_id=session_id,
    )
    if ok_trans:
        print(f"OK: ES transition logged  {IDX_TRANSITIONS}")
    else:
        print("warn: ES transition failed (best-effort)")

    return errors


# ── Subcommand: sync ──────────────────────────────────────────────────────────

def cmd_sync(args: argparse.Namespace) -> int:
    """Bulk-sync all .md files → ES snapshot index (idempotent)."""
    root = resolve_client_root(args.client)

    layer_filter = getattr(args, "layer", None)
    module_filter = getattr(args, "module", None)

    if layer_filter and layer_filter not in LAYER_DIRS:
        print(f"error: invalid layer '{layer_filter}'. Valid: {list(LAYER_DIRS)}",
              file=sys.stderr)
        return 1

    files = (issue_files_for_layer(root, layer_filter)
             if layer_filter else issue_files(root))

    if module_filter:
        files = [f for f in files
                 if f.stem.upper().startswith(module_filter.upper() + "-")]

    if not files:
        print(f"info: no issue files found for client '{args.client}'")
        return 0

    ensure_es_indices()
    ok = failed = 0
    for f in files:
        issue = parse_issue_md(f)
        success = es_upsert_snapshot(issue, args.client)
        if success:
            ok += 1
        else:
            failed += 1
            print(f"  warn: failed to sync {issue['issue_id']}", file=sys.stderr)

    print(f"OK: sync complete — {ok} synced, {failed} failed")
    return 2 if failed else 0


# ── Subcommand: list ──────────────────────────────────────────────────────────

def cmd_list(args: argparse.Namespace) -> int:
    """Read and display current issue statuses from .md files."""
    root = resolve_client_root(args.client)

    layer_filter = getattr(args, "layer", None)
    status_filter = getattr(args, "status", None)
    module_filter = getattr(args, "module", None)

    files = (issue_files_for_layer(root, layer_filter)
             if layer_filter else issue_files(root))

    counts: dict[str, int] = {s: 0 for s in VALID_STATUSES}
    rows = []
    for f in files:
        issue = parse_issue_md(f)
        if module_filter and not issue["issue_id"].upper().startswith(module_filter.upper() + "-"):
            continue
        if status_filter and issue["status"] != status_filter:
            continue
        gh = f"#{issue['github_issue_number']}" if issue["github_issue_number"] else "-"
        rows.append((issue["issue_id"], issue["status"], issue["priority"] or "-",
                     gh, issue["title"][:60]))
        counts[issue["status"]] = counts.get(issue["status"], 0) + 1

    if not rows:
        print("info: no issues match the given filters")
        return 0

    col_w = [max(len(r[i]) for r in [*rows, ("ISSUE", "STATUS", "PRIO", "GH#", "TITLE")])
             for i in range(5)]
    header = "  ".join(h.ljust(col_w[i]) for i, h in
                        enumerate(("ISSUE", "STATUS", "PRIO", "GH#", "TITLE")))
    print(header)
    print("-" * len(header))
    for row in rows:
        print("  ".join(str(v).ljust(col_w[i]) for i, v in enumerate(row)))

    print()
    total = sum(counts.values())
    summary = "  ".join(f"{s}: {counts[s]}" for s in VALID_STATUSES if counts.get(s))
    print(f"Total: {total}  |  {summary}")
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Issue lifecycle: .md status + GitHub Projects v2 + ES (D-481)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # github-setup
    p_gs = sub.add_parser("github-setup",
                           help="Discover GitHub Project and cache Status field config")
    p_gs.add_argument("--client", required=True, help="Client ID (clients/<id>/)")
    p_gs.add_argument("--repo", default=None, help="OWNER/REPO (default: gh-resolved)")
    p_gs.add_argument("--project-number", type=int, default=None,
                       help="GitHub Project number (required when multiple projects exist)")

    # set-status
    p_ss = sub.add_parser("set-status", help="Transition one issue status")
    p_ss.add_argument("--client",     required=True, help="Client ID")
    p_ss.add_argument("--issue",      required=True, help="Issue ID (e.g. AUD-001)")
    p_ss.add_argument("--status",     required=True, choices=VALID_STATUSES,
                       help="Target status")
    p_ss.add_argument("--agent",      default="manual",
                       help="Agent/command that triggered the transition (e.g. be-implement)")
    p_ss.add_argument("--phase",      default="MANUAL",
                       help="Agent phase (e.g. IMPLEMENT-START, VALIDATION-PASS)")
    p_ss.add_argument("--session-id", default=None,
                       help="Trace ID to correlate with pipeline-events (auto-read from .techlab/)")
    p_ss.add_argument("--force",      action="store_true",
                       help="Update even if status is already the target value")

    # sync
    p_sy = sub.add_parser("sync", help="Bulk-sync all .md issue statuses to ES")
    p_sy.add_argument("--client",  required=True, help="Client ID")
    p_sy.add_argument("--module",  default=None,  help="Filter by module prefix (e.g. AUD)")
    p_sy.add_argument("--layer",   default=None,  choices=list(LAYER_DIRS),
                       help="Restrict to one layer (be or fe)")

    # list
    p_li = sub.add_parser("list", help="Show current issue statuses from .md files")
    p_li.add_argument("--client",  required=True, help="Client ID")
    p_li.add_argument("--status",  default=None, choices=VALID_STATUSES,
                       help="Filter by status")
    p_li.add_argument("--module",  default=None, help="Filter by module prefix")
    p_li.add_argument("--layer",   default=None, choices=list(LAYER_DIRS))

    args = parser.parse_args()
    dispatch = {
        "github-setup": cmd_github_setup,
        "set-status":   cmd_set_status,
        "sync":         cmd_sync,
        "list":         cmd_list,
    }
    sys.exit(dispatch[args.command](args))


if __name__ == "__main__":
    main()
