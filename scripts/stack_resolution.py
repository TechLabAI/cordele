#!/usr/bin/env python3
"""stack_resolution.py - resolve the backend language for stack-aware gates (D-569).

Shared by `arch-conformance.py` and `gates-run.py`. Both used to be hardwired to
Java (`*.java` scan / `./gradlew` invocation), which meant a FastAPI or NestJS
service produced a silent false green. They now dispatch per `backend_language`.

Resolution order (first hit wins):

  1. explicit `--stack` flag
  2. `project-context.json` -- shallow merge per tier (D-550):
     `modules[].stack.backend.language` overrides `stack.backend.language`
  3. filesystem markers (a bare fixture dir with no project-context.json)
  4. give up -> `UnresolvedStack`, so the caller can fail loudly

Never guess silently: a gate that cannot tell which stack it is checking must
say so instead of passing.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CONTEXT_FILENAME = "project-context.json"

SUPPORTED_LANGUAGES = ("java", "python", "node")

# Filesystem markers used only when no project-context.json is reachable.
_MARKERS: dict[str, tuple[str, ...]] = {
    "java": ("build.gradle", "build.gradle.kts", "settings.gradle",
             "settings.gradle.kts", "pom.xml"),
    "python": ("pyproject.toml", "alembic.ini", "uv.lock"),
    "node": ("package.json", "pnpm-workspace.yaml", "nest-cli.json"),
}

_EXTENSIONS: dict[str, tuple[str, ...]] = {
    "java": (".java",),
    "python": (".py",),
    "node": (".ts",),
}


class UnresolvedStack(Exception):
    """Raised when the backend language cannot be determined."""


def find_context_file(start: Path) -> Path | None:
    """Walk up from `start` looking for project-context.json."""
    cur = start.resolve()
    for p in [cur, *cur.parents]:
        candidate = p / CONTEXT_FILENAME
        if candidate.is_file():
            return candidate
    return None


def _module_entry(ctx: dict[str, Any], module: str | None) -> dict[str, Any]:
    if not module:
        return {}
    registry = (ctx.get("modules") or {}).get("registry") or []
    want = module.upper()
    for entry in registry:
        if (entry.get("prefix") or "").upper() == want:
            return entry
        if str(entry.get("backendService") or "").lower() == module.lower():
            return entry
    return {}


def backend_stack(ctx: dict[str, Any], module_entry: dict[str, Any]) -> dict[str, Any]:
    """Shallow merge per tier (D-550): module stack.backend overrides the global tier."""
    merged = dict((ctx.get("stack") or {}).get("backend") or {})
    merged.update((module_entry.get("stack") or {}).get("backend") or {})
    return merged


def language_from_context(context_file: Path, module: str | None = None) -> str | None:
    try:
        ctx = json.loads(context_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    backend = backend_stack(ctx, _module_entry(ctx, module))
    language = backend.get("language")
    return str(language).lower() if language else None


def _count_sources(root: Path, suffixes: tuple[str, ...], limit: int = 1) -> int:
    seen = 0
    for p in root.rglob("*"):
        if p.is_file() and p.name.endswith(suffixes):
            seen += 1
            if seen >= limit:
                break
    return seen


def language_from_markers(root: Path) -> str | None:
    """Detect the stack from build markers / source files. Ambiguity -> None."""
    hits: list[str] = []
    for lang, markers in _MARKERS.items():
        if any((root / m).is_file() for m in markers):
            hits.append(lang)
    if len(hits) == 1:
        return hits[0]
    if hits:
        return None
    # No build marker: fall back to source extensions (bare fixture dirs).
    ext_hits = [lang for lang, sfx in _EXTENSIONS.items() if _count_sources(root, sfx)]
    return ext_hits[0] if len(ext_hits) == 1 else None


def resolve_backend_language(root: Path,
                             override: str | None = None,
                             module: str | None = None) -> tuple[str, str]:
    """Return (language, source) or raise UnresolvedStack.

    `source` is one of "flag", "project-context.json", "markers" -- useful for
    reporting so the operator can see how the gate decided.
    """
    if override:
        return override.lower(), "flag"

    context_file = find_context_file(root)
    if context_file is not None:
        language = language_from_context(context_file, module)
        if language:
            return language, str(context_file)

    language = language_from_markers(root)
    if language:
        return language, "markers"

    raise UnresolvedStack(
        f"cannot resolve backend_language for {root}: no --stack flag, no "
        f"{CONTEXT_FILENAME} with stack.backend.language, and filesystem markers "
        f"are absent or ambiguous"
    )

# ── Frontend (D-586) ─────────────────────────────────────────────────────────
# O D-570 deu resolucao por stack ao backend e deixou o frontend com `angular`
# implicito. O resultado era o gate FE a varrer `*.component.ts` num projeto
# Next.js, encontrar zero ficheiros e aprovar seis regras vazias.

SUPPORTED_FRAMEWORKS = ("angular", "react")

_FE_MARKERS: dict[str, tuple[str, ...]] = {
    "angular": ("angular.json", "nx.json"),
    "react": ("next.config.ts", "next.config.js", "components.json"),
}


def frontend_stack(ctx: dict[str, Any], module_entry: dict[str, Any]) -> dict[str, Any]:
    """Merge shallow por tier (D-550): module stack.frontend sobre o global."""
    merged = dict((ctx.get("stack") or {}).get("frontend") or {})
    merged.update((module_entry.get("stack") or {}).get("frontend") or {})
    return merged


def framework_from_context(context_file: Path, module: str | None = None) -> str | None:
    try:
        ctx = json.loads(context_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    fw = frontend_stack(ctx, _module_entry(ctx, module)).get("framework")
    return fw.lower() if isinstance(fw, str) and fw else None


def framework_from_markers(root: Path) -> str | None:
    """Um framework so conta quando os seus marcadores aparecem sozinhos."""
    hits = [fw for fw, names in _FE_MARKERS.items()
            if any((root / n).is_file() or any(root.rglob(n)) for n in names)]
    return hits[0] if len(hits) == 1 else None


def resolve_frontend_framework(root: Path,
                               override: str | None = None,
                               module: str | None = None) -> tuple[str, str]:
    """(framework, source) ou UnresolvedStack. Nunca adivinha."""
    if override:
        return override.lower(), "flag"

    context_file = find_context_file(root)
    if context_file is not None:
        framework = framework_from_context(context_file, module)
        if framework:
            return framework, str(context_file)

    framework = framework_from_markers(root)
    if framework:
        return framework, "markers"

    raise UnresolvedStack(
        f"cannot resolve frontend framework for {root}: no --framework flag, no "
        f"{CONTEXT_FILENAME} with stack.frontend.framework, and filesystem markers "
        f"are absent or ambiguous"
    )
