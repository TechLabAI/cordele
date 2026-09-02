#!/usr/bin/env python3
"""validator-score.py -- deterministic maturity score + checklist state (D-317).

Computes the OBJECTIVE part of the maturity rubric (30/30/20/10/10) and
consolidates the issue checklist (DONE/PARTIAL/MISSING/BLOCKED), emitting a
compact ``<ISSUE>.state.json`` that the be/fe-validator agent reads instead of
re-deriving everything. Pairs with ``<ISSUE>.contract.json`` (D-315).

Issue resolution + checklist consolidation live in the shared ``issue_state``
module (D-319); file presence / stub detection in ``code_inventory``.

The line that does not cross (D-315/D-317):
    - script computes the OBJECTIVE portions (structure / tests+lint / e2e) +
      a PROVISIONAL functionality score (presence+stub heuristic) flagged
      ``needsAgentConfirm``;
    - the agent confirms functionality and judges the 10 soft points.

Confirmed design (2026-06-05):
    1. read-only on the issue by default; ``--write-back`` is opt-in (atomic);
    2. RECEIVES gate verdicts -- does NOT run the toolchain;
    3. functionality 30 is provisional with ``needsAgentConfirm``.

R3: argparse subcommands, root walk-up, atomic write, OK:/error:, exit 0/1/2.
A low/empty score is DATA, not an error. Exit 2 == no parseable checklist.

Usage:
    python scripts/validator-score.py score --issue LEAD-FE-001 \\
        --lint pass --test pass --build pass --e2e skip
    python scripts/validator-score.py score --issue CAD-001 --layer be --gates gates.json
    python scripts/validator-score.py checklist --issue LEAD-FE-001
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
        UNVERIFIABLE_EVIDENCE,
        atomic_write,
        consolidate,
        find_root,
        issue_bases,
        parse_checklist,
        resolve_issue,
        toggle_checkbox,
    )
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from cli_utils import force_utf8_stdio
    from issue_state import (
        LAYER_PROFILES,
        UNVERIFIABLE_EVIDENCE,
        atomic_write,
        consolidate,
        find_root,
        issue_bases,
        parse_checklist,
        resolve_issue,
        toggle_checkbox,
    )


# ── Rubric (published in the validator command -- changing weights is a decision) ──

WEIGHTS = {"structure": 30, "functionality": 30, "tests_lint": 20, "e2e": 10, "soft": 10}
_BUILD_FACTOR = {"pass": 1.0, "warn": 0.7, "skip": 0.5, "fail": 0.0, "unknown": 0.0}
_BANDS = [(80, "Maduro"), (60, "Consistente"), (40, "Parcial"), (0, "Inicial")]

# Map a layer's raw gate names onto the canonical rubric slots (uniform scoring).
_GATE_ALIAS = {
    "build": "build", "compileJava": "build",
    "lint": "lint", "architectureCheck": "lint",
    "test": "test",
    "e2e": "e2e", "integrationTest": "e2e",
}
# Single source of truth: a verdict is valid iff compute_score can weigh it.
_VERDICTS = frozenset(_BUILD_FACTOR)

# Keys accepted, in precedence order, when a gate value is a rich object
# (``{"status": "pass", "suites": 26}``) instead of a bare verdict string.
_RICH_VERDICT_KEYS = ("status", "verdict", "result")


# ── Scoring ────────────────────────────────────────────────────────────────────

def normalize_gates(raw: dict, layer: str) -> dict:
    """Map raw gate names onto the canonical slots, loudly rejecting junk.

    An unrecognised verdict scores 0.0 in ``_BUILD_FACTOR``; degrading in
    silence has cost this project real rework, so it is reported on stderr
    and stored as an explicit ``unknown``.
    """
    canon = {"build": "unknown", "lint": "unknown", "test": "unknown", "e2e": "unknown"}
    for key, verdict in raw.items():
        slot = _GATE_ALIAS.get(key, key)
        if slot not in canon or not verdict:
            continue
        if verdict not in _VERDICTS:
            shown = str(verdict)[:60]
            print(f"warn: gate '{slot}' com veredito irreconhecivel: {shown!r} "
                  f"-- esperado {'|'.join(sorted(_VERDICTS))}; tratado como unknown",
                  file=sys.stderr)
            verdict = "unknown"
        canon[slot] = verdict
    return canon


def band_for(score: int) -> str:
    for floor, name in _BANDS:
        if score >= floor:
            return name
    return "Inicial"


def status_tag(checklist: dict, structure: int) -> str:
    total = checklist["total"]
    ratio = (checklist["done"] / total) if total else 0.0
    if ratio > 0.7:
        return "NEAR-CLOSED"
    if checklist["done"] > 0 or structure > 0:
        return "REDUCED"
    return "INTACT"


def compute_score(checklist: dict, gates: dict) -> dict:
    total = checklist["total"]
    done = checklist["done"]

    bf = _BUILD_FACTOR.get(gates.get("build", "unknown"), 0.0)
    cited = checklist["_filesCited"]
    pf = (checklist["_filesExisting"] / cited) if cited else bf
    structure = round(WEIGHTS["structure"] * (0.5 * bf + 0.5 * pf))

    functionality = round(WEIGHTS["functionality"] * (done / total)) if total else 0

    test = gates.get("test", "unknown")
    lint = gates.get("lint", "unknown")
    if test == "pass" and lint in ("pass", "warn", "skip"):
        tests_lint = WEIGHTS["tests_lint"]
    elif test == "pass" and lint == "fail":
        tests_lint = 12
    else:
        tests_lint = 0

    e2e = WEIGHTS["e2e"] if gates.get("e2e") == "pass" else 0

    total_prov = structure + functionality + tests_lint + e2e
    return {
        "total": total_prov,
        "provisional": True,
        "range": [total_prov, total_prov + WEIGHTS["soft"]],
        "breakdown": {
            "structure": {"max": WEIGHTS["structure"], "value": structure, "basis": "deterministic"},
            "functionality": {"max": WEIGHTS["functionality"], "value": functionality,
                              "basis": "heuristic", "needsAgentConfirm": True},
            "tests_lint": {"max": WEIGHTS["tests_lint"], "value": tests_lint, "basis": "deterministic"},
            "e2e": {"max": WEIGHTS["e2e"], "value": e2e, "basis": "deterministic"},
            "soft": {"max": WEIGHTS["soft"], "value": None, "basis": "agent", "needsAgentConfirm": True},
        },
        "band": band_for(total_prov),
        "statusTag": status_tag(checklist, structure),
    }


# ── Gate inputs (received -- never runs the toolchain) ─────────────────────────

_LOG_FAIL = re.compile(r"\b(fail(ed|ure)?|error|exception|BUILD FAILED)\b", re.IGNORECASE)
_LOG_PASS = re.compile(r"\b(pass(ed)?|BUILD SUCCESSFUL|success|0 errors?)\b", re.IGNORECASE)


def verdict_from_log(path: str) -> str:
    try:
        tail = Path(path).read_text(encoding="utf-8", errors="replace")[-4000:]
    except (OSError, UnicodeError):
        return "unknown"
    if _LOG_FAIL.search(tail):
        return "fail"
    if _LOG_PASS.search(tail):
        return "pass"
    return "unknown"


def gate_verdict(value) -> str:
    """Verdict of one gate entry: bare scalar, or rich object keyed by status."""
    if isinstance(value, dict):
        for key in _RICH_VERDICT_KEYS:
            if key in value:
                return str(value[key]).lower()
    return str(value).lower()


def collect_gates(args) -> dict:
    raw: dict[str, str] = {}
    if args.gates:
        try:
            data = json.loads(Path(args.gates).read_text(encoding="utf-8"))
            raw.update({k: gate_verdict(v) for k, v in data.items()})
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            print(f"error: --gates ilegivel: {exc}", file=sys.stderr)
            raise SystemExit(1) from exc
    for slot in ("lint", "test", "build", "e2e"):
        if (flag := getattr(args, slot, None)):
            raw[slot] = flag
        log = getattr(args, f"{slot}_log", None)
        if log and slot not in raw:
            raw[slot] = verdict_from_log(log)
    return raw


# ── Write-back (opt-in, atomic) ──────────────────────────────────────────────

_STATUS_BLOCK = re.compile(
    r"^\*\*Status:\*\*.*\n\*\*Maturidade:\*\*.*\n\*\*Done/Total:\*\*.*\n",
    re.MULTILINE,
)


def render_status_block(score: dict, checklist: dict, today: str) -> str:
    return (
        f"**Status:** {score['statusTag']} -- pos-validacao {today}\n"
        f"**Maturidade:** {score['total']} -- {score['band']}\n"
        f"**Done/Total:** {checklist['done']}/{checklist['total']} itens\n"
    )


def write_back(issue_file: Path, block: str) -> None:
    text = issue_file.read_text(encoding="utf-8")
    if _STATUS_BLOCK.search(text):
        new = _STATUS_BLOCK.sub(block, text, count=1)
    else:
        lines = text.splitlines(keepends=True)
        idx = next((i for i, ln in enumerate(lines) if ln.startswith("#")), -1)
        lines.insert(idx + 1 if idx >= 0 else 0, "\n" + block)
        new = "".join(lines)
    atomic_write(issue_file, new)


# ── Unverified-item warning (never degrade in silence) ───────────────────────

def count_unverified(checklist: dict) -> int:
    """Items MISSING only because the heuristic had nothing to inspect.

    An unchecked item citing no file path (a behavioral assertion such as
    "retorna 502 com urn:...") never reaches any code -- it is scored MISSING
    regardless of the implementation. MISSING for an absent/stub file is a real
    gap and is deliberately NOT counted here.
    """
    return sum(1 for it in checklist["items"]
               if it["state"] == "MISSING" and it["evidence"] == UNVERIFIABLE_EVIDENCE)


def warn_unverified(issue: str, layer: str, checklist: dict) -> int:
    """Report the unverifiable items on stderr. Returns how many there were."""
    n = count_unverified(checklist)
    if n:
        print(f"warn: {issue}: {n} de {checklist['total']} itens do checklist NAO foram "
              f"verificados contra o codigo -- sao assercoes comportamentais sem arquivo "
              f"citado, que o heuristico nao consegue conferir e conta como MISSING.",
              file=sys.stderr)
        print(f"warn: confirme cada um com: python scripts/validator-score.py mark "
              f"--issue {issue} --layer {layer} --item \"<substring do item>\"",
              file=sys.stderr)
    return n


# ── Subcommands ──────────────────────────────────────────────────────────────

def _load_issue(args) -> tuple[str, Path, Path, str]:
    root = find_root(args.root)
    layer, issue_file = resolve_issue(args.issue, args.layer, args.issue_file, root)
    if issue_file is None:
        print(f"error: issue nao encontrada: {args.issue} (layer={layer or 'auto'})", file=sys.stderr)
        raise SystemExit(1)
    text = issue_file.read_text(encoding="utf-8", errors="replace")
    return layer, root, issue_file, text


def _emit(args, payload: dict, issue_file: Path, *, default_suffix: str) -> Path:
    out_path = Path(args.output) if args.output else issue_file.with_name(
        f"{issue_file.stem}.{default_suffix}.json")
    atomic_write(out_path, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    return out_path


def cmd_checklist(args) -> int:
    layer, root, issue_file, text = _load_issue(args)
    items = parse_checklist(text)
    if not items:
        print(f"error: issue sem checklist parseavel: {issue_file}", file=sys.stderr)
        return 2
    checklist = consolidate(items, root, issue_bases(args.issue, layer, root))
    warn_unverified(args.issue, layer, checklist)
    public = {k: v for k, v in checklist.items() if not k.startswith("_")}
    _emit(args, {"issue": args.issue, "layer": layer, "checklist": public},
          issue_file, default_suffix="checklist")
    print(f"OK: checklist {public['done']}/{public['total']} -- {issue_file.stem}.checklist.json")
    return 0


def cmd_mark(args) -> int:
    """Persist an agent's content-verified confirmation of one checklist item.

    ``validator-score.py score`` re-derives the checklist from the issue's
    markdown checkboxes on every run (D-317/D-319) -- it never reads a prior
    ``.state.json`` back. An item with no file path cited (a pure behavioral
    assertion, e.g. "makes exactly 1 call to X's port") is classified DONE
    only if its markdown checkbox is literally ``[x]``. This subcommand is
    the supported way to flip it once an agent has read the actual test/spec
    content and confirmed the assertion is really implemented -- skipping it
    means the confirmation is silently discarded on the next ``score`` run.
    """
    layer, root, issue_file, text = _load_issue(args)
    try:
        new_text, matched = toggle_checkbox(text, args.item, checked=not args.undone)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    atomic_write(issue_file, new_text)
    state = "desmarcado" if args.undone else "marcado [x]"
    print(f"OK: item {state} em {issue_file.name}: {matched}")
    return 0


def cmd_score(args) -> int:
    layer, root, issue_file, text = _load_issue(args)
    items = parse_checklist(text)
    if not items:
        print(f"error: issue sem checklist parseavel: {issue_file}", file=sys.stderr)
        return 2

    checklist = consolidate(items, root, issue_bases(args.issue, layer, root))
    unverified = warn_unverified(args.issue, layer, checklist)
    gates = normalize_gates(collect_gates(args), layer)
    score = compute_score(checklist, gates)

    today = _dt.date.today().isoformat()
    now = _dt.datetime.now().isoformat(timespec="seconds")
    public_checklist = {k: v for k, v in checklist.items() if not k.startswith("_")}

    fv = score["breakdown"]["functionality"]["value"]
    agent_todo = [
        f"Confirmar functionality {fv}/{WEIGHTS['functionality']} -- a funcionalidade alvo funciona?",
        f"Avaliar soft 0-{WEIGHTS['soft']} -- a11y + observability + multi-tenancy enforcement",
    ]

    out = {
        "issue": args.issue,
        "layer": layer,
        "computedAt": now,
        "checklist": public_checklist,
        "gates": gates,
        "score": score,
        "agentTodo": agent_todo,
    }
    out_path = _emit(args, out, issue_file, default_suffix="state")

    if args.write_back:
        write_back(issue_file, render_status_block(score, checklist, today))
        print(f"OK: status block atualizado em {issue_file.name} (--write-back)")
    if args.report:
        _print_report(out)

    print(f"OK: score {score['total']} ({score['band']}) -- {out_path.name} "
          f"[Done/Total {checklist['done']}/{checklist['total']}]")

    limit = getattr(args, "strict_unverified", None)
    if limit is not None and unverified > limit:
        print(f"error: --strict-unverified {limit}: {unverified} itens nao verificados "
              f"em {args.issue}", file=sys.stderr)
        return 2
    return 0


def _print_report(out: dict) -> None:
    s, c = out["score"], out["checklist"]
    print(f"\nIssue: {out['issue']}  (layer={out['layer']})")
    print(f"Gates: {out['gates']}")
    print(f"Checklist: {c['done']} done / {c['partial']} partial / "
          f"{c['missing']} missing / {c['blocked']} blocked  (total {c['total']})")
    print(f"\nScore provisorio: {s['total']}  range {s['range']}  -> {s['band']} / {s['statusTag']}")
    for name, b in s["breakdown"].items():
        flag = " (agente)" if b.get("needsAgentConfirm") else ""
        print(f"  {name:<14} {b['value']!s:>4} / {b['max']:<3} [{b['basis']}]{flag}")
    print()


# ── Main ─────────────────────────────────────────────────────────────────────

def _add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument("--issue", required=True, metavar="ISSUE_ID")
    p.add_argument("--layer", choices=sorted(LAYER_PROFILES), help="default: autodetect")
    p.add_argument("--issue-file", metavar="PATH", help="override issue file resolution")
    p.add_argument("--root", metavar="PATH", help="project root (default: walk up from cwd)")
    p.add_argument("--output", metavar="PATH", help="output JSON path (default: <issue>.<kind>.json)")
    p.add_argument("--report", action="store_true", help="print breakdown to stdout")


def main() -> None:
    force_utf8_stdio()
    parser = argparse.ArgumentParser(
        prog="validator-score",
        description="Deterministic maturity score + checklist state (D-317).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sc = sub.add_parser("score", help="compute score + emit <ISSUE>.state.json")
    _add_common(sc)
    for slot in ("lint", "test", "build", "e2e"):
        sc.add_argument(f"--{slot}", choices=sorted(_VERDICTS), help=f"{slot} gate verdict")
        sc.add_argument(f"--{slot}-log", metavar="PATH", help=f"parse {slot} verdict from log tail")
    sc.add_argument("--gates", metavar="PATH", help="JSON file of gate verdicts")
    sc.add_argument("--write-back", action="store_true",
                    help="(opt-in) update the status block in the issue, atomically")
    sc.add_argument("--strict-unverified", nargs="?", type=int, const=0, default=None,
                    metavar="N",
                    help="(CI) exit 2 when more than N checklist items could not be "
                         "verified against code (default N=0 when the flag is given)")
    sc.set_defaults(func=cmd_score)

    cl = sub.add_parser("checklist", help="consolidate checklist only -> JSON")
    _add_common(cl)
    cl.set_defaults(func=cmd_checklist)

    mk = sub.add_parser("mark", help="persist a content-verified checklist confirmation (flips the issue's markdown checkbox)")
    _add_common(mk)
    mk.add_argument("--item", required=True, metavar="TEXT",
                     help="substring (case-insensitive) uniquely identifying the checklist item")
    mk.add_argument("--undone", action="store_true",
                     help="uncheck instead of check (default: check)")
    mk.set_defaults(func=cmd_mark)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
