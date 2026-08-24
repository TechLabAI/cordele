"""be_context_helper.py — Shared project context loader for generator scripts.

Used by be-module-generator.py, be-entity-generator.py, be-migration-generator.py,
be-bdd-generator.py, be-infra-generator.py, be-scaffold.py, and be-file-guard.py
to load project-context.json with sensible defaults and provide derived values.

Usage:
    from be_context_helper import load_project_context, ProjectContext

    ctx = load_project_context()
    print(ctx.project_name)         # "bosq"
    print(ctx.package_base)         # "com.bosq"
    print(ctx.migrations_service)   # "bosq-migrations"
    print(ctx.global_schema)        # "bosq_global" (or whatever ctx says)
"""
from __future__ import annotations

import json
import os
import re

# D-512: templates were moved to techlab-framework-assets/ (D-483) — resolve through the
# central helper, never the deleted workspace/templates/.
import sys as _sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

if str(Path(__file__).resolve().parent) not in _sys.path:
    _sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_resolution import templates_root as _templates_root

CONTEXT_FILENAME = "project-context.json"


@dataclass
class ProjectContext:
    """Structured access to project-context.json fields used by generators.

    All fields have sensible defaults so generators don't crash on partial
    contexts. The raw dict is also available as `.raw` for cases not covered
    by named fields.
    """
    project_name: str = "project"
    project_display_name: str = "Project"
    project_description: str = ""
    package_base: str = "com.project"
    java_version: int = 21
    spring_boot_version: str = "3.5.0"
    # Gradle plugin that supplies the Spring BOM. Pinned separately from Spring
    # Boot itself because the two version lines move independently.
    spring_dependency_management_version: str = "1.1.7"
    has_msg_broker: bool = False
    msg_broker_name: str = "none"
    events_broker: str = "artemis"
    has_frontend: bool = False
    frontend_npm_scope: str = "@project"
    frontend_app_name: str = "project-web"
    has_ai: bool = False
    multi_tenancy_mode: str = "single"
    multi_tenancy_term: str = "tenant"
    multi_tenancy_term_plural: str = "tenants"
    global_schema: str = ""
    tenant_schemas: list[dict[str, Any]] = field(default_factory=list)
    modules: list[dict[str, Any]] = field(default_factory=list)
    rigor_level: str = "medium"
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def migrations_service(self) -> str:
        return f"{self.project_name}-migrations"

    @property
    def gateway_service(self) -> str:
        return f"{self.project_name}-api-gateway"

    @property
    def registry_service(self) -> str:
        return f"{self.project_name}-service-registry"

    @property
    def env_var_prefix(self) -> str:
        """Prefix for environment variables (e.g. 'BOSQ_' for BOSQ project)."""
        return f"{self.project_name.upper()}_"

    @property
    def dev_database(self) -> str:
        return f"{self.project_name}_dev"

    @property
    def test_database(self) -> str:
        return f"{self.project_name}_test"

    @property
    def issue_prefix(self) -> str:
        """Issue ID prefix (e.g. 'BOSQ' for BOSQ project)."""
        # Allow override via context, otherwise upper(project_name)
        custom = self.raw.get("project", {}).get("issuePrefix")
        return custom or self.project_name.upper()

    def module_for_prefix(self, prefix: str) -> dict[str, Any] | None:
        """Find module dict by prefix (e.g. 'OBR'). Returns None if not declared."""
        for m in self.modules:
            if m.get("prefix") == prefix:
                return m
        return None

    def jms_topic(self, module_prefix: str, entity: str, event: str) -> str:
        """Build canonical JMS topic name: <project>.<mod>.<entity>.<event>."""
        return f"{self.project_name}.{module_prefix.lower()}.{entity}.{event}"


def find_project_root(start: Path | None = None) -> Path | None:
    """Walk up from start (or cwd) looking for project-context.json."""
    cur = (start or Path.cwd()).resolve()
    for p in [cur, *cur.parents]:
        if (p / CONTEXT_FILENAME).is_file():
            return p
    return None


