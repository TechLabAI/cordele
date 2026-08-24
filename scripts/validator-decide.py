#!/usr/bin/env python3
"""validator-decide.py - deterministic next-action engine for the exec loop (D-367, Fase 1).

The PLANNER / IMPLEMENTADOR / VALIDACAO / ENCERRAR decision is a state machine
the validator re-derives from prose every round, and the autopilot DUPLICATES in
its B2 step. Its inputs are already machine-readable JSON: `<ISSUE>.state.json`
(validator-score, D-317: checklist + score) and `<ISSUE>.plan-state.json`
(plan-state-extractor, D-319: prior plan + delta). This script reads them and
emits the decision so the agent CONFIRMS instead of recomputing (R5/D-315:
`needsAgentConfirm: true`).

Decision rule (deterministic):
    checklist 100% DONE  AND  score >= 80          -> ENCERRAR
    no current plan                                -> PLANNER
    plan exists, work remaining (undone/notStarted)-> IMPLEMENTADOR
    plan exists, all implemented but score < 80    -> VALIDACAO

B6 targeted-fix routing (D-554):
    b6-fix --failure-report <path>  -> TARGETED_FIX | FULL_CYCLE
    Criteria for TARGETED_FIX (all must be met):
      - failure_type == "single_test"
      - len(failing_tests) <= 3
      - failure_type != "compilation"

Usage:
    validator-decide.py decide --issue LEAD-FE-001
    validator-decide.py decide --issue CAD-001 --layer be --report
    validator-decide.py decide --issue X --state s.json --plan-state p.json
    validator-decide.py b6-fix --failure-report tmp/be-autopilot/PAY/b6-failure.json
    validator-decide.py write-b6-failure --module PAY --tmp-dir tmp/be-autopilot \
        --failure-type single_test --failing-tests com.example.PayTest#testPay \
        --error-summary "AssertionError at line 42"

Exit codes (R3): 0 success | 1 user error (state.json missing). A decision is
never an error; the score/checklist drive the action, not the exit code.
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
from pathlib import Path

from cli_utils import force_utf8_stdio
from issue_state import find_root, resolve_issue

ENCERRAR, PLANNER, IMPLEMENTADOR, VALIDACAO = "ENCERRAR", "PLANNER", "IMPLEMENTADOR", "VALIDACAO"
SCORE_DONE_THRESHOLD = 80

# B6 targeted-fix verdicts (D-554)
TARGETED_FIX = "TARGETED_FIX"
FULL_CYCLE = "FULL_CYCLE"


def decide(state: dict, plan_state: dict | None) -> dict:
    """Pure decision over state.json (+ optional plan-state.json)."""
    checklist = state.get("checklist", {})
    total = int(checklist.get("total", 0) or 0)
    done = int(checklist.get("done", 0) or 0)
    score = int((state.get("score") or {}).get("total", 0) or 0)

    plan = (plan_state or {}).get("priorPlan", {}) if plan_state else {}
    plan_exists = bool(plan.get("exists", False))
    delta = (plan_state or {}).get("delta", {}) if plan_state else {}
    not_started = list(delta.get("notStarted", []) or [])

    if total > 0 and done == total and score >= SCORE_DONE_THRESHOLD:
        action, reason = ENCERRAR, (
            f"checklist {done}/{total} DONE e score {score} >= {SCORE_DONE_THRESHOLD}"
        )
    elif not plan_exists:
        action, reason = PLANNER, "sem plano vigente para esta issue"
    elif done < total or not_started:
        remaining = (total - done) if total else len(not_started)
        action, reason = IMPLEMENTADOR, (
            f"plano vigente com trabalho nao concluido ({remaining} item(ns) pendente(s))"
        )
    else:
        action, reason = VALIDACAO, (
            f"tudo implementado mas score {score} < {SCORE_DONE_THRESHOLD}; validar para fechar"
        )

    return {
        "nextAction": action,
        "reason": reason,
        "needsAgentConfirm": True,
        "inputs": {
            "done": done, "total": total, "score": score,
            "planExists": plan_exists, "notStarted": len(not_started),
        },
    }


def _sidecar(issue_file: Path, suffix: str) -> Path:
    return issue_file.with_name(f"{issue_file.stem}.{suffix}.json")


def _load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


# ---------------------------------------------------------------------------
# B6 targeted-fix lane (D-554)
# ---------------------------------------------------------------------------

def decide_b6_fix(failure_data: dict) -> str:
    """Evaluate b6-failure.json and return TARGETED_FIX or FULL_CYCLE.

    Criteria for TARGETED_FIX (all must be met):
      1. failure_type == "single_test"
      2. len(failing_tests) <= 3
      3. failure_type != "compilation"  (compilation requires re-plan)
    Safe default: FULL_CYCLE.
    """
    failure_type = failure_data.get("failure_type", "unknown")
    failing_tests = failure_data.get("failing_tests", [])

    if (
        failure_type == "single_test"
        and len(failing_tests) <= 3
        and failure_type != "compilation"
    ):
        return TARGETED_FIX
    return FULL_CYCLE


def write_b6_failure(
    module: str,
    tmp_dir: str,
    failure_type: str,
    failing_tests: list[str],
    failing_files: list[str],
    error_summary: str,
) -> Path:
    """Write b6-failure.json atomically to {tmp_dir}/{module}/b6-failure.json.

    cycle_id is read from {tmp_dir}/{module}/handoff.json if available,
    defaulting to "unknown".
    """
    out_dir = Path(tmp_dir) / module
    out_dir.mkdir(parents=True, exist_ok=True)

    # Read cycle_id from handoff.json if available
    handoff_path = out_dir / "handoff.json"
    cycle_id = "unknown"
    if handoff_path.exists():
        handoff = _load_json(handoff_path) or {}
        cycle_id = handoff.get("cycle_id", "unknown")

    payload = {
        "cycle_id": cycle_id,
        "module": module,
        "failure_type": failure_type,
        "failing_tests": failing_tests,
        "failing_files": failing_files,
        "error_summary": error_summary[:500],
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }

    out_path = out_dir / "b6-failure.json"
    tmp_path = out_path.with_suffix(".tmp")
    tmp_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    tmp_path.replace(out_path)
    return out_path


def cmd_b6_fix(args: argparse.Namespace) -> int:
    """Subcommand: evaluate b6-failure.json and print TARGETED_FIX or FULL_CYCLE."""
    if not args.failure_report:
        print(FULL_CYCLE)
        print(f"OK: {FULL_CYCLE} -- no --failure-report given, safe default", file=sys.stderr)
        return 0

    failure_path = Path(args.failure_report)
    if not failure_path.exists():
        print(FULL_CYCLE)
        print(
            f"OK: {FULL_CYCLE} -- failure-report not found at {failure_path}, safe default",
            file=sys.stderr,
        )
        return 0

    failure_data = _load_json(failure_path)
    if failure_data is None:
        print(FULL_CYCLE)
        print(
            f"OK: {FULL_CYCLE} -- failure-report unreadable at {failure_path}, safe default",
            file=sys.stderr,
        )
        return 0

    verdict = decide_b6_fix(failure_data)
    print(verdict)
    print(
        f"OK: {verdict} -- failure_type={failure_data.get('failure_type')!r} "
        f"failing_tests={len(failure_data.get('failing_tests', []))}",
        file=sys.stderr,
    )
    return 0


def cmd_write_b6_failure(args: argparse.Namespace) -> int:
    """Subcommand: write b6-failure.json atomically."""
    out_path = write_b6_failure(
        module=args.module,
        tmp_dir=args.tmp_dir,
        failure_type=args.failure_type,
        failing_tests=args.failing_tests or [],
        failing_files=args.failing_files or [],
        error_summary=args.error_summary or "",
    )
    print(f"OK: b6-failure.json written to {out_path}")
    return 0


def cmd_decide(args: argparse.Namespace) -> int:
    root = find_root(args.root)
    layer, issue_file = resolve_issue(args.issue, args.layer, args.issue_file, root)

    # Resolve sidecars: explicit flags win, else next to the issue file.
    if args.state:
        state_path = Path(args.state)
    elif issue_file is not None:
        state_path = _sidecar(issue_file, "state")
    else:
        print(f"error: issue {args.issue!r} not found and --state not given", file=sys.stderr)
        return 1

    state = _load_json(state_path)
    if state is None:
        print(f"error: state.json not found/readable: {state_path} "
              f"(run validator-score.py score first)", file=sys.stderr)
        return 1

    if args.plan_state:
        plan_path = Path(args.plan_state)
    elif issue_file is not None:
        plan_path = _sidecar(issue_file, "plan-state")
    else:
        plan_path = None
    plan_state = _load_json(plan_path) if plan_path else None

    result = decide(state, plan_state)
    result = {"issue": args.issue, "layer": layer, **result}

    out = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(out + "\n", encoding="utf-8")
    if args.report or not args.output:
        print(out)
    print(f"OK: {result['nextAction']} -- {result['reason']}", file=sys.stderr)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="validator-decide.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    # --- existing: decide ---
    pd = sub.add_parser("decide", help="emit next action from state.json (+ plan-state.json)")
    pd.add_argument("--issue", required=True, metavar="ISSUE_ID")
    pd.add_argument("--layer", choices=["fe", "be"], help="default: autodetect")
    pd.add_argument("--issue-file", metavar="PATH", help="override issue file resolution")
    pd.add_argument("--state", metavar="PATH", help="override <ISSUE>.state.json path")
    pd.add_argument("--plan-state", metavar="PATH", help="override <ISSUE>.plan-state.json path")
    pd.add_argument("--root", metavar="PATH", help="project root (default: walk up from cwd)")
    pd.add_argument("--output", metavar="PATH", help="write decision JSON (default: stdout)")
    pd.add_argument("--report", action="store_true", help="also print decision JSON to stdout")
    pd.set_defaults(func=cmd_decide)

    # --- D-554: b6-fix ---
    pb6 = sub.add_parser(
        "b6-fix",
        help="evaluate b6-failure.json and print TARGETED_FIX or FULL_CYCLE (D-554)",
    )
    pb6.add_argument(
        "--failure-report",
        metavar="PATH",
        help="path to b6-failure.json written by the B6 step",
    )
    pb6.set_defaults(func=cmd_b6_fix)

    # --- D-554: write-b6-failure ---
    pwb6 = sub.add_parser(
        "write-b6-failure",
        help="write b6-failure.json atomically (called by the B6 step on failure, D-554)",
    )
    pwb6.add_argument("--module", required=True, metavar="MODULE",
                      help="module id (e.g. PAY)")
    pwb6.add_argument("--tmp-dir", required=True, metavar="PATH",
                      help="base tmp directory; file is written to <tmp-dir>/<module>/b6-failure.json")
    pwb6.add_argument(
        "--failure-type",
        required=True,
        choices=["single_test", "multiple_tests", "compilation", "unknown"],
        help="classification of the B6 failure",
    )
    pwb6.add_argument(
        "--failing-tests",
        action="append",
        default=[],
        metavar="TEST",
        help="failing test (FQCN#method); repeat for each test",
    )
    pwb6.add_argument(
        "--failing-files",
        action="append",
        default=[],
        metavar="FILE",
        help="path to failing test file; repeat for each file",
    )
    pwb6.add_argument("--error-summary", default="", metavar="TEXT",
                      help="first ~500 chars of the test error output")
    pwb6.set_defaults(func=cmd_write_b6_failure)

    return p


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
