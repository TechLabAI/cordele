#!/usr/bin/env python3
"""gates-run.py - run the toolchain and emit gate verdicts (D-366, Fase 1, D-553, D-557).

Closes the loop left open by D-317: `validator-score.py` is designed to RECEIVE
gate verdicts (`--gates gates.json`) and deliberately never runs the toolchain.
Until now nothing produced that JSON — the agent was the glue, running
`npx nx lint/test/build` (or `./gradlew ...`), eyeballing `tail -20`, and
translating to `--lint pass`. This script is that missing producer.

It is the ONE script that executes the toolchain (by design the validator does
not). It runs each requested gate, derives a verdict from the exit code, and
emits the flat `{"lint":"pass","test":"pass",...}` JSON that
`validator-score.py collect_gates` consumes verbatim.

Verdict rule (deterministic):
    tool missing       -> "skip"   (e.g. e2e not configured)
    exit code == 0     -> "pass"
    exit code != 0     -> "fail"

BE toolchain dispatches per `backend_language` (D-569) -- same slot names
(`lint`, `test`, `build`, `e2e`, `arch-conformance`), each stack's native tool:

    slot              java                          python                 node
    lint              ./gradlew :<p>:spotlessCheck  ruff check + mypy      pnpm lint + pnpm typecheck
    test              ./gradlew :<p>:test           pytest -m "not integration"  pnpm test
    build             ./gradlew :<p>:build          uv build               pnpm build
    e2e               ./gradlew :<p>:integrationTest pytest -m integration pnpm test:e2e
    arch-conformance  ./gradlew :<p>:archTest       lint-imports           pnpm lint

Before D-569 the BE path emitted `./gradlew ...` unconditionally, so the four
execution commands invoked Gradle inside a FastAPI service.

Usage:
    gates-run.py run --layer fe --project lead --gates lint,test,build,e2e
    gates-run.py run --layer be --project obras-service --gates test,build --output gates.json
    gates-run.py run --layer be --project pay-service --gates lint,test --stack python --dry-run
    # B5 (leve) with touched-packages scope (D-553, D-557):
    gates-run.py run --layer be --project pay-service --gates test,arch-conformance \
        --mode b5 --module PAY --output gates.json
    # then:
    validator-score.py score --issue LEAD-FE-001 --gates gates.json

touched-packages.json schema (written by be-implement, read here):
    {
      "priority": "P1",
      "module": "PAY",
      "files_written": ["backend/pay-service/src/main/java/..."],
      "has_java": true,
      "has_test_java": false,
      "has_resources_only": false,
      "has_docs_only": false,
      "has_api_contract": false
    }

Exit codes (R3): 0 success | 1 user error | 2 a gate FAILED (so CI can branch).
Note: a failing gate is exit 2; producing the JSON still succeeds (it is written).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from cli_utils import force_utf8_stdio
from stack_resolution import (
    SUPPORTED_LANGUAGES,
    UnresolvedStack,
    resolve_backend_language,
)

_GATES = ("lint", "test", "build", "e2e", "arch-conformance")
_VERDICTS = ("pass", "fail", "skip")

# Per-layer mapping: gate -> toolchain command (project substituted at runtime).
# fe: Nx targets (`nx <target> <project>`). be: Gradle tasks (`:<project>:<task>`).
_FE_TARGET = {"lint": "lint", "test": "test", "build": "build", "e2e": "e2e"}
_BE_TASK = {
    "lint": "spotlessCheck",
    "test": "test",
    "build": "build",
    "e2e": "integrationTest",
    # ArchUnit gate — runs architecture rule checks (D-553). Skip when no .java modified.
    "arch-conformance": "archTest",
}

# Non-Java BE toolchains (D-569). Each slot maps to a LIST of argv: a slot may
# need more than one tool (python lint = ruff + mypy). The slot verdict is the
# worst of its commands.
_BE_CMDS_PYTHON: dict[str, list[list[str]]] = {
    "lint": [["ruff", "check", "."], ["mypy", "."]],
    # pyproject.toml declares only the `integration` marker, so the unit slice is
    # its complement (`-m unit` would select nothing and pass vacuously).
    "test": [["pytest", "-m", "not integration"]],
    "build": [["uv", "build"]],
    "e2e": [["pytest", "-m", "integration"]],
    # import-linter contracts (python-hexagonal-patterns.md §9) = ArchUnit analogue.
    "arch-conformance": [["lint-imports"]],
}

_BE_CMDS_NODE: dict[str, list[list[str]]] = {
    "lint": [["pnpm", "lint"], ["pnpm", "typecheck"]],
    "test": [["pnpm", "test"]],
    "build": [["pnpm", "build"]],
    "e2e": [["pnpm", "test:e2e"]],
    # eslint-plugin-boundaries (node-hexagonal-patterns.md §10) = ArchUnit analogue.
    "arch-conformance": [["pnpm", "lint"]],
}

_BE_CMDS = {"python": _BE_CMDS_PYTHON, "node": _BE_CMDS_NODE}


def read_touched_packages(module: str, tmp_dir: Path) -> dict | None:
    """Read touched-packages.json written by be-implement (D-553, D-557).

    Returns the parsed dict or None if the file is absent or malformed.
    Absence is not an error — callers fall back to current behavior.
    """
    path = tmp_dir / module / "touched-packages.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _b5_scope_gates(gates: list[str], touched: dict | None, stack: str = "java") -> list[str]:
    """Adjust B5 gate list based on touched-packages (D-553, D-557).

    Rules (absent file → no change, backward compatible):
    - docs_only  (only *.md/*.adoc/*.j2): skip all test/lint/arch gates.
    - resources_only (only src/main/resources): keep e2e (integration), skip unit test.
    - no java (has_java=False): skip arch-conformance.
    - has_api_contract: keep e2e (BDD slice + contract verify).
    B6 (full) callers must NOT call this function — always run all gates.
    """
    if touched is None:
        return gates

    result = list(gates)

    if touched.get("has_docs_only"):
        return [g for g in result if g not in ("test", "e2e", "arch-conformance")]

    if touched.get("has_resources_only"):
        # Integration only: remove unit-test gate, keep e2e.
        return [g for g in result if g != "test"]

    # `has_java` is a Java-only signal (D-553). On python/node it is absent (so
    # falsy), and dropping arch-conformance because of it would reintroduce the
    # very false green D-569 fixes -- only honour it on the Java path.
    if stack == "java" and not touched.get("has_java", True):
        # No Java files written: ArchUnit has nothing to check.
        result = [g for g in result if g != "arch-conformance"]

    return result


def gate_command(layer: str, gate: str, project: str) -> list[str]:
    """Toolchain argv for one gate (fe / java be). Pure (no execution).

    Kept for backward compatibility: the Java path must stay byte-identical.
    Non-Java BE stacks use `gate_commands()`, which may return several argv.
    """
    if layer == "fe":
        target = _FE_TARGET.get(gate)
        if target is None:
            # arch-conformance is BE-only; caller must filter it before FE runs.
            raise ValueError(f"Gate '{gate}' not supported for layer 'fe'")
        return ["npx", "nx", target, project]
    gradlew = "gradlew.bat" if os.name == "nt" else "./gradlew"
    return [gradlew, f":{project}:{_BE_TASK[gate]}"]


def gate_commands(layer: str, gate: str, project: str, stack: str = "java") -> list[list[str]]:
    """Toolchain argv LIST for one gate, dispatched per backend language (D-569)."""
    if layer == "fe" or stack == "java":
        return [gate_command(layer, gate, project)]
    table = _BE_CMDS.get(stack)
    if table is None:
        raise ValueError(
            f"unsupported backend stack {stack!r}; supported: {', '.join(SUPPORTED_LANGUAGES)}")
    cmds = table.get(gate)
    if cmds is None:
        raise ValueError(f"Gate '{gate}' not supported for stack '{stack}'")
    return [list(c) for c in cmds]


def gate_cwd(layer: str, root: Path, project: str, stack: str) -> Path:
    """Where a gate runs. Java/Gradle and Nx run from the repo root; python and
    node toolchains run inside the service package (`backend/services/<p>/`)."""
    if layer == "fe" or stack == "java":
        return root
    service_dir = root / "backend" / "services" / project
    return service_dir if service_dir.is_dir() else root


def verdict_for(returncode: int | None, found: bool) -> str:
    """Map an execution outcome to a gate verdict."""
    if not found:
        return "skip"
    return "pass" if returncode == 0 else "fail"


def _subprocess_runner(cmd: list[str], cwd: Path) -> tuple[int | None, bool, str]:
    """Run cmd; return (returncode, found, tail). found=False if the tool is absent.

    On Windows, executables such as pnpm and npx are .CMD wrappers; subprocess
    without shell=True raises FileNotFoundError for bare names like "pnpm".
    shutil.which() resolves the real path (honoring PATHEXT on Windows) before the
    subprocess call, eliminating the false-skip.  On Linux/macOS the behaviour is
    unchanged: which() returns the same path the shell would have used.

    Contract:
      - Tool absent from PATH          -> (None, False, "")  -> verdict "skip"
      - Tool found but fails to launch -> (1, True,  msg)   -> verdict "fail"  [VISIBLE]
      - Tool ran successfully          -> (0, True,  tail)  -> verdict "pass"
      - Tool ran and returned non-zero -> (rc, True, tail)  -> verdict "fail"
    """
    resolved = shutil.which(cmd[0])
    if resolved is None:
        # Tool genuinely absent from PATH — the only legitimate "skip" trigger.
        return None, False, ""
    full_cmd = [resolved] + list(cmd[1:])
    try:
        proc = subprocess.run(full_cmd, cwd=cwd, capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
    except (FileNotFoundError, OSError) as exc:
        # Tool existed at which()-time but failed to launch (e.g. permission error,
        # broken .CMD wrapper).  Must NOT be silent — surfaces as verdict "fail".
        msg = f"[gates-run] launch error for {cmd[0]!r}: {exc}"
        return 1, True, msg
    tail = (proc.stdout + proc.stderr)[-2000:]
    return proc.returncode, True, tail


def run_gates(layer: str, project: str, gates: list[str], cwd: Path,
              runner=_subprocess_runner, stack: str = "java") -> dict:
    """Run each gate and return {gate: verdict}. `runner` is injectable for tests.

    A slot may map to several commands (python lint = ruff + mypy): the slot is
    "fail" if any command fails, "pass" if at least one ran and none failed, and
    "skip" only when every tool of the slot is missing.
    """
    verdicts: dict[str, str] = {}
    for gate in gates:
        outcomes = []
        for cmd in gate_commands(layer, gate, project, stack):
            rc, found, _tail = runner(cmd, cwd)
            outcomes.append(verdict_for(rc, found))
        if "fail" in outcomes:
            verdicts[gate] = "fail"
        elif all(v == "skip" for v in outcomes):
            verdicts[gate] = "skip"
        else:
            verdicts[gate] = "pass"
    return verdicts


def _write_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def cmd_run(args: argparse.Namespace) -> int:
    gates = [g.strip() for g in args.gates.split(",") if g.strip()]
    bad = [g for g in gates if g not in _GATES]
    if bad:
        print(f"error: unknown gate(s) {bad}; valid: {', '.join(_GATES)}", file=sys.stderr)
        return 1
    cwd = Path(args.root).resolve() if args.root else Path.cwd()
    tmp_dir_base = Path(args.tmp_dir)
    if not tmp_dir_base.is_absolute():
        tmp_dir_base = cwd / tmp_dir_base

    # Resolve the backend toolchain (D-569). FE keeps the Nx path unchanged.
    stack, source = "java", "n/a (fe layer)"
    if args.layer == "be":
        try:
            stack, source = resolve_backend_language(cwd, args.stack, args.module or args.project)
        except UnresolvedStack as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        if stack != "java" and stack not in _BE_CMDS:
            print(f"error: unsupported backend stack {stack!r} (resolved from {source}); "
                  f"supported: {', '.join(SUPPORTED_LANGUAGES)}", file=sys.stderr)
            return 1

    # B5 (leve) mode: scope gates by touched-packages.json (D-553, D-557).
    # B6 (full) mode or no --mode: run all requested gates, ignore touched-packages.
    if args.mode == "b5" and args.module:
        touched = read_touched_packages(args.module, tmp_dir_base)
        gates = _b5_scope_gates(gates, touched, stack)
        if args.report and touched is not None:
            print(
                f"gates-run [b5 scope]: module={args.module} "
                f"has_java={touched.get('has_java')} "
                f"docs_only={touched.get('has_docs_only')} "
                f"resources_only={touched.get('has_resources_only')} "
                f"→ gates={gates}",
                file=sys.stderr,
            )
    elif args.mode == "b5" and not args.module:
        print("warning: --mode b5 without --module; touched-packages.json not read", file=sys.stderr)

    run_cwd = gate_cwd(args.layer, cwd, args.project, stack)

    if args.dry_run:
        where = f" stack={stack} (from {source})" if args.layer == "be" else ""
        print(f"dry-run: layer={args.layer}{where} project={args.project}")
        print(f"dry-run: cwd={run_cwd}")
        for gate in gates:
            for cmd in gate_commands(args.layer, gate, args.project, stack):
                print(f"dry-run:   {gate}: {' '.join(cmd)}")
        print(f"dry-run: output={args.output or '(stdout)'} (nothing executed, nothing written)")
        print("OK: dry-run")
        return 0

    verdicts = run_gates(args.layer, args.project, gates, run_cwd, stack=stack)

    if args.output:
        _write_atomic(Path(args.output), verdicts)
        dest = args.output
    else:
        print(json.dumps(verdicts, indent=2))
        dest = "(stdout)"

    failed = [g for g, v in verdicts.items() if v == "fail"]
    if args.report:
        summary = " ".join(f"{g}={v}" for g, v in verdicts.items())
        if args.layer == "be":
            print(f"gates-run: stack={stack} (resolved from {source}) cwd={run_cwd}",
                  file=sys.stderr)
        print(f"gates [{args.layer}:{args.project}] {summary} -> {dest}", file=sys.stderr)
    if failed:
        print(f"error: gate(s) failed: {', '.join(failed)} (verdicts written)", file=sys.stderr)
        return 2
    print(f"OK: gates {verdicts} -> {dest}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="gates-run.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("run", help="run toolchain gates and emit verdict JSON")
    pr.add_argument("--layer", required=True, choices=["fe", "be"])
    pr.add_argument("--project", required=True, help="Nx project (fe) or gradle service (be)")
    pr.add_argument("--gates", required=True,
                    help="comma list: lint,test,build,e2e,arch-conformance")
    pr.add_argument("--root", metavar="PATH", help="project root (default: cwd)")
    pr.add_argument("--output", metavar="PATH", help="write verdicts JSON (default: stdout)")
    pr.add_argument("--report", action="store_true", help="print a one-line summary to stderr")
    pr.add_argument("--stack", choices=list(SUPPORTED_LANGUAGES), default=None,
                    help="backend language (default: resolved from project-context.json, "
                         "then filesystem markers) -- D-569")
    pr.add_argument("--dry-run", action="store_true",
                    help="print the toolchain argv per gate; execute nothing, write nothing")
    pr.add_argument("--mode", choices=["b5", "b6"], default=None,
                    help="b5=leve: scope gates by touched-packages.json; "
                         "b6=full: always run all gates (D-553, D-557)")
    pr.add_argument("--module", metavar="MODULE",
                    help="module name for locating touched-packages.json (use with --mode b5)")
    pr.add_argument("--tmp-dir", metavar="PATH", default="tmp/pipeline-cycle",
                    help="base dir for cycle temp files (default: tmp/pipeline-cycle)")
    pr.set_defaults(func=cmd_run)
    return p


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
