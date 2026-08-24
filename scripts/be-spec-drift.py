#!/usr/bin/env python3
"""be-spec-drift.py — drift detection + living-specs bidirecional (D-160, D-204, D-205).

Sub-commands:
  check    Detect drift between EARS spec and Java AST (original behaviour, D-160).
  reverse  Given a git diff, propose EARS clauses for code additions missing in spec (D-204).
  apply    Apply human-approved proposals from a reverse-output file to spec (D-205).

Backward compatibility:
  Running without a subcommand (i.e. --module ... --service ...) routes to ``check``.

Usage:
  # check (original)
  python scripts/be-spec-drift.py check \\
      --module OBR \\
      --service "D:/…/obras-service" \\
      [--spec <path>] [--arch-dir <path>] [--mapping <path>] [--output <path>] \\
      [--show-unmapped] [--strict]

  # reverse
  python scripts/be-spec-drift.py reverse PRD \\
      --since <sha> \\
      --service "D:/…/perdas-service" \\
      [--output tmp/pp-v3/spec-updates-proposed-PRD.md]

  # apply
  python scripts/be-spec-drift.py apply PRD \\
      --from tmp/pp-v3/spec-updates-proposed-PRD.md \\
      --service "D:/…/perdas-service" \\
      [--dry-run]

Exit codes (check):
  0 — report produced, zero ERROR-severity findings
  1 — invalid args
  2 — report produced, ≥1 ERROR-severity finding (only with --strict)

Exit codes (reverse / apply):
  0 — success
  1 — error (bad args, git failure, no spec file found)
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any

THIS = Path(__file__).resolve()
SCRIPTS = THIS.parent
sys.path.insert(0, str(SCRIPTS))

from asset_resolution import templates_root  # noqa: E402
from be_spec_drift_lib.comparator import DRIFT_CLASSES, ComparatorReport, compare  # noqa: E402
from be_spec_drift_lib.ears_parser import EarsClause, parse_ears  # noqa: E402
from be_spec_drift_lib.java_ast import extract_facts  # noqa: E402
from be_spec_drift_lib.reverser import (  # noqa: E402
    apply_approved_clauses,
    detect_code_additions,
    format_proposal_doc,
    git_diff_since,
)
from cli_utils import force_utf8_stdio  # noqa: E402

# ── Shared helpers ────────────────────────────────────────────────────────────


def _walk_up_for(start: Path, predicate) -> Path | None:
    cur = start.resolve()
    for ancestor in [cur, *cur.parents]:
        if predicate(ancestor):
            return ancestor
    return None


def _resolve_workspace(start: Path) -> Path:
    found = _walk_up_for(
        start,
        lambda p: (p / "pyproject.toml").exists() and (p / "scripts" / "new-project.py").exists(),
    )
    if found is None:
        sys.exit(
            "error: cannot locate techlab-architecture workspace "
            "(no pyproject.toml + templates/ ancestor)"
        )
    return found


def _resolve_arch_dir(service: Path) -> Path | None:
    def has_arch_dir(p: Path) -> bool:
        d = p / "arch" / "decisions"
        return d.is_dir() and any(d.glob("*.arch.json"))

    return _walk_up_for(service, has_arch_dir)


def _collect_specs(service: Path, module: str) -> list[Path]:
    out: list[Path] = []
    service_name = service.name
    project_root = _walk_up_for(service, lambda p: (p / "docs" / "architecture").is_dir())
    if project_root is None:
        return out
    docs_root = project_root / "docs" / "architecture" / "backend"
    spec_dir = docs_root / "services" / service_name / "spec"
    if spec_dir.is_dir():
        out.extend(sorted(spec_dir.rglob("*.md")))
    issues_dir = docs_root / "issues"
    if issues_dir.is_dir():
        prefix = f"{module}-"
        out.extend(sorted(p for p in issues_dir.glob(f"{prefix}*.md") if p.is_file()))
    return out


def _load_arch_data(arch_dir: Path | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if arch_dir is None or not arch_dir.is_dir():
        return out
    for p in sorted(arch_dir.glob("*.arch.json")):
        try:
            out[p.name] = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"warning: skipping malformed {p}: {e}", file=sys.stderr)
    return out


# ── check subcommand ──────────────────────────────────────────────────────────


def _render_report(
    *,
    module: str,
    service: Path,
    specs: list[Path],
    arch_dir: Path | None,
    mapping_path: Path,
    parsed_count: int,
    unparsed_count: int,
    report: ComparatorReport,
    show_unmapped: bool,
) -> str:
    summary = report.summary()
    total = sum(summary.values())
    now = _dt.datetime.now(_dt.UTC).strftime("%Y-%m-%d %H:%M UTC")

    lines: list[str] = []
    lines.append(f"# Spec drift report — {module}")
    lines.append("")
    lines.append(f"- **Service:** `{service}`")
    lines.append(f"- **Mapping:** `{mapping_path}`")
    lines.append(f"- **Arch dir:** `{arch_dir if arch_dir else '<not resolved>'}`")
    lines.append(f"- **Specs scanned:** {len(specs)} file(s)")
    lines.append(f"- **Java files parsed / unparsed:** {parsed_count} / {unparsed_count}")
    lines.append(f"- **Generated:** {now}")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Class | Count |")
    lines.append("|---|---|")
    for c in DRIFT_CLASSES:
        lines.append(f"| {c} | {summary.get(c, 0)} |")
    lines.append(f"| **TOTAL** | **{total}** |")
    lines.append("")
    if total == 0:
        lines.append("> No drift detected against the v1.0 rule set.")
        lines.append("")
    for cls in DRIFT_CLASSES:
        items = report.by_class(cls)
        if not items:
            continue
        if cls == "UNMAPPED" and not show_unmapped:
            continue
        lines.append(f"## {cls} ({len(items)})")
        lines.append("")
        for f in items:
            lines.append(f"### {f.rule_id} — {f.drift_type} ({f.severity})")
            lines.append("")
            if f.spec_evidence:
                lines.append(f"- **Spec evidence:** {f.spec_evidence}")
            if f.code_evidence:
                lines.append(f"- **Code evidence:** {f.code_evidence}")
            if f.location_spec:
                lines.append(f"- **Spec location:** `{f.location_spec}`")
            if f.location_code:
                lines.append(f"- **Code location:** `{f.location_code}`")
            if f.detail:
                lines.append(f"- **Detail:** {f.detail}")
            if f.resolution_hint:
                lines.append(f"- **Resolution hint:** {f.resolution_hint}")
            lines.append("")
    if unparsed_count > 0:
        lines.append("## Notes")
        lines.append("")
        lines.append(
            f"- {unparsed_count} Java file(s) failed full javalang parse; class-level annotations "
            "were extracted via regex fallback. Affects only files using Java 16+ pattern matching, "
            "records, or sealed types."
        )
        lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        "> Report generated by `scripts/be-spec-drift.py` (D-160). "
        "Read-only — resolve each item manually."
    )
    lines.append("")
    return "\n".join(lines)


def _run_check(args: argparse.Namespace) -> int:
    service = args.service.resolve()
    if not service.is_dir():
        sys.exit(f"error: --service path is not a directory: {service}")

    workspace = _resolve_workspace(SCRIPTS)
    mapping_path = args.mapping or (
        templates_root(workspace)
        / "architecture"
        / "shared"
        / "code-mapping"
        / "code-mapping.arch.json"
    )
    if not mapping_path.is_file():
        sys.exit(f"error: mapping file not found: {mapping_path}")

    try:
        code_mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"error: code-mapping is not valid JSON: {e}")

    specs = args.spec if args.spec else _collect_specs(service, args.module)
    if not specs:
        print("warning: no spec files discovered; EARS findings will be empty", file=sys.stderr)
    clauses: list[EarsClause] = []
    for spec in specs:
        clauses.extend(parse_ears(spec))

    arch_dir = args.arch_dir.resolve() if args.arch_dir else _resolve_arch_dir(service)
    arch_data = _load_arch_data(arch_dir)

    facts = extract_facts(service)
    report = compare(
        clauses=clauses,
        facts=facts,
        code_mapping=code_mapping,
        arch_data=arch_data,
        show_unmapped=args.show_unmapped,
    )
    rendered = _render_report(
        module=args.module,
        service=service,
        specs=specs,
        arch_dir=arch_dir,
        mapping_path=mapping_path,
        parsed_count=len(facts.parsed_files),
        unparsed_count=len(facts.unparsed),
        report=report,
        show_unmapped=args.show_unmapped,
    )
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"OK: wrote report to {args.output}")
    else:
        print(rendered)

    if args.strict:
        any_error = any(
            f.severity == "error" and f.drift_class != "UNMAPPED"
            for f in report.findings
        )
        if any_error:
            return 2
    return 0


# ── reverse subcommand ────────────────────────────────────────────────────────


def _run_reverse(args: argparse.Namespace) -> int:
    service = args.service.resolve()
    if not service.is_dir():
        sys.exit(f"error: --service path is not a directory: {service}")

    since = args.since or "HEAD~1"

    # Get git diff from the service's project root (walk up to find .git)
    def _has_git(p: Path) -> bool:
        return (p / ".git").exists() or (p / ".git").is_file()

    repo_root = _walk_up_for(service, _has_git)
    if repo_root is None:
        sys.exit(f"error: no git repository found above {service}")

    try:
        diff_text = git_diff_since(since, repo_root)
    except RuntimeError as e:
        sys.exit(f"error: {e}")

    if not diff_text.strip():
        print(f"OK: no diff between {since} and HEAD — nothing to propose")
        return 0

    additions = detect_code_additions(diff_text)

    # Determine output path
    output_path: Path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        workspace = _resolve_workspace(SCRIPTS)
        output_path = workspace / "tmp" / "pp-v3" / f"spec-updates-proposed-{args.module}.md"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = format_proposal_doc(args.module, additions)
    output_path.write_text(doc, encoding="utf-8")

    n = len(additions)
    if n == 0:
        print(
            f"OK: diff parsed — no new REST endpoints detected between {since}..HEAD\n"
            f"    Proposal written to {output_path} (empty)"
        )
    else:
        print(f"OK: detected {n} new addition(s) — proposal written to {output_path}")
        for add in additions:
            label = f"{add.http_method} {add.path}" if add.kind == "endpoint" else add.member_name
            print(f"    {add.kind}: {label} ({add.class_name}.{add.member_name})")
    return 0


# ── apply subcommand ──────────────────────────────────────────────────────────


def _run_apply(args: argparse.Namespace) -> int:
    proposal_path = Path(args.from_file).resolve()
    if not proposal_path.is_file():
        sys.exit(f"error: proposal file not found: {proposal_path}")

    service = args.service.resolve()
    if not service.is_dir():
        sys.exit(f"error: --service path is not a directory: {service}")

    # Discover spec files
    spec_files: list[Path]
    if args.spec:
        spec_files = [Path(p).resolve() for p in args.spec]
    else:
        spec_files = _collect_specs(service, args.module)

    if not spec_files:
        print(
            f"warning: no spec files found for module {args.module} — "
            "pass --spec explicitly",
            file=sys.stderr,
        )

    # Changelog path: alongside the spec or explicit
    changelog_path: Path | None = None
    if spec_files:
        spec_dir = spec_files[0].parent
        changelog_path = spec_dir / "notas" / "spec-changelog.md"

    _n = apply_approved_clauses(
        proposal_path=proposal_path,
        spec_files=spec_files,
        changelog_path=changelog_path,
        dry_run=getattr(args, "dry_run", False),
    )
    return 0


# ── argument parsers ──────────────────────────────────────────────────────────


def _build_parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="be-spec-drift.py",
        description="Spec drift detection + living-specs bidirecional (D-160, D-204, D-205).",
    )
    sub = root.add_subparsers(dest="command")

    # ── check ──
    p_check = sub.add_parser("check", help="Detect drift between spec and code (original)")
    p_check.add_argument("--module", required=True, help="Module ID (e.g. OBR)")
    p_check.add_argument("--service", type=Path, required=True,
                         help="Absolute path to the Spring Boot service root")
    p_check.add_argument("--spec", type=Path, action="append", default=None)
    p_check.add_argument("--arch-dir", type=Path, default=None)
    p_check.add_argument("--mapping", type=Path, default=None)
    p_check.add_argument("--output", type=Path, default=None)
    p_check.add_argument("--show-unmapped", action="store_true")
    p_check.add_argument("--strict", action="store_true")

    # ── reverse ──
    p_rev = sub.add_parser(
        "reverse",
        help="Propose EARS clauses for code additions not yet in spec (D-204)",
    )
    p_rev.add_argument("module", help="Module ID (e.g. PRD)")
    p_rev.add_argument("--since", default=None,
                       help="Git ref to diff against (default: HEAD~1)")
    p_rev.add_argument("--service", type=Path, required=True,
                       help="Path to the Spring Boot service root (used to locate the git repo)")
    p_rev.add_argument("--output", default=None,
                       help="Output proposal file (default: tmp/pp-v3/spec-updates-proposed-<MODULE>.md)")

    # ── apply ──
    p_app = sub.add_parser(
        "apply",
        help="Apply human-approved proposals from a reverse output file (D-205)",
    )
    p_app.add_argument("module", help="Module ID (e.g. PRD)")
    p_app.add_argument("--from", dest="from_file", required=True,
                       help="Path to the proposal file produced by reverse")
    p_app.add_argument("--service", type=Path, required=True,
                       help="Service root (used for spec file discovery)")
    p_app.add_argument("--spec", type=Path, action="append", default=None,
                       help="Spec file to patch (repeatable; overrides discovery)")
    p_app.add_argument("--dry-run", action="store_true",
                       help="Show what would be applied without writing")

    return root


# ── entry point ───────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    if argv is None:
        argv = sys.argv[1:]

    # Backward compat: old flat invocation (--module ... --service ...) → check
    if argv and argv[0].startswith("-"):
        argv = ["check", *list(argv)]

    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "check":
        return _run_check(args)
    elif args.command == "reverse":
        args.module = args.module  # positional on reverse
        return _run_reverse(args)
    elif args.command == "apply":
        args.module = args.module  # positional on apply
        return _run_apply(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
