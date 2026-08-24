"""Asset resolution layer for /new-project (D-407 / F8).

The generator consumes the asset registry through the Asset Resolver — never by
walking the assets repo's filesystem layout directly. The chain:

    TECHLAB_ASSETS_HOME (clone of techlab-framework-assets)   ← preferred
        └─ fallback: embedded seeds in runtime/techlab_asset_registry/seeds
           (dual mode — removed only when the F8 cutover completes)

Outputs written to the generated project:
    .techlab/assembly-intent.json   what the generation asked for
    .techlab/assembly-plan.json     what the Resolver selected (+ rejections)

Export policy is enforced by the Resolver itself: never_export / resolver_only /
internal_only assets are structurally excluded from any plan — this is the
mechanism behind the F8 gate "no generated project contains techlab-ai source".
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def assets_root(workspace: Path) -> tuple[Path, str]:
    """Resolve the asset registry root and report which mode is active.

    Returns (path, mode) where mode is 'assets-repo' or 'embedded-seeds'.
    """
    env = os.environ.get("TECHLAB_ASSETS_HOME")
    if env:
        candidate = Path(env) / "assets"
        if candidate.is_dir():
            return candidate, "assets-repo"
        candidate = Path(env)
        if candidate.is_dir():
            return candidate, "assets-repo"
    embedded = workspace / "runtime" / "techlab_asset_registry" / "seeds"
    if embedded.is_dir():
        return embedded, "embedded-seeds"
    # D-409 cutover: embedded seeds removed — default to a sibling clone of
    # techlab-framework-assets next to the workspace.
    sibling = workspace.parent / "techlab-framework-assets" / "assets"
    return sibling, "sibling-clone"


def templates_root(workspace: Path) -> Path:
    """Resolve the Jinja templates root — the SINGLE source of truth (D-512).

    D-483 moved templates/ to techlab-framework-assets/templates/ and DELETED the
    in-repo copy. They resolve relative to the asset registry root (sibling clone or
    TECHLAB_ASSETS_HOME), falling back to workspace/templates/ only for legacy/offline
    checkouts that still vendor them. Every generator MUST route through this — hardcoding
    `workspace / "templates"` breaks the moment the repo is checked out without the deleted
    dir (the D-483 regression that left ~15 scripts and 11 workspace predicates broken).
    """
    try:
        root, _ = assets_root(workspace)
        for candidate in (root.parent / "templates", root / "templates"):
            if candidate.is_dir():
                return candidate
    except Exception:
        pass
    return workspace / "templates"


def is_workspace_root(p: Path) -> bool:
    """True if p is the techlab-architecture workspace root, using markers that SURVIVE the
    D-483 template migration (D-512). Pre-D-512 predicates required `(p/"templates").is_dir()`
    — deleted by D-483 — so they stopped recognizing the workspace at all. The stable markers
    are `scripts/new-project.py` (never present in a generated project) + `pyproject.toml`."""
    return (p / "scripts" / "new-project.py").exists() and (p / "pyproject.toml").exists()


def resolve_assembly_plan(
    workspace: Path,
    target: Path,
    ctx_data: dict,
) -> dict | None:
    """Resolve the asset set for this generation and persist intent + plan.

    Returns the plan dict, or None when resolution is unavailable (the
    generation proceeds — dual mode never blocks the MVP).
    """
    runtime = workspace / "runtime"
    if str(runtime) not in sys.path:
        sys.path.insert(0, str(runtime))

    try:
        from techlab_asset_registry.local_resolver import LocalAssetResolver
        from techlab_asset_registry.local_store import LocalYamlAssetStore
    except ImportError as exc:
        print(f"[assets] warning: asset registry unavailable ({exc}); skipping plan")
        return None

    root, mode = assets_root(workspace)
    if not root.is_dir():
        print(f"[assets] warning: no asset registry at {root}; skipping plan")
        return None

    store = LocalYamlAssetStore(root, workspace_root=workspace)
    resolver = LocalAssetResolver(store)

    project_id = ctx_data.get("projectId") or ctx_data.get("project_id") or target.name
    stack_cfg = ctx_data.get("stack") or {}
    stack: list[str] = []
    if stack_cfg.get("backend", {}).get("language"):
        stack.append(stack_cfg["backend"]["language"])
    if stack_cfg.get("backend", {}).get("framework"):
        stack.append(stack_cfg["backend"]["framework"])
    if stack_cfg.get("frontend", {}).get("framework"):
        stack.append(stack_cfg["frontend"]["framework"])

    # No phase filter: a generation wants every materializable asset matching
    # the project's stack; export policy (enforced by the Resolver) is the gate.
    intent = {
        "intent_id": f"intent_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}",
        "project_id": project_id,
        "required_tags": [],
        "stack": stack,
        "asset_ids": [],
        "metadata": {"generator": "new-project", "assets_mode": mode, "phase": "generation"},
    }

    response = asyncio.run(resolver.resolve({
        "request_id": f"req_{uuid.uuid4().hex[:8]}",
        "intent": intent,
    }))
    plan = response["plan"]

    violations = asyncio.run(resolver.validate_plan(plan))
    if violations:
        print(f"[assets] warning: plan has {len(violations)} violation(s): {violations[:3]}")

    techlab_dir = target / ".techlab"
    techlab_dir.mkdir(parents=True, exist_ok=True)
    (techlab_dir / "assembly-intent.json").write_text(
        json.dumps(intent, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (techlab_dir / "assembly-plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    n_sel = len(plan.get("selected_assets") or [])
    n_rej = len(plan.get("rejected_assets") or [])
    blocked = sum(
        1 for r in (plan.get("rejected_assets") or [])
        if "export_policy" in (r.get("reason_rejected") or "")
    )
    print(f"[assets] resolver[{mode}]: {n_sel} selected, {n_rej} rejected "
          f"({blocked} blocked by export policy) -> .techlab/assembly-plan.json")
    return plan