def _java_version(backend: dict[str, Any]) -> int:
    """Java toolchain version, tolerant of a non-Java backend (D-576).

    `stack.backend.version` is the version of whatever language the backend is:
    "21" for Java, but "3.12" for Python. `int("3.12")` raised ValueError, and
    every caller that wraps this loader in `except Exception` -- the infra and
    module generators do -- turned that into a context of placeholder
    identifiers (`project`, `com.project`) with no error shown. Silent
    degradation on every Python project.
    """
    if (backend.get("language") or "java") != "java":
        return 21                       # not a Java project; the field is not ours
    raw = str(backend.get("version", 21))
    match = re.match(r"\d+", raw)
    return int(match.group()) if match else 21


def load_project_context(path: Path | None = None) -> ProjectContext:
    """Load project context, applying defaults for missing fields.

    Resolution order:
      1. Explicit `path` arg
      2. PROJECT_CONTEXT env var
      3. Walk up from cwd looking for project-context.json
      4. Fallback to defaults (warns on stderr)

    Returns:
      ProjectContext with all fields populated.
    """
    ctx_path: Path | None = None
    if path:
        ctx_path = path
    elif env := os.environ.get("PROJECT_CONTEXT"):
        ctx_path = Path(env)
    else:
        root = find_project_root()
        if root:
            ctx_path = root / CONTEXT_FILENAME

    if not ctx_path or not ctx_path.is_file():
        import sys
        try:
            from cli_utils import force_utf8_stdio
            force_utf8_stdio()
        except ImportError:
            pass
        print(
            "warning: project-context.json not found (searched cwd + parents). "
            "Using defaults — generated code WILL have placeholder identifiers.",
            file=sys.stderr,
        )
        return ProjectContext()

    raw = json.loads(ctx_path.read_text(encoding="utf-8"))

    project = raw.get("project", {})
    stack = raw.get("stack", {})
    backend = stack.get("backend", {})
    frontend = stack.get("frontend", {})
    msg = stack.get("messaging", {})
    multi = raw.get("multiTenancy", {})
    ai = raw.get("ai", {})

    term_map = {
        "multi-empresa": ("empresa", "empresas"),
        "multi-tenant": ("tenant", "tenants"),
        "single": ("unit", "units"),
    }
    mt_term, mt_term_plural = term_map.get(
        multi.get("mode", "single"), ("tenant", "tenants")
    )

    # D-304: derive events_broker from elastic ingest profile (mirrors new-project.py).
    # Kafka is the single bus when elastic is enabled + logstash + kafka ingest broker.
    elastic = stack.get("elastic", {})
    _events_broker = "artemis"
    if (elastic.get("enabled") and elastic.get("logstashEnabled")
            and elastic.get("ingestBroker", "activemq") == "kafka"):
        _events_broker = "kafka"

    return ProjectContext(
        project_name=project.get("name", "project"),
        project_display_name=project.get("displayName", "Project"),
        project_description=project.get("description", ""),
        package_base=backend.get("packageBase", "com.project"),
        java_version=_java_version(backend),
        spring_boot_version=backend.get("frameworkVersion", "3.5.0"),
        spring_dependency_management_version=backend.get(
            "dependencyManagementVersion", "1.1.7"),
        has_msg_broker=bool(msg.get("enabled", False)),
        msg_broker_name=(msg.get("broker") or "none").split("-")[-1],
        events_broker=_events_broker,
        has_frontend=bool(frontend.get("enabled", False)),
        frontend_npm_scope=frontend.get("npmScope", "@project"),
        frontend_app_name=f"{project.get('name', 'project')}-web",
        has_ai=bool(ai.get("hasAi", False)),
        multi_tenancy_mode=multi.get("mode", "single"),
        multi_tenancy_term=mt_term,
        multi_tenancy_term_plural=mt_term_plural,
        global_schema=multi.get("globalSchema", f"{project.get('name', 'project')}_global"),
        tenant_schemas=multi.get("tenantSchemas", []),
        modules=raw.get("modules", {}).get("registry", []),
        rigor_level=project.get("rigorLevel", "medium"),
        raw=raw,
    )


# ── Code template rendering ───────────────────────────────────────────────────


