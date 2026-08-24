#!/usr/bin/env python3
"""render.py — Generic Jinja2 template renderer for techlab-architecture.

Invoked by Claude Code commands (and `new-project.py`) to materialize a single
Jinja template with project context. Consolidates the rendering logic that
used to be duplicated across `new-project.py`, `sync-techlab-ai.py`, and
manual `render_jinja` calls.

Resolution order for templates (per D-027 HYBRID, updated by D-054 to the
3-layer structure):
    1. <project>/templates/                          (project overrides — runtime)
    2. <workspace>/templates/segments/<segment>/     (segment overlay, if --segment)
    3. <workspace>/templates/operational/            (3rd layer, most common)
    4. <workspace>/templates/sdd/                    (2nd layer, spec authoring)
    5. <workspace>/templates/architecture/           (1st layer, workspace-only)

Usage:
    # Render a single template
    python scripts/render.py --template service-spec/service-spec.md.j2 \\
                             --output docs/architecture/backend/services/obras-service/obras-service-spec.md \\
                             --vars '{"service_name":"obras-service","service_display_name":"Obras","module_prefix":"OBR"}'

    # Render with vars from a JSON file
    python scripts/render.py --template common/integrations/techlab-ai/build.gradle.kts.j2 \\
                             --output backend/services/techlab-ai-client-lib/build.gradle.kts \\
                             --vars-file extra-vars.json

    # Render with vars merged from project-context.json + overrides
    python scripts/render.py --template common/root/CLAUDE.md.j2 \\
                             --output CLAUDE.md \\
                             --from-context \\
                             --vars '{"some_override":"value"}'

    # List available templates
    python scripts/render.py list
    python scripts/render.py list --pattern 'common/integrations/**/*.j2'

    # Show variables required by a template (best-effort parse)
    python scripts/render.py inspect --template common/root/CLAUDE.md.j2

Workspace resolution: same as new-project.py:
    1. --workspace flag
    2. TECHLAB_ARCH_HOME env var
    3. walk up from cwd

Exit codes:
    0 — success
    1 — user error (template not found, invalid path)
    2 — render error (Jinja parse/runtime error)
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# D-512: templates live in techlab-framework-assets/templates/ (D-483 moved them out of this
# repo and DELETED the in-repo copy). Resolve through the central helper — never the deleted
# workspace/templates/. Aliased to avoid colliding with the local `templates_root` in cmd_list.
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_resolution import templates_root as _templates_root

# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_CONTEXT_FILE = "project-context.json"


def _load_arch_decisions(workspace: Path, vars: dict[str, Any],
                         decisions_dir: Path | None = None) -> dict[str, Any]:
    """Load every `*.arch.json` and return a dict keyed by aspect name, with
    `{{ var }}` placeholders interpolated against `vars` (D-058).

    `decisions_dir`: optional path override. Defaults to the workspace's
    `templates/architecture/decisions/`. When P2 has already pinned project
    overrides into `<target>/arch/decisions/`, pass that path so markdown
    rendering picks up overridden aspects rather than workspace defaults
    (D-074).

    Defers to `arch_decisions.py` (imported lazily to keep render.py importable
    when invoked outside the workspace).
    """
    if decisions_dir is None:
        decisions_dir = _templates_root(workspace) / "architecture" / "decisions"
    if not decisions_dir.exists():
        return {}
    # Lazy import to avoid a hard dependency for non-render callers.
    sys.path.insert(0, str(workspace / "scripts"))
    try:
        from arch_decisions import interpolate_payload, load_all_decisions  # type: ignore
    finally:
        try:
            sys.path.remove(str(workspace / "scripts"))
        except ValueError:
            pass
    # When the caller passes a custom decisions_dir, point load_all_decisions
    # at it by stashing $TECHLAB_DECISIONS_HOME for the duration of the call.
    if decisions_dir != _templates_root(workspace) / "architecture" / "decisions":
        import os
        prev = os.environ.get("TECHLAB_DECISIONS_HOME")
        os.environ["TECHLAB_DECISIONS_HOME"] = str(decisions_dir)
        try:
            raw = load_all_decisions(workspace=None)
        finally:
            if prev is None:
                os.environ.pop("TECHLAB_DECISIONS_HOME", None)
            else:
                os.environ["TECHLAB_DECISIONS_HOME"] = prev
    else:
        raw = load_all_decisions(workspace)
    return {aspect: interpolate_payload(payload, vars) for aspect, payload in raw.items()}


def apply_arch_decisions(workspace: Path, vars: dict[str, Any],
                          decisions_dir: Path | None = None) -> dict[str, Any]:
    """Public entry point: merge every architectural decision payload into
    `vars` under its aspect key (e.g. `vars['rbac']`, `vars['permission_catalogue']`).

    Aspect names with hyphens are normalized to underscores when used as Jinja
    var keys (so `permission-catalogue.arch.json` lands as `permission_catalogue`),
    keeping templates free of subscript-style access. Existing keys are not
    overwritten — callers stay in control.

    `decisions_dir`: optional path override (D-074) — P2 passes the project's
    pinned `<target>/arch/decisions/` here so override-applied aspects feed
    the markdown rendering instead of workspace defaults.

    Returns the same dict (mutated in place) for chaining. D-058 / D-060 / D-074.
    """
    decisions = _load_arch_decisions(workspace, vars, decisions_dir)
    for aspect, payload in decisions.items():
        key = aspect.replace("-", "_")
        vars.setdefault(key, payload)
    return vars


# ── Workspace + context resolution ────────────────────────────────────────────


def find_workspace_root(explicit: Path | None) -> Path:
    """Locate techlab-architecture workspace. Same logic as new-project.py."""
    if explicit:
        if not _looks_like_workspace(explicit):
            sys.exit(f"error: --workspace {explicit} does not look like a workspace")
        return explicit.resolve()
    env = os.environ.get("TECHLAB_ARCH_HOME")
    if env:
        p = Path(env)
        if not _looks_like_workspace(p):
            sys.exit(f"error: TECHLAB_ARCH_HOME={env} does not look like a workspace")
        return p.resolve()
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        if _looks_like_workspace(parent):
            return parent.resolve()
    sys.exit(
        "error: could not locate techlab-architecture workspace. "
        "Pass --workspace, set TECHLAB_ARCH_HOME, or run from inside the workspace."
    )


def _looks_like_workspace(p: Path) -> bool:
    return (p / "scripts" / "new-project.py").exists() and (p / "pyproject.toml").exists()


def find_project_root(explicit: Path | None) -> Path | None:
    """Find a project root (the dir containing project-context.json).

    Returns None when running outside a generated project (e.g. when rendering
    from the workspace itself for testing).
    """
    if explicit:
        if (explicit / DEFAULT_CONTEXT_FILE).exists():
            return explicit.resolve()
        return None
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        if (parent / DEFAULT_CONTEXT_FILE).exists():
            return parent.resolve()
    return None


def load_context_vars(project_root: Path | None) -> dict[str, Any]:
    """Build Jinja vars from project-context.json (if available).

    Mirrors `build_jinja_context` in new-project.py.
    """
    if not project_root:
        return {}
    ctx_file = project_root / DEFAULT_CONTEXT_FILE
    if not ctx_file.exists():
        return {}
    ctx = json.loads(ctx_file.read_text(encoding="utf-8"))

    modules = ctx.get("modules", {}).get("registry", [])
    multi = ctx.get("multiTenancy", {})
    ai = ctx.get("ai", {})
    fe = ctx.get("stack", {}).get("frontend", {})
    be = ctx.get("stack", {}).get("backend", {})
    msg = ctx.get("stack", {}).get("messaging", {})

    # D-076: term decoupled from mode. project-context.multiTenancy.term
    # and .termPlural override the term_map default — lets SaaS multi-tenant
    # projects use a domain-specific term (e.g. BOSQ Lean OS: mode=
    # multi-tenant + term=empresa).
    term_map = {
        "multi-empresa": ("empresa", "empresas"),
        "multi-tenant": ("tenant", "tenants"),
        "single": ("unit", "units"),
    }
    default_term, default_term_plural = term_map.get(
        multi.get("mode", "single"), ("tenant", "tenants"))
    mt_term = multi.get("term") or default_term
    mt_term_plural = multi.get("termPlural") or default_term_plural
    commit_scopes = ", ".join(m["prefix"].lower() for m in modules)
    has_iam_module = any(m["prefix"] == "IAM" for m in modules)

    vars: dict[str, Any] = {
        "project_name": ctx.get("project", {}).get("name", ""),
        "project_display_name": ctx.get("project", {}).get("displayName", ""),
        "project_description": ctx.get("project", {}).get("description", ""),
        "rigor_level": ctx.get("project", {}).get("rigorLevel", "medium"),
        "package_base": be.get("packageBase", ""),
        "java_version": be.get("version", "21"),
        "spring_boot_version": be.get("frameworkVersion", "3.5.0"),
        "frontend_npm_scope": fe.get("npmScope", ""),
        "frontend_app_name": f"{ctx.get('project', {}).get('name', 'project')}-web",
        "frontend_prototype_path": "prototipo",
        "has_frontend": fe.get("enabled", False),
        "has_msg_broker": msg.get("enabled", False),
        "msg_broker_name": (msg.get("broker") or "none").split("-")[-1],
        "has_ai": ai.get("hasAi", False),
        "modules": modules,
        "commit_scopes": commit_scopes,
        "multi_tenancy_mode": multi.get("mode", "single"),
        "multi_tenancy_term": mt_term,
        "multi_tenancy_term_plural": mt_term_plural,
        "tenant_global_schema": multi.get("globalSchema", ""),
        "tenant_schemas": multi.get("tenantSchemas", []),
        "tenant_schema_prefix": "emp_",
        "migrations_service_name": f"{ctx.get('project', {}).get('name', 'project')}-migrations",
        "has_legacy": False,
        "legacy_paths": [],
        "has_iam_module": has_iam_module,
        "stack": ctx.get("stack", {}),
        "issue_prefix": ctx.get("project", {}).get("issuePrefix", "PROJ"),
        "angular_version": fe.get("version", "21"),  # D-380: security baseline
        "nx_version": "22",  # D-380: security baseline
        "postgres_version": "15",
        "gradle_version": "8.10",
    }

    # TechLab AI vars
    if ai.get("hasAi"):
        tlab = ai.get("techlabAi", {})
        docker_cfg = tlab.get("dockerImage", {})
        sha = tlab.get("sourceSha", "PENDING_FIRST_COMMIT")
        if docker_cfg.get("tagFromSha") and sha and sha != "PENDING_FIRST_COMMIT":
            tag = sha[:7]
        else:
            tag = docker_cfg.get("tag") or "latest"
        docker_image_full = (
            f"{docker_cfg.get('registry', 'ghcr.io')}/"
            f"{docker_cfg.get('image', 'DaniloAmaral-Dev/techlab-ai')}:{tag}"
        )
        vars.update({
            "techlab_ai_source": tlab.get("source", ""),
            "techlab_ai_sha": sha,
            "techlab_ai_docs_target": tlab.get("docsCloneTarget", "integrations/techlab-ai"),
            "techlab_ai_docker_image": docker_image_full,
            "techlab_ai_service_port": tlab.get("ports", {}).get("service", 8090),
            "techlab_ai_postgres_port": tlab.get("ports", {}).get("postgres", 5434),
            "techlab_ai_redis_port": tlab.get("ports", {}).get("redis", 6380),
            "techlab_ai_bounded_contexts": tlab.get("boundedContexts", []),
            "techlab_ai_endpoints_grouped": tlab.get("endpoints", {}),
            "techlab_ai_package_name": tlab.get("packageName", "techlab_ai"),
            "techlab_ai_env_prefix": tlab.get("envPrefix", "TECHLAB_AI_"),
            "techlab_ai_issue_prefix": tlab.get("issuePrefix", "TLAB"),
        })

    return vars


# ── Template resolution ──────────────────────────────────────────────────────


LAYERS = ("operational", "sdd", "architecture")


def resolve_template_path(template_rel: str,
                          workspace: Path,
                          project_root: Path | None,
                          segment: str | None) -> Path:
    """Find the template file using HYBRID resolution (D-027, refined by D-054).

    Order:
        1. <project>/templates/<rel>                              (runtime override)
        2. <workspace>/templates/segments/<segment>/<rel>         (segment overlay)
        3. <workspace>/templates/operational/<rel>                (Layer 3)
        4. <workspace>/templates/sdd/<rel>                        (Layer 2)
        5. <workspace>/templates/architecture/<rel>               (Layer 1)
        6. <workspace>/templates/<rel>                            (legacy/fallback)

    Callers may pass `rel` either implicitly (e.g. `"code/java/foo.java.j2"`,
    resolved against each layer in turn) or explicitly prefixed (e.g.
    `"operational/code/java/foo.java.j2"`); both work.
    """
    rel = template_rel.lstrip("/")
    candidates: list[Path] = []

    # If rel already starts with a known layer prefix, look there first
    layer_prefixes = (*LAYERS, "segments")
    if rel.startswith(tuple(f"{p}/" for p in layer_prefixes)):
        candidates.append(_templates_root(workspace) / rel)

    if project_root:
        candidates.append(project_root / "templates" / rel)
    if segment:
        candidates.append(_templates_root(workspace) / "segments" / segment / rel)
    for layer in LAYERS:
        candidates.append(_templates_root(workspace) / layer / rel)
    candidates.append(_templates_root(workspace) / rel)

    for c in candidates:
        if c.exists():
            return c.resolve()

    sys.exit(
        "error: template not found.\nSearched:\n  - "
        + "\n  - ".join(str(c) for c in candidates)
    )


# ── Rendering ────────────────────────────────────────────────────────────────


class RenderError(RuntimeError):
    """Raised when a Jinja template fails to render. Callers using render.py as
    a library can catch this; the CLI entry point converts it to exit code 2."""


def build_jinja_env(template_path: Path):
    """Construct a Jinja2 Environment with filters and base loader.

    Raises RuntimeError if Jinja2 is not installed (so library callers can
    catch instead of having sys.exit fire under their feet).
    """
    try:
        from jinja2 import Environment, FileSystemLoader
    except ImportError as e:
        raise RuntimeError("jinja2 not installed. Run: pip install jinja2") from e

    env = Environment(
        loader=FileSystemLoader(template_path.parent),
        trim_blocks=False,
        lstrip_blocks=False,
        keep_trailing_newline=True,
    )

    # Filters used across the catalog
    env.filters["snake"] = lambda s: s.lower().replace("-", "_")
    env.filters["kebab"] = lambda s: s.lower().replace("_", "-").replace(" ", "-")
    env.filters["pascal"] = lambda s: "".join(
        w.capitalize() for w in s.replace("-", " ").replace("_", " ").split()
    )
    env.filters["upper_pfx"] = lambda s: s.upper()

    return env


def collapse_whitespace(text: str) -> str:
    """Post-processing: collapse blank lines inside tables, max 2 consecutive newlines.

    Canonical implementation — new-project.py and be_context_helper.py both
    delegate here via render_template().
    """
    lines = text.split("\n")
    out: list[str] = []
    in_code = False
    for i, line in enumerate(lines):
        if line.strip().startswith("```"):
            in_code = not in_code
            out.append(line)
            continue
        if in_code:
            if line.strip() == "" and out and out[-1].strip() == "":
                continue
            if line.strip() == "":
                nxt = lines[i + 1] if i + 1 < len(lines) else ""
                prv = out[-1] if out else ""
                if (prv.startswith(("    ", "  "))) and (nxt.startswith(("    ", "  "))):
                    continue
            out.append(line)
            continue
        if line.strip() == "":
            prv = out[-1] if out else ""
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if prv.startswith("|") and nxt.startswith("|"):
                continue
            if prv.startswith("- ") and nxt.startswith("- "):
                continue
        out.append(line)
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.rstrip() + "\n"


def render_template(template_path: Path, vars: dict[str, Any], postprocess: bool = True) -> str:
    """Render a Jinja template with given vars.

    Args:
        template_path: absolute path to the template file
        vars: dict of variables passed to template.render()
        postprocess: when True (default), apply collapse_whitespace to the
            output. Set to False when rendering source code (Java, SQL, YAML)
            where stripping blank lines between table-like patterns is unsafe
            or unwanted. Documentation-style templates should keep True.

    Raises:
        RenderError if Jinja parse/runtime fails.
        RuntimeError if jinja2 is not installed.
    """
    env = build_jinja_env(template_path)
    try:
        template = env.get_template(template_path.name)
        rendered = template.render(**vars)
    except Exception as e:
        raise RenderError(f"render failed for {template_path}: {e}") from e
    return collapse_whitespace(rendered) if postprocess else rendered


def merge_vars(*sources: dict[str, Any]) -> dict[str, Any]:
    """Merge multiple var dicts; later sources override earlier ones."""
    merged: dict[str, Any] = {}
    for src in sources:
        if src:
            merged.update(src)
    return merged


# ── Commands ─────────────────────────────────────────────────────────────────


def cmd_render(args: argparse.Namespace) -> int:
    """Render a single template (default subcommand)."""
    workspace = find_workspace_root(args.workspace)
    project_root = find_project_root(args.project_root) if not args.no_context else None

    template_path = resolve_template_path(
        args.template, workspace, project_root, args.segment
    )

    # Build var sources
    context_vars: dict[str, Any] = {}
    if args.from_context or (project_root and not args.no_context):
        context_vars = load_context_vars(project_root)

    file_vars: dict[str, Any] = {}
    if args.vars_file:
        file_vars = json.loads(args.vars_file.read_text(encoding="utf-8"))

    inline_vars: dict[str, Any] = {}
    if args.vars:
        inline_vars = json.loads(args.vars)

    merged = merge_vars(context_vars, file_vars, inline_vars)

    # Auto-load architectural decisions (D-058) so templates can reference
    # `{{ rbac }}`, `{{ multi_tenancy }}`, etc. without each caller wiring it.
    apply_arch_decisions(workspace, merged)

    if args.print_vars:
        print(json.dumps(merged, indent=2, default=str))
        return 0

    try:
        rendered = render_template(template_path, merged)
    except RenderError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except RuntimeError as e:
        # jinja2 not installed, etc.
        print(f"error: {e}", file=sys.stderr)
        return 1

    if args.output:
        out_path = Path(args.output).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(rendered, encoding="utf-8")
        if not args.quiet:
            print(f"OK: rendered {template_path.name} -> {out_path}")
    else:
        sys.stdout.write(rendered)
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    """List available templates matching an optional glob pattern."""
    workspace = find_workspace_root(args.workspace)
    templates_root = _templates_root(workspace)

    pattern = args.pattern or "**/*.j2"
    matches = []
    for p in templates_root.rglob("*.j2"):
        rel = str(p.relative_to(templates_root))
        if fnmatch.fnmatch(rel, pattern):
            matches.append(rel)

    for rel in sorted(matches):
        print(rel)
    if not matches:
        print(f"(no templates match {pattern!r})", file=sys.stderr)
    return 0


def cmd_inspect(args: argparse.Namespace) -> int:
    """Best-effort scan of a template to report required variables."""
    workspace = find_workspace_root(args.workspace)
    template_path = resolve_template_path(args.template, workspace, None, args.segment)
    content = template_path.read_text(encoding="utf-8")

    # Extract header comment block {#- ... -#} (declares variables)
    header_match = re.search(r"\{#-(.*?)-#\}", content, re.DOTALL)
    if header_match:
        print("=== Header documentation ===")
        print(header_match.group(1).strip())
        print()

    # Best-effort: scrape all `{{ var }}` references and `{% if/for var %}`
    var_refs = set()
    for m in re.finditer(r"\{\{\s*(\w+)", content):
        var_refs.add(m.group(1))
    for m in re.finditer(r"\{%\s*(?:if|for\s+\w+\s+in)\s+(\w+)", content):
        var_refs.add(m.group(1))

    print(f"=== Variables referenced ({len(var_refs)}) ===")
    for v in sorted(var_refs):
        print(f"  - {v}")
    return 0


# ── validate-output (D-364) ───────────────────────────────────────────────────
#
# Guards the "templates are filled, not authored freehand" invariant. R2 already
# guarantees a clean RENDER; this guarantees a clean FILL: every required Output
# Schema section is present + non-empty, and no `TODO[agent]` slot was left
# behind. Required sections come from --require, or an embedded OUTPUT-SCHEMA
# block in the artifact:
#
#   <!-- OUTPUT-SCHEMA
#   - Section One
#   - Section Two
#   -->


def _required_sections(text: str, explicit: str | None) -> list[str]:
    """Required section headings: explicit --require wins, else embedded block."""
    if explicit:
        return [s.strip() for s in explicit.split(",") if s.strip()]
    import re
    m = re.search(r"<!--\s*OUTPUT-SCHEMA\s*(.*?)-->", text, re.DOTALL | re.IGNORECASE)
    if not m:
        return []
    return [
        line.strip()[2:].strip()
        for line in m.group(1).splitlines()
        if line.strip().startswith("- ")
    ]


def _section_body(text: str, heading: str) -> str | None:
    """Body of the markdown section whose heading text == `heading`, or None if
    the heading is absent. Body runs until the next heading of any level."""
    import re
    lines = text.splitlines()
    pat = re.compile(r"^#{1,6}\s+(.*?)\s*$")
    start = None
    for i, line in enumerate(lines):
        hm = pat.match(line)
        if hm and hm.group(1).strip().lower() == heading.strip().lower():
            start = i + 1
            break
    if start is None:
        return None
    body: list[str] = []
    for line in lines[start:]:
        if pat.match(line):
            break
        body.append(line)
    return "\n".join(body)


def cmd_validate_output(args: argparse.Namespace) -> int:
    artifact = Path(args.artifact)
    if not artifact.is_file():
        print(f"error: artifact not found: {artifact}", file=sys.stderr)
        return 1
    text = artifact.read_text(encoding="utf-8")
    markers = args.marker or ["TODO[agent]"]

    problems: list[str] = []

    # 1) no orphan fill markers remain
    for marker in markers:
        if marker in text:
            n = text.count(marker)
            problems.append(f"{n} unfilled marker(s) '{marker}' remain")

    # 2) every required section present + non-empty
    required = _required_sections(text, args.require)
    for section in required:
        body = _section_body(text, section)
        if body is None:
            problems.append(f"required section missing: '{section}'")
        elif not _strip_markers(body, markers).strip():
            # empty, or contained only fill markers (already flagged above)
            problems.append(f"required section empty: '{section}'")

    if problems:
        for p in problems:
            print(f"error: {p}", file=sys.stderr)
        print(f"error: validate-output FAILED for {artifact.name} ({len(problems)} issue(s))", file=sys.stderr)
        return 2
    detail = f"{len(required)} section(s)" if required else "marker check only"
    print(f"OK: {artifact.name} is fully filled ({detail}, no orphan markers)")
    return 0


def _strip_markers(body: str, markers: list[str]) -> str:
    out = body
    for m in markers:
        out = out.replace(m, "")
    return out


# ── CLI ──────────────────────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="render.py",
        description="Generic Jinja2 template renderer for techlab-architecture",
    )
    parser.add_argument("--workspace", type=Path, default=None,
                        help="Path to techlab-architecture workspace (default: $TECHLAB_ARCH_HOME or walk up)")

    sub = parser.add_subparsers(dest="command")

    p_r = sub.add_parser("render", help="Render a template (default subcommand)")
    p_r.add_argument("--template", required=True,
                     help="Template path (relative; supports common/, segments/<seg>/)")
    p_r.add_argument("--output", "-o", default=None,
                     help="Output file path (default: stdout)")
    p_r.add_argument("--vars", default=None,
                     help="Inline JSON dict of variables")
    p_r.add_argument("--vars-file", type=Path, default=None,
                     help="JSON file with variables")
    p_r.add_argument("--from-context", action="store_true",
                     help="Load variables from project-context.json (also default when --no-context not given)")
    p_r.add_argument("--no-context", action="store_true",
                     help="Don't load project-context.json (useful for workspace-only renders)")
    p_r.add_argument("--segment", default=None,
                     help="Segment overlay to use (e.g. civil-construction)")
    p_r.add_argument("--project-root", type=Path, default=None,
                     help="Project root (default: walk up to find project-context.json)")
    p_r.add_argument("--print-vars", action="store_true",
                     help="Print the merged variables dict and exit (no render)")
    p_r.add_argument("--quiet", "-q", action="store_true",
                     help="Suppress 'OK: ...' message")
    p_r.set_defaults(func=cmd_render)

    p_l = sub.add_parser("list", help="List available templates")
    p_l.add_argument("--pattern", default=None,
                     help="Glob pattern (default: **/*.j2)")
    p_l.set_defaults(func=cmd_list)

    p_i = sub.add_parser("inspect", help="Show variables required by a template")
    p_i.add_argument("--template", required=True)
    p_i.add_argument("--segment", default=None)
    p_i.set_defaults(func=cmd_inspect)

    p_v = sub.add_parser("validate-output",
                         help="Check a filled artifact: required sections non-empty, no orphan TODO[agent] (D-364)")
    p_v.add_argument("--artifact", required=True, help="Path to the filled artifact to validate")
    p_v.add_argument("--require", default=None,
                     help="Comma-separated required section headings (else read embedded OUTPUT-SCHEMA)")
    p_v.add_argument("--marker", action="append", default=None,
                     help="Fill marker to flag if left behind (repeatable; default: TODO[agent])")
    p_v.set_defaults(func=cmd_validate_output)

    return parser


def _separate_top_flags(argv_list: list[str]) -> tuple[list[str], list[str]]:
    """Split argv into top-level flags (consumed before subcommand) and rest.

    Recognizes `--workspace VAL` and `--workspace=VAL` before the subcommand.
    """
    top: list[str] = []
    rest: list[str] = []
    i = 0
    known_subs = {"render", "list", "inspect", "validate-output"}
    found_sub = False
    while i < len(argv_list):
        arg = argv_list[i]
        if not found_sub and arg in known_subs:
            found_sub = True
            rest.append(arg)
            i += 1
        elif not found_sub and arg == "--workspace":
            top.extend([arg, argv_list[i + 1] if i + 1 < len(argv_list) else ""])
            i += 2
        elif not found_sub and arg.startswith("--workspace="):
            top.append(arg)
            i += 1
        else:
            rest.append(arg)
            i += 1
    return top, rest


def main(argv: list[str] | None = None) -> int:
    from cli_utils import force_utf8_stdio
    force_utf8_stdio()
    parser = build_parser()
    argv_list = list(argv) if argv is not None else sys.argv[1:]
    if not argv_list:
        parser.print_help()
        return 1

    # Separate top-level --workspace from subcommand args
    top_args, rest = _separate_top_flags(argv_list)

    # If first non-top arg isn't a known subcommand, default to "render"
    known_subs = {"render", "list", "inspect", "validate-output"}
    if rest and rest[0] not in known_subs:
        rest = ["render", *rest]
    elif not rest:
        # only top-level flags given; default to help
        parser.parse_args([*top_args, "--help"])
        return 1

    # Re-assemble: top-level flags first, then subcommand and its args
    args = parser.parse_args(top_args + rest)
    if not args.command:
        parser.print_help()
        return 1
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
