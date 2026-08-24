#!/usr/bin/env python3
"""pipeline-guard.py - prerequisite + name resolution for pipeline commands (D-365, Fase 1).

Kills the most-repeated boilerplate in the command set: every architect/exec
command re-implements "check files exist -> block with a list" and "prefix ->
canonical service/dir" as prose. This centralizes both as one read-only helper
with the R3 exit-2 contract, so commands call it instead of re-describing it.

  check   --stage {vision|specs|backlog|scaffold} --module <PREFIX> [--layer be|fe]
          Verify the stage's required files exist (registry below). Missing -> exit 2
          + a canonical block naming exactly what is absent.
  resolve --module <PREFIX> [--layer be|fe]
          Resolve a module prefix to {service, serviceDocsDir, issuesDir, package}
          from project-context.json. Emits JSON.

The required-files registry is DERIVED from the prereq blocks the commands
declare today (be-architect-{specs,backlog,scaffold}.md.j2), with `{svc}` and
`{prefix}` substituted. It is the single source of truth; commands stop carrying
their own hand-maintained lists.

Exit codes (R3): 0 success | 1 user error (unknown module/stage) | 2 prereqs missing.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from be_context_helper import find_project_root, load_project_context
from cli_utils import force_utf8_stdio

# Stage -> required file path templates (relative to project root).
# {svc} = canonical backend service name; {prefix} = module issue prefix.
# Derived from the commands' own prereq blocks (be-architect-*.md.j2).
_BE = "docs/architecture/backend/services/{svc}"
_REQUIRED: dict[str, dict[str, list[str]]] = {
    "be": {
        "vision": [],  # entry stage: brief is gathered in-conversation, no file prereqs
        "specs": [
            f"{_BE}/_brief.md",
            f"{_BE}/01-architectural-vision.md",
            f"{_BE}/04-backend-architecture-direction.md",
            f"{_BE}/05-persistence-model.md",
            # Vision emits slugged ADRs (ADR-001-<titulo>.md) — glob, not literal.
            f"{_BE}/adr/ADR-001*.md",
        ],
        "backlog": [
            f"{_BE}/contracts/api-contract.md",
            f"{_BE}/contracts/data-model.md",
            f"{_BE}/contracts/event-contracts.md",
            f"{_BE}/spec/backend/SPEC-01-api-surface.md",
            f"{_BE}/spec/backend/SPEC-04-data-model-migrations.md",
            f"{_BE}/events/event-catalog.md",
        ],
        "scaffold": [
            f"{_BE}/setup-local.md",
            f"{_BE}/{{svc}}-spec.md",
            f"{_BE}/generator-config.yml",
            "docs/architecture/backend/issues/{prefix}-001.md",
        ],
    },
}

_VALID_STAGES = {"vision", "specs", "backlog", "scaffold", "discover", "spec-delta"}


def _resolve_module(prefix: str, layer: str, root: Path) -> dict:
    """Resolve a module prefix to canonical paths. Raises SystemExit(1) if unknown."""
    ctx = load_project_context(root / "project-context.json")
    module = ctx.module_for_prefix(prefix)
    if module is None:
        known = ", ".join(m.get("prefix", "?") for m in ctx.modules) or "(none declared)"
        print(f"error: module prefix {prefix!r} not in project-context.json. "
              f"Known: {known}", file=sys.stderr)
        raise SystemExit(1)
    service = module.get("backendService") or f"{prefix.lower()}-service"
    return {
        "prefix": prefix,
        "layer": layer,
        "service": service,
        "serviceDocsDir": f"docs/architecture/backend/services/{service}",
        "issuesDir": "docs/architecture/backend/issues",
        "package": getattr(ctx, "package_base", None) or ctx.raw.get("backend", {}).get("packageBase"),
    }


def cmd_resolve(args: argparse.Namespace) -> int:
    root = find_project_root() if not args.root else Path(args.root).resolve()
    if root is None:
        print("error: project-context.json not found (walk up from cwd)", file=sys.stderr)
        return 1
    info = _resolve_module(args.module, args.layer, root)
    print(json.dumps(info, indent=2, ensure_ascii=False))
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    if args.stage not in _VALID_STAGES:
        print(f"error: unknown stage {args.stage!r}; valid: {', '.join(sorted(_VALID_STAGES))}",
              file=sys.stderr)
        return 1
    root = find_project_root() if not args.root else Path(args.root).resolve()
    if root is None:
        print("error: project-context.json not found (walk up from cwd)", file=sys.stderr)
        return 1

    info = _resolve_module(args.module, args.layer, root)
    stage_reqs = _REQUIRED.get(args.layer, {}).get(args.stage)
    if stage_reqs is None:
        print(f"OK: no prerequisites declared for {args.layer}/{args.stage} "
              f"(registry pending) -- not blocking")
        return 0

    svc, prefix = info["service"], info["prefix"]
    required = [tpl.format(svc=svc, prefix=prefix) for tpl in stage_reqs]
    def _present(rel: str) -> bool:
        if "*" in rel:
            return any(p.is_file() for p in root.glob(rel))
        return (root / rel).is_file()

    # D-453: shared project-level ADRs are not re-emitted in service-local adr/.
    # If the service-local ADR-001 glob misses, fall back to the project-level shared ADR dir.
    _SHARED_ADR_FALLBACKS: dict[str, str] = {
        "adr/ADR-001*.md": "docs/architecture/backend/adr/ADR-001*.md",
    }

    def _present_with_fallback(rel: str) -> bool:
        if _present(rel):
            return True
        for suffix, fallback in _SHARED_ADR_FALLBACKS.items():
            if rel.endswith(suffix):
                return any(p.is_file() for p in root.glob(fallback))
        return False

    missing = [rel for rel in required if not _present_with_fallback(rel)]

    if missing:
        print(f"{args.stage.capitalize()} nao pode prosseguir: pre-requisitos ausentes "
              f"(module {prefix}, service {svc}).", file=sys.stderr)
        print("Faltando:", file=sys.stderr)
        for rel in missing:
            print(f"  - {rel}", file=sys.stderr)
        print("-> gere os artefatos da etapa anterior antes de continuar.", file=sys.stderr)
        return 2

    print(f"OK: {args.stage} prereqs satisfied for {prefix} ({len(required)} file(s), service {svc})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pipeline-guard.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser("check", help="verify a stage's required files exist")
    pc.add_argument("--stage", required=True)
    pc.add_argument("--module", required=True, metavar="PREFIX")
    pc.add_argument("--layer", default="be", choices=["be", "fe"])
    pc.add_argument("--root", metavar="PATH", help="project root (default: walk up from cwd)")
    pc.set_defaults(func=cmd_check)

    pr = sub.add_parser("resolve", help="prefix -> canonical service/dir/package")
    pr.add_argument("--module", required=True, metavar="PREFIX")
    pr.add_argument("--layer", default="be", choices=["be", "fe"])
    pr.add_argument("--root", metavar="PATH", help="project root (default: walk up from cwd)")
    pr.set_defaults(func=cmd_resolve)

    return p


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else 1


if __name__ == "__main__":
    sys.exit(main())
