#!/usr/bin/env python3
"""plan-state-extractor.py -- plan continuity / delta for the planner (D-319).

READ-ONLY. Emits ``<ISSUE>.plan-state.json`` so be/fe-planner judges over data
instead of re-reading the issue + prior plan + code each round. Reuses the
shared ``issue_state`` foundation (checklist consolidation) -- no duplication.

What it computes (deterministic):
    - checklist state (DONE/PARTIAL/MISSING/BLOCKED) via issue_state.consolidate;
    - prior plan phases (parsed from plan-<ISSUE>.md) + a best-effort state;
    - delta: done / partial / notStarted item texts + inconsistencies
      (e.g. "checked but file MISSING");
    - dependencies extracted from the issue's Dependencies section.

What stays with the agent:
    - ``suggestedPlanType`` (CONTINUACAO|INCREMENTAL|REPLANEJAMENTO|REVIEW) is a
      HINT flagged ``needsAgentConfirm`` -- the planner decides.

R3: argparse subcommand, root walk-up, atomic write, OK:/error:, exit 0/1/2.
Exit 2 == issue has no parseable checklist.

Usage:
    python scripts/plan-state-extractor.py extract --issue LEAD-FE-007 --report
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from pathlib import Path

try:
    from cli_utils import force_utf8_stdio
    from issue_state import (
        LAYER_PROFILES,
        atomic_write,
        consolidate,
        find_root,
        parse_checklist,
        resolve_issue,
    )
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from cli_utils import force_utf8_stdio
    from issue_state import (
        LAYER_PROFILES,
        atomic_write,
        consolidate,
        find_root,
        parse_checklist,
        resolve_issue,
    )


_PLAN_TYPES = ("CONTINUACAO", "INCREMENTAL", "REPLANEJAMENTO", "REVIEW")
_FASE = re.compile(r"\bfase-(\d+)\b", re.IGNORECASE)
_DONE_MARK = re.compile(r"(✅|\bDONE\b|conclu[ií]d)", re.IGNORECASE)
_HEADING = re.compile(r"^#{1,6}\s+(.*\S)\s*$")
_ISSUE_ID = re.compile(r"\b([A-Z]{2,6}-(?:FE-|INT-|BE-)?\d{2,4})\b")
_DEP_HEADING = re.compile(r"depend[eê]nc", re.IGNORECASE)
_DEP_NOTE = re.compile(r"(endpoint|/api/|PENDING|stub|BE dependency|backend)", re.IGNORECASE)


# ── Plan parsing ─────────────────────────────────────────────────────────────

def resolve_plan_file(issue: str, layer: str, explicit: str | None, root: Path) -> Path | None:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    f = root / LAYER_PROFILES[layer]["plan_dir"] / f"plan-{issue}.md"
    return f if f.is_file() else None


def parse_plan_phases(text: str) -> list[dict]:
    """Extract `fase-N` phases + a best-effort state from a plan-<ISSUE>.md."""
    phases: dict[str, str] = {}
    for line in text.splitlines():
        for m in _FASE.finditer(line):
            pid = f"fase-{int(m.group(1))}"
            state = "DONE" if _DONE_MARK.search(line) else phases.get(pid, "UNKNOWN")
            phases[pid] = state
    return [{"id": pid, "state": phases[pid]}
            for pid in sorted(phases, key=lambda s: int(s.split("-")[1]))]


def extract_dependencies(text: str) -> dict:
    """Pull issue ids + notes from the issue's Dependencies/Dependencias section."""
    lines = text.splitlines()
    section: list[str] = []
    in_dep = False
    for line in lines:
        h = _HEADING.match(line)
        if h:
            in_dep = bool(_DEP_HEADING.search(h.group(1)))
            continue
        if in_dep and line.strip():
            section.append(line.strip())
    body = "\n".join(section)
    issues = sorted(set(_ISSUE_ID.findall(body)))
    notes = [ln for ln in section if _DEP_NOTE.search(ln)]
    return {"issues": issues, "notes": notes}


# ── Delta + suggestion ───────────────────────────────────────────────────────