def find_workspace_root(start: Path | None = None) -> Path | None:
    """Walk up from start (or cwd) looking for either:
      (a) the techlab-architecture workspace (has scripts/new-project.py + templates/operational/), OR
      (b) a generated project with code templates locally (has templates/operational/code/ + project-context.json)

    Case (b) is the common runtime: scripts inside a generated project resolve
    templates from the project's own templates/ directory (which was copied
    during P4 backend-skeleton). Case (a) is only used during workspace dev.

    Also accepts TECHLAB_ARCH_HOME env var (takes precedence).

    Layer structure (D-054): templates/operational/ replaces the former
    templates/common/ as the layer that travels with the client project.

    D-483 fix: the workspace predicate used to require `templates/operational/`
    to exist INSIDE the workspace. That directory was deleted when templates
    moved to techlab-framework-assets, so the predicate silently stopped
    matching and this function returned None for every caller. The workspace is
    now identified by `scripts/new-project.py` alone; whether its templates
    resolve is a separate concern owned by asset_resolution.templates_root().
    Case (b) is unchanged -- a generated project really does carry its own
    templates/operational/code/.
    """
    def _is_workspace(p: Path) -> bool:
        return (p / "scripts" / "new-project.py").is_file()

    def _is_generated_project(p: Path) -> bool:
        return ((p / "templates" / "operational" / "code").is_dir()
                and (p / "project-context.json").is_file())

    env = os.environ.get("TECHLAB_ARCH_HOME")
    if env:
        p = Path(env)
        if _is_workspace(p):
            return p.resolve()

    cur = (start or Path.cwd()).resolve()
    for p in [cur, *cur.parents]:
        # Case (a): the workspace itself
        if _is_workspace(p):
            return p.resolve()
        # Case (b): generated project with code templates copied locally
        if _is_generated_project(p):
            return p.resolve()
    return None


def render_code_template(template_rel: str,
                         vars: dict[str, Any],
                         workspace: Path | None = None,
                         context: ProjectContext | None = None) -> str:
    """Render a Jinja2 template from templates/operational/ and return the output string.

    Auto-injects common project context variables (project_name, package_base,
    multi_tenancy_term, etc.) so templates can reference them without explicit
    passing. Explicit `vars` override auto-injected ones.

    Args:
        template_rel: path relative to templates/operational/ (e.g. "code/java/foo.java.j2")
        vars: dict of explicit variables (override auto-injected)
        workspace: optional workspace path; auto-detected if None
        context: optional ProjectContext; loaded fresh if None

    Returns:
        Rendered template text.

    Raises:
        FileNotFoundError if template not found
        RuntimeError if Jinja2 not installed
    """
    if workspace is None:
        workspace = find_workspace_root()
    if workspace is None:
        raise RuntimeError(
            "Could not locate techlab-architecture workspace. "
            "Set TECHLAB_ARCH_HOME or run from within the workspace."
        )

    template_path = _templates_root(workspace) / "operational" / template_rel
    if not template_path.is_file():
        raise FileNotFoundError(f"Template not found: {template_path}")

    # Build merged vars: auto-inject context vars, then explicit overrides
    if context is None:
        context = load_project_context()
    auto_vars = {
        "project_name": context.project_name,
        "project_display_name": context.project_display_name,
        "package_base": context.package_base,
        "java_version": context.java_version,
        "spring_boot_version": context.spring_boot_version,
        "spring_dependency_management_version":
            context.spring_dependency_management_version,
        "migrations_service": context.migrations_service,
        "gateway_service": context.gateway_service,
        "registry_service": context.registry_service,
        "global_schema": context.global_schema,
        "multi_tenancy_mode": context.multi_tenancy_mode,
        "multi_tenancy_term": context.multi_tenancy_term,
        "has_msg_broker": context.has_msg_broker,
        "msg_broker_name": context.msg_broker_name,
        "events_broker": context.events_broker,
        "modules": context.modules,
        "issue_prefix": context.issue_prefix,
    }
    merged = {**auto_vars, **vars}

    # Delegate Jinja rendering to scripts/render.py (Lote 6c.3 — single source
    # of truth). postprocess=False because this function generates code (Java,
    # SQL, YAML, gradle), not documentation — collapse_whitespace's table/list
    # rules don't apply and could subtly alter source layout.
    from render import render_template
    return render_template(template_path, merged, postprocess=False)
