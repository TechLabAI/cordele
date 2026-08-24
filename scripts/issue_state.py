#!/usr/bin/env python3
"""issue_state.py -- shared issue-resolution + checklist-consolidation (D-319).

Second shared foundation of the script-parity program (D-316), sibling to
``code_inventory.py``. Centralizes everything about *reading an issue's state*
so it is implemented ONCE and reused by:

    - validator-score.py      (D-317) -- score + checklist subcommand
    - plan-state-extractor.py (D-319) -- plan continuity / delta

Concerns here:
    - project-root walk-up + layer detection (fe/be) + issue-file resolution;
    - markdown checkbox parsing;
    - checklist consolidation -> DONE/PARTIAL/MISSING/BLOCKED with evidence,
      delegating file presence / stub detection to ``code_inventory``.

Pure library (no CLI). R3 applies to the scripts that import it.
"""
from __future__ import annotations

import re
from pathlib import Path

try:
    from code_inventory import extract_paths, scan_presence
except ImportError:  # pragma: no cover
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from code_inventory import extract_paths, scan_presence

# ── Layer profiles (shared be/fe) ──────────────────────────────────────────────

LAYER_PROFILES = {
    "fe": {
        "issue_dir": "docs/architecture/frontend/issues",
        "plan_dir": "docs/architecture/frontend/plans",
    },
    "be": {
        "issue_dir": "docs/architecture/backend/issues",
        "plan_dir": "docs/architecture/backend/plans",
    },
}


# ── Root / issue resolution ────────────────────────────────────────────────────

def find_root(override: str | None) -> Path:
    """Walk up from cwd looking for a project marker (R3)."""
    if override:
        return Path(override).resolve()
    cur = Path.cwd().resolve()
    for p in (cur, *cur.parents):
        if (p / "project-context.json").exists() or (p / "docs" / "architecture").is_dir():
            return p
    return cur


def marker_layer(issue: str) -> str | None:
    """Layer hinted by the issue id, or None. FE issues carry -FE-/-INT-; BE
    issues are <MOD>-NNN (no marker), so absence is unknown, not 'fe'."""
    up = issue.upper()
    if "-FE-" in up or "-INT-" in up:
        return "fe"
    if "-BE-" in up:
        return "be"
    return None


def layer_from_path(path: Path) -> str | None:
    norm = str(path).replace("\\", "/")
    if "/backend/" in norm:
        return "be"
    if "/frontend/" in norm:
        return "fe"
    return None


def resolve_issue_file(issue: str, layer: str | None, explicit: str | None, root: Path) -> Path | None:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    order = ([layer] if layer else []) + [ly for ly in LAYER_PROFILES if ly != layer]
    for ly in order:
        f = root / LAYER_PROFILES[ly]["issue_dir"] / f"{issue}.md"
        if f.is_file():
            return f
    return None


def resolve_issue(issue: str, explicit_layer: str | None, issue_file: str | None,
                  root: Path) -> tuple[str, Path | None]:
    """Return (layer, issue_file_path). Layer is refined from the resolved path
    when not given explicitly (BE issues lack a -BE- marker)."""
    layer = explicit_layer or marker_layer(issue)
    path = resolve_issue_file(issue, layer, issue_file, root)
    if path is None:
        return (layer or "fe"), None
    if not explicit_layer:
        layer = layer_from_path(path) or layer or "fe"
    return layer, path


# ── Checklist parsing + consolidation ──────────────────────────────────────────

_CHECKBOX = re.compile(r"^\s*[-*]\s*\[([ xX])\]\s+(.*\S)\s*$")
_BLOCKED_MARK = re.compile(r"\bBLOCKED\b", re.IGNORECASE)


def parse_checklist(text: str) -> list[dict]:
    """Extract markdown checkbox items from an issue (any section)."""
    items: list[dict] = []
    for line in text.splitlines():
        m = _CHECKBOX.match(line)
        if not m:
            continue
        items.append({
            "text": m.group(2),
            "checked": m.group(1).lower() == "x",
            "paths": extract_paths(m.group(2)),
            "blocked": bool(_BLOCKED_MARK.search(m.group(2))),
        })
    return items


def _classify_item(it: dict, root: Path) -> tuple[str, str]:
    if it["blocked"]:
        return "BLOCKED", "item marcado BLOCKED"
    paths = it["paths"]
    if paths:
        presence = scan_presence(paths, root)
        existing = [p for p, v in presence.items() if v["exists"]]
        stubs = [p for p, v in presence.items() if v["exists"] and v["isStub"]]
        if not existing:
            note = "marcado mas arquivo ausente" if it["checked"] else "arquivo citado ausente"
            return "MISSING", f"{note}: {', '.join(paths)}"
        if stubs:
            return "PARTIAL", f"arquivo presente porem stub: {', '.join(stubs)}"
        if len(existing) < len(paths):
            missing = [p for p in paths if p not in existing]
            return "PARTIAL", f"parcial -- faltam: {', '.join(missing)}"
        return "DONE", f"arquivo(s) presente(s) e nao-stub: {', '.join(existing)}"
    if it["checked"]:
        return "DONE", "marcado (sem arquivo verificavel)"
    return "MISSING", "desmarcado (sem arquivo verificavel)"


def consolidate(items: list[dict], root: Path) -> dict:
    """Reduce checklist items to DONE/PARTIAL/MISSING/BLOCKED with evidence."""
    out_items: list[dict] = []
    counts = {"done": 0, "partial": 0, "missing": 0, "blocked": 0}
    files_cited = 0
    files_existing = 0
    for it in items:
        state, evidence = _classify_item(it, root)
        if it["paths"]:
            presence = scan_presence(it["paths"], root)
            files_cited += len(it["paths"])
            files_existing += sum(1 for v in presence.values() if v["exists"])
        counts[state.lower()] += 1
        out_items.append({"text": it["text"], "state": state, "evidence": evidence})
    return {
        "total": len(items),
        "done": counts["done"],
        "partial": counts["partial"],
        "missing": counts["missing"],
        "blocked": counts["blocked"],
        "items": out_items,
        "_filesCited": files_cited,
        "_filesExisting": files_existing,
    }


# ── Atomic IO (shared) ─────────────────────────────────────────────────────────

def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)
