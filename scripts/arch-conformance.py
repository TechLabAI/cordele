#!/usr/bin/env python3
"""arch-conformance.py - static architecture-rule checker (D-369, Fase 2).

The validator and implement commands ask the agent to verify ~14-16 architecture
rules BY EYE, duplicated across be/fe. Most are grep-able. This runs them
deterministically and emits `conformance.json` the validator merges, so the
agent stops eyeballing static checks. Rule profiles are data, not `if layer`
scattered around.

  check --layer fe|be --target <dir> [--stack java|python|node] [--module M]
        [--output conformance.json] [--report] [--dry-run]

FE (*.component.ts / *.ts): OnPush, standalone, no HttpClient in component,
  no localStorage/sessionStorage, no console.log, no cross-project ../../../ import.

BE dispatches per `backend_language` (D-569) -- the framework imposes the
contract (hexagonal layers, dependency direction, RULE-01..09), each stack
enforces it in its own idiom:

  java   (*.java) : no field @Autowired, no System.out, DDL outside migrations
  python (*.py)   : no infrastructure import in domain/application, no framework
                    import in domain, no print() outside scripts/CLI, DDL outside
                    alembic/versions
  node   (*.ts)   : no `new <X>Repository()` inside a service (DI by constructor),
                    no @nestjs//@prisma import in domain, no infrastructure import
                    from modules, no console.log, DDL outside prisma/migrations

Before D-569 the BE layer scanned only `*.java`; a FastAPI or NestJS service
matched zero files and PASSED in silence, while /be-validator treats this gate
as blocking. Unsupported stacks and empty scans now fail loudly instead.

Exit codes (R3): 0 clean | 1 user error | 2 blocking violation(s).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from cli_utils import force_utf8_stdio
from stack_resolution import (
    SUPPORTED_LANGUAGES,
    UnresolvedStack,
    resolve_backend_language,
    resolve_frontend_framework,
)

# ── FE patterns ───────────────────────────────────────────────────────────────
_ON_PUSH = re.compile(r"ChangeDetectionStrategy\s*\.\s*OnPush")
_STANDALONE = re.compile(r"standalone\s*:\s*true")
_HTTPCLIENT = re.compile(r"\bHttpClient\b")
_WEB_STORAGE = re.compile(r"\b(localStorage|sessionStorage)\b")
_CONSOLE_LOG = re.compile(r"\bconsole\.(log|debug)\s*\(")
_CROSS_PROJECT = re.compile(r"""from\s+['"](\.\./){3,}""")

# ── BE patterns: java ─────────────────────────────────────────────────────────
_FIELD_AUTOWIRED = re.compile(r"@Autowired\s+(private|protected|public)\s+\w[\w<>,. ]*\s+\w+\s*;")
_SYSTEM_OUT = re.compile(r"\bSystem\.(out|err)\.")
_DDL = re.compile(r"\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b", re.IGNORECASE)

# ── BE patterns: python (D-569) ───────────────────────────────────────────────
# Equivalences taken from python-hexagonal-patterns.md.j2 §9 (import-linter).
_PY_INFRA_IMPORT = re.compile(r"^\s*(?:from|import)\s+[\w.]*\binfrastructure\b", re.MULTILINE)
_PY_FRAMEWORK_IMPORT = re.compile(
    r"^\s*(?:from|import)\s+(?:fastapi|sqlalchemy|pydantic|httpx|alembic)\b", re.MULTILINE)
_PY_PRINT = re.compile(r"(?<![\w.])print\s*\(")

# ── BE patterns: node (D-569) ─────────────────────────────────────────────────
# Equivalences taken from node-hexagonal-patterns.md.j2 §10 (ESLint boundaries).
_TS_NEW_ADAPTER = re.compile(r"\bnew\s+\w*(?:Repository|Adapter|PrismaService|PrismaClient)\s*\(")
_TS_FRAMEWORK_IMPORT = re.compile(r"""(?:from|require\()\s*['"]@(?:nestjs|prisma)/""")
_TS_INFRA_IMPORT = re.compile(r"""(?:from|require\()\s*['"][^'"]*\binfrastructure\b[^'"]*['"]""")


# Vendored and generated trees are not authored source: scanning them produces
# violations nobody can fix (e.g. console.log inside node_modules/rxjs JSDoc).
_VENDOR_DIRS = frozenset({
    "node_modules", "dist", "build", "out", "coverage", "target",
    ".git", ".next", ".nx", ".angular", ".venv", "venv",
    "__pycache__", ".mypy_cache", ".pytest_cache", "generated",
})


def _iter_files(target: Path, suffixes: tuple[str, ...]) -> list[Path]:
    return [
        p for p in target.rglob("*")
        if p.is_file()
        and p.name.endswith(suffixes)
        and not _VENDOR_DIRS.intersection(part.lower() for part in p.relative_to(target).parts[:-1])
    ]


def _dir_parts(path: Path, target: Path) -> set[str]:
    """Lowercased directory segments of `path` relative to `target`."""
    try:
        rel = path.relative_to(target)
    except ValueError:
        rel = path
    return {part.lower() for part in rel.parts[:-1]}


def _in_any(path: Path, target: Path, names: tuple[str, ...]) -> bool:
    return bool(_dir_parts(path, target) & set(names))


def _scan(files: list[Path], pattern: re.Pattern, want: bool) -> list[str]:
    """want=True: every file MUST match (violation if absent).
       want=False: NO file may match (violation per match)."""
    violations: list[str] = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        found = pattern.search(text)
        if want and not found:
            violations.append(f"{f.name}: missing required pattern")
        elif not want and found:
            for i, line in enumerate(text.splitlines(), 1):
                if pattern.search(line):
                    violations.append(f"{f.name}:{i}: {line.strip()[:80]}")
    return violations


_REACT_LOCALSTORAGE = re.compile(r"\blocalStorage\b")
_REACT_DEEP_IMPORT = re.compile(r"from\s+['\"]@/lib/(?!shared)[a-z0-9-]+/[a-z]")
_REACT_APP_IMPORT = re.compile(r"from\s+['\"]@/app/")


def check_fe_react(target: Path) -> list[dict]:
    """Equivalentes React das regras Angular, tirados dos standards da Wave 1.

    `react-access-layer-contracts`: o access token vive em sessionStorage,
    "never localStorage". `react-nx-boundaries`: um modulo consome-se pelo
    barril, `@/lib/<m>/store/...` de fora e violacao, e `src/app/` e composicao
    -- nenhum modulo importa de la. OnPush/standalone nao tem equivalente:
    sao mecanismos de deteccao de mudancas do Angular, nao um principio.
    """
    tsx = _iter_files(target, (".tsx", ".ts"))
    return [
        {"rule": "no-localstorage", "violations": _scan(tsx, _REACT_LOCALSTORAGE, want=False)},
        {"rule": "no-deep-module-import", "violations": _scan(tsx, _REACT_DEEP_IMPORT, want=False)},
        {"rule": "no-app-import-from-module", "violations": _scan(tsx, _REACT_APP_IMPORT, want=False)},
        {"rule": "no-console-log", "violations": _scan(tsx, _CONSOLE_LOG, want=False)},
    ]


def check_fe_angular(target: Path) -> list[dict]:
    components = _iter_files(target, (".component.ts",))
    all_ts = _iter_files(target, (".ts",))
    return [
        {"rule": "OnPush", "violations": _scan(components, _ON_PUSH, want=True)},
        {"rule": "standalone", "violations": _scan(components, _STANDALONE, want=True)},
        {"rule": "no-HttpClient-in-component", "violations": _scan(components, _HTTPCLIENT, want=False)},
        {"rule": "no-web-storage", "violations": _scan(all_ts, _WEB_STORAGE, want=False)},
        {"rule": "no-console-log", "violations": _scan(all_ts, _CONSOLE_LOG, want=False)},
        {"rule": "no-cross-project-import", "violations": _scan(all_ts, _CROSS_PROJECT, want=False)},
    ]


_FE_CHECKERS = {"angular": check_fe_angular, "react": check_fe_react}
_FE_SUFFIXES = {"angular": (".component.ts",), "react": (".tsx",)}


def check_be_java(target: Path) -> list[dict]:
    java = _iter_files(target, (".java",))
    return [
        {"rule": "no-field-autowired", "violations": _scan(java, _FIELD_AUTOWIRED, want=False)},
        {"rule": "no-system-out", "violations": _scan(java, _SYSTEM_OUT, want=False)},
        {"rule": "no-ddl-outside-migrations", "violations": _scan(java, _DDL, want=False)},
    ]


def check_be_python(target: Path) -> list[dict]:
    """Python equivalents of the Java rules (python-hexagonal-patterns.md §9)."""
    py = _iter_files(target, (".py",))
    domain = [f for f in py if _in_any(f, target, ("domain",))]
    domain_app = [f for f in py if _in_any(f, target, ("domain", "application"))]
    # print() is legitimate in CLI entry points, scripts and alembic env.py.
    runtime = [f for f in py
               if not _in_any(f, target, ("scripts", "cli", "tests", "alembic", "migrations"))
               and f.name not in ("__main__.py", "manage.py", "conftest.py")]
    non_migration = [f for f in py if not _in_any(f, target, ("versions", "migrations", "alembic"))]
    return [
        # Injection: the domain never reaches for a concrete adapter; ports are Protocols.
        {"rule": "no-infrastructure-import-in-domain",
         "violations": _scan(domain_app, _PY_INFRA_IMPORT, want=False)},
        # Layers: domain stays framework-free (import-linter RULE-01/02).
        {"rule": "no-framework-import-in-domain",
         "violations": _scan(domain, _PY_FRAMEWORK_IMPORT, want=False)},
        # Output: no print() outside scripts/CLI.
        {"rule": "no-print", "violations": _scan(runtime, _PY_PRINT, want=False)},
        # DDL: only inside alembic/versions.
        {"rule": "no-ddl-outside-migrations", "violations": _scan(non_migration, _DDL, want=False)},
    ]


def check_be_node(target: Path) -> list[dict]:
    """Node equivalents of the Java rules (node-hexagonal-patterns.md §10)."""
    ts = [f for f in _iter_files(target, (".ts",))
          if not f.name.endswith((".d.ts", ".spec.ts", ".e2e-spec.ts"))]
    domain = [f for f in ts if _in_any(f, target, ("domain",))]
    services = [f for f in ts
                if _in_any(f, target, ("modules", "application", "domain"))
                and not _in_any(f, target, ("infrastructure",))]
    modules = [f for f in ts if _in_any(f, target, ("modules", "application", "domain"))]
    non_migration = [f for f in ts if not _in_any(f, target, ("migrations", "prisma"))]
    return [
        # Injection: DI by constructor, never `new SomethingRepository()` in a service.
        {"rule": "no-adapter-instantiation-in-service",
         "violations": _scan(services, _TS_NEW_ADAPTER, want=False)},
        # Layers: domain stays framework-free (RULE-01/02).
        {"rule": "no-framework-import-in-domain",
         "violations": _scan(domain, _TS_FRAMEWORK_IMPORT, want=False)},
        # Layers: modules/application do not import infrastructure (RULE-04).
        {"rule": "no-infrastructure-import-in-modules",
         "violations": _scan(modules, _TS_INFRA_IMPORT, want=False)},
        # Output: no console.log.
        {"rule": "no-console-log", "violations": _scan(ts, _CONSOLE_LOG, want=False)},
        # DDL: only inside prisma/migrations.
        {"rule": "no-ddl-outside-migrations", "violations": _scan(non_migration, _DDL, want=False)},
    ]


_BE_CHECKERS = {
    "java": check_be_java,
    "python": check_be_python,
    "node": check_be_node,
}

_BE_SUFFIXES = {"java": (".java",), "python": (".py",), "node": (".ts",)}


def check_be(target: Path, stack: str = "java") -> list[dict]:
    """Dispatch the BE ruleset per backend language (D-569)."""
    checker = _BE_CHECKERS.get(stack)
    if checker is None:
        raise ValueError(
            f"unsupported backend stack {stack!r}; supported: {', '.join(SUPPORTED_LANGUAGES)}")
    return checker(target)


def run_check(layer: str, target: Path, stack: str = "java") -> dict:
    checks = (_FE_CHECKERS[stack](target) if layer == "fe"
              else check_be(target, stack))
    for c in checks:
        c["ok"] = not c["violations"]
    return {
        "layer": layer,
        "target": str(target),
        "passed": all(c["ok"] for c in checks),
        "checks": checks,
    }


def cmd_check(args) -> int:
    target = Path(args.target)
    if not target.is_dir():
        print(f"error: target dir not found: {target}", file=sys.stderr)
        return 1

    if args.layer == "fe":
        # D-586: a metade que faltou ao D-570. O FE assumia Angular, varria
        # `*.component.ts` num projeto Next.js, encontrava zero e aprovava seis
        # regras vazias. Mesmas tres guardas do BE: resolve, recusa o que nao
        # sabe verificar, e falha quando nao ha nada para verificar.
        try:
            stack, source = resolve_frontend_framework(target, args.framework, args.module)
        except UnresolvedStack as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        if stack not in _FE_CHECKERS:
            print(f"error: unsupported frontend framework {stack!r} (resolved from {source}); "
                  f"supported: {', '.join(sorted(_FE_CHECKERS))}. This gate refuses to pass "
                  f"a stack it cannot verify.", file=sys.stderr)
            return 1
        if not _iter_files(target, _FE_SUFFIXES[stack]):
            print(f"error: no {'/'.join(_FE_SUFFIXES[stack])} source files under {target} "
                  f"for framework {stack!r} (resolved from {source}); nothing was verified",
                  file=sys.stderr)
            return 1

    stack, source = (stack, source) if args.layer == "fe" else ("java", "n/a")
    if args.layer == "be":
        try:
            stack, source = resolve_backend_language(target, args.stack, args.module)
        except UnresolvedStack as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        if stack not in _BE_CHECKERS:
            print(f"error: unsupported backend stack {stack!r} (resolved from {source}); "
                  f"supported: {', '.join(SUPPORTED_LANGUAGES)}. This gate refuses to pass "
                  f"a stack it cannot verify.", file=sys.stderr)
            return 1
        # A stack-aware gate that finds nothing has verified nothing: say so.
        if not _iter_files(target, _BE_SUFFIXES[stack]):
            print(f"error: no {'/'.join(_BE_SUFFIXES[stack])} source files under {target} "
                  f"for stack {stack!r} (resolved from {source}); nothing was verified",
                  file=sys.stderr)
            return 1

    if args.dry_run:
        rules = [c["rule"] for c in (_FE_CHECKERS[stack](target) if args.layer == "fe"
                                     else check_be(target, stack))]
        where = f" stack={stack} (from {source})" if args.layer == "be" else ""
        print(f"dry-run: layer={args.layer}{where} target={target}")
        print(f"dry-run: rules={', '.join(rules)}")
        print(f"dry-run: output={args.output or '(stdout)'} (nothing written)")
        print("OK: dry-run, no checks executed and no file written")
        return 0

    result = run_check(args.layer, target, stack)
    if args.layer == "be" and args.report:
        print(f"arch-conformance: stack={stack} (resolved from {source})", file=sys.stderr)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        tmp = Path(args.output).with_suffix(".json.tmp")
        tmp.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(tmp, Path(args.output))
    if args.report or not args.output:
        for c in result["checks"]:
            mark = "ok " if c["ok"] else "FAIL"
            print(f"  [{mark}] {c['rule']} ({len(c['violations'])} violation(s))")
            for v in c["violations"][:10]:
                print(f"       {v}")

    if not result["passed"]:
        bad = [c["rule"] for c in result["checks"] if not c["ok"]]
        print(f"error: conformance FAILED -- {', '.join(bad)}", file=sys.stderr)
        return 2
    print(f"OK: arch-conformance clean ({args.layer}, {len(result['checks'])} rules)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="arch-conformance.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    pc = sub.add_parser("check", help="run static architecture-rule checks")
    pc.add_argument("--layer", required=True, choices=["fe", "be"])
    pc.add_argument("--framework", choices=sorted(_FE_CHECKERS),
                    help="Pin the frontend framework instead of resolving it (D-586).")
    pc.add_argument("--target", required=True, metavar="DIR")
    pc.add_argument("--stack", choices=list(SUPPORTED_LANGUAGES), default=None,
                    help="backend language (default: resolved from project-context.json, "
                         "then filesystem markers) -- D-569")
    pc.add_argument("--module", metavar="MODULE",
                    help="module prefix, so modules[].stack.backend overrides the global "
                         "tier (shallow inheritance, D-550)")
    pc.add_argument("--output", metavar="PATH", help="write conformance.json")
    pc.add_argument("--report", action="store_true")
    pc.add_argument("--dry-run", action="store_true",
                    help="print the resolved stack and rule set; run nothing, write nothing")
    pc.set_defaults(func=cmd_check)
    return p


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