def build_delta(checklist: dict) -> dict:
    done, partial, not_started, inconsist = [], [], [], []
    for it in checklist["items"]:
        st = it["state"]
        if st == "DONE":
            done.append(it["text"])
        elif st == "PARTIAL":
            partial.append(it["text"])
        elif st in ("MISSING", "BLOCKED"):
            not_started.append(it["text"])
        if "marcado mas arquivo ausente" in it["evidence"]:
            inconsist.append(f"checklist marcado mas arquivo ausente: {it['text']}")
    return {"done": done, "partial": partial, "notStarted": not_started,
            "inconsistencies": inconsist}


def suggest_plan_type(checklist: dict, delta: dict, prior_plan_exists: bool) -> str:
    total = checklist["total"]
    if delta["inconsistencies"]:
        return "REPLANEJAMENTO"
    if total and checklist["missing"] == 0 and checklist["partial"] == 0 and checklist["blocked"] == 0:
        return "REVIEW"
    if prior_plan_exists and checklist["done"] > 0:
        return "CONTINUACAO"
    return "INCREMENTAL"


# ── Subcommand ───────────────────────────────────────────────────────────────

def cmd_extract(args) -> int:
    root = find_root(args.root)
    layer, issue_file = resolve_issue(args.issue, args.layer, args.issue_file, root)
    if issue_file is None:
        print(f"error: issue nao encontrada: {args.issue} (layer={layer or 'auto'})", file=sys.stderr)
        return 1

    text = issue_file.read_text(encoding="utf-8", errors="replace")
    items = parse_checklist(text)
    if not items:
        print(f"error: issue sem checklist parseavel: {issue_file}", file=sys.stderr)
        return 2

    checklist = consolidate(items, root)
    public_checklist = {k: v for k, v in checklist.items() if not k.startswith("_") and k != "items"}

    plan_file = resolve_plan_file(args.issue, layer, args.plan_file, root)
    phases = parse_plan_phases(plan_file.read_text(encoding="utf-8", errors="replace")) if plan_file else []
    prior = {"exists": plan_file is not None,
             "file": str(plan_file.relative_to(root)) if plan_file else None,
             "phases": phases}

    delta = build_delta(checklist)
    deps = extract_dependencies(text)
    suggested = suggest_plan_type(checklist, delta, prior["exists"])

    out = {
        "issue": args.issue,
        "layer": layer,
        "computedAt": _dt.datetime.now().isoformat(timespec="seconds"),
        "checklist": public_checklist,
        "priorPlan": prior,
        "delta": delta,
        "dependencies": deps,
        "suggestedPlanType": suggested,
        "needsAgentConfirm": True,
    }

    out_path = Path(args.output) if args.output else issue_file.with_name(f"{issue_file.stem}.plan-state.json")
    atomic_write(out_path, json.dumps(out, indent=2, ensure_ascii=False) + "\n")

    if args.report:
        print(f"\nIssue: {args.issue} (layer={layer})")
        print(f"Checklist: {public_checklist['done']} done / {public_checklist['partial']} partial / "
              f"{public_checklist['missing']} missing / {public_checklist['blocked']} blocked")
        print(f"Prior plan: {'sim' if prior['exists'] else 'nao'} ({len(phases)} fase(s))")
        print(f"Inconsistencias: {len(delta['inconsistencies'])}")
        print(f"Sugestao (needsAgentConfirm): {suggested}\n")

    print(f"OK: plan-state -- {out_path.name} [suggest={suggested}]")
    return 0


def main() -> None:
    force_utf8_stdio()
    parser = argparse.ArgumentParser(
        prog="plan-state-extractor",
        description="Plan continuity / delta for the planner (D-319). Read-only.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    ex = sub.add_parser("extract", help="emit <ISSUE>.plan-state.json")
    ex.add_argument("--issue", required=True, metavar="ISSUE_ID")
    ex.add_argument("--layer", choices=sorted(LAYER_PROFILES), help="default: autodetect")
    ex.add_argument("--issue-file", metavar="PATH")
    ex.add_argument("--plan-file", metavar="PATH")
    ex.add_argument("--root", metavar="PATH")
    ex.add_argument("--output", metavar="PATH")
    ex.add_argument("--report", action="store_true")
    ex.set_defaults(func=cmd_extract)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
