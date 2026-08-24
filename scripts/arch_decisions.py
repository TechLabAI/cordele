#!/usr/bin/env python3
"""arch_decisions.py — Loader and light validator for architectural decisions.

Reads JSON decision files under `templates/architecture/decisions/*.arch.json`
(D-058, Tier 2.1 Phase 1 of the evolution plan). Returns the parsed payload
to callers (`render.py` for rendering markdown derived from decisions; future
`be-module-generator.py` integration for code derivation).

Format choice: JSON (not YAML). Reasons recorded in D-058:
  - Consistency with existing JSON I/O in the workspace
    (`project-context.json`, `architecture.lock`).
  - Stdlib-only (no pyyaml dependency).
  - Schemas authored as JSON Schema draft-07 in
    `templates/architecture/decisions/_schema/*.schema.json` (informational —
    not enforced at runtime; we run a light structural validator instead).

Usage (library):
    from arch_decisions import load_decision, load_all_decisions
    rbac = load_decision("rbac")                       # dict
    decisions = load_all_decisions()                   # {"rbac": dict, ...}

Usage (CLI):
    python scripts/arch_decisions.py list
    python scripts/arch_decisions.py show --aspect rbac
    python scripts/arch_decisions.py validate
    python scripts/arch_decisions.py validate --aspect rbac

Exit codes:
    0  success / valid
    1  user error (file missing, bad path)
    2  validation failure (one or more issues reported on stderr)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# D-512: the decisions tree moved with templates/ to techlab-framework-assets (D-483).
# Resolve through the central helper so the deleted in-repo templates/ no longer breaks lookup.
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_resolution import templates_root

DECISIONS_SUBDIR = ("templates", "architecture", "decisions")
ASPECT_SUFFIX = ".arch.json"


# ── Workspace resolution (mirrors render.py) ──────────────────────────────────


def _looks_like_workspace(p: Path) -> bool:
    return (p / "scripts" / "new-project.py").exists() and (p / "pyproject.toml").exists()


def find_workspace_root(explicit: Path | None = None) -> Path:
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
    sys.exit("error: could not locate techlab-architecture workspace.")


def decisions_dir(workspace: Path | None = None) -> Path:
    ws = workspace or find_workspace_root()
    return templates_root(ws) / "architecture" / "decisions"


def find_decisions_dir(explicit: Path | None = None) -> Path | None:
    """Locate the decisions directory without requiring a full workspace match.

    Resolution order:
      1. `explicit` argument (when caller passes one)
      2. `$TECHLAB_DECISIONS_HOME` env var (direct path to the dir)
      3. `$TECHLAB_ARCH_HOME/templates/architecture/decisions`
      4. Walk up from cwd looking for `templates/architecture/decisions/`
         (workspace mode)
      5. Walk up from cwd looking for `arch/decisions/`
         (generated-project pinned-snapshot location; D-059 future-proofing)

    Returns the first existing directory, or None when not found. Callers in
    generated projects can fall back gracefully when no decisions are pinned.
    """
    if explicit and explicit.is_dir():
        return explicit.resolve()
    env_decisions = os.environ.get("TECHLAB_DECISIONS_HOME")
    if env_decisions and Path(env_decisions).is_dir():
        return Path(env_decisions).resolve()
    env_arch = os.environ.get("TECHLAB_ARCH_HOME")
    if env_arch:
        candidate = templates_root(Path(env_arch)) / "architecture" / "decisions"
        if candidate.is_dir():
            return candidate.resolve()
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        # D-530: check project-local arch/decisions BEFORE templates_root so a
        # generated project's own permission-catalogue always takes priority over
        # the framework-assets template catalogue (which has empty permissions).
        candidate = parent / "arch" / "decisions"
        if candidate.is_dir():
            return candidate.resolve()
        candidate = templates_root(parent) / "architecture" / "decisions"
        if candidate.is_dir():
            return candidate.resolve()
    return None


# ── Public loader API ────────────────────────────────────────────────────────


def load_decision(aspect: str, workspace: Path | None = None) -> dict[str, Any]:
    """Load and parse a single decision file by aspect name (e.g. 'rbac').

    Resolution: prefer `workspace`, else fall back to `find_decisions_dir()`
    (which supports project-pinned snapshots in addition to workspace lookup).
    Raises FileNotFoundError if missing, ValueError on JSON parse errors.
    """
    if workspace:
        base = decisions_dir(workspace)
    else:
        base = find_decisions_dir()
        if base is None:
            raise FileNotFoundError(
                f"could not locate any decisions/ dir for aspect '{aspect}'. "
                f"Tried $TECHLAB_DECISIONS_HOME, $TECHLAB_ARCH_HOME, and walked "
                f"up from cwd."
            )
    path = base / f"{aspect}{ASPECT_SUFFIX}"
    if not path.exists():
        raise FileNotFoundError(f"decision aspect '{aspect}' not found at {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"{path}: invalid JSON: {e}") from e


def list_aspects(workspace: Path | None = None) -> list[str]:
    """Return sorted list of aspect names available in the decisions dir.

    Resolution mirrors `load_decision`: workspace argument first, then
    `find_decisions_dir()` fallback. Empty list when no dir found.
    """
    d = decisions_dir(workspace) if workspace else find_decisions_dir()
    if not d or not d.exists():
        return []
    return sorted(
        p.name[: -len(ASPECT_SUFFIX)]
        for p in d.glob(f"*{ASPECT_SUFFIX}")
        if p.is_file()
    )


def load_all_decisions(workspace: Path | None = None) -> dict[str, dict[str, Any]]:
    """Load every *.arch.json under decisions/ keyed by aspect name."""
    return {a: load_decision(a, workspace) for a in list_aspects(workspace)}


# ── Light structural validators ──────────────────────────────────────────────


_SEMVER_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
_ROLE_CODE_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")


def _is_templated(value: Any) -> bool:
    """True when ``value`` is an unrendered Jinja placeholder (``{{ ... }}``).

    Workspace source aspects (e.g. ``events.arch.json`` with
    ``broker: "{{ events_broker | default('artemis') }}"``, D-304) are templates —
    they are rendered at /new-project time, then validated in the project. Enum
    checks must therefore tolerate templated values when validating the source.
    """
    return isinstance(value, str) and "{{" in value and "}}" in value
_VALID_ENFORCEMENT_DEFAULTS = {"pre_authorize", "post_authorize", "manual"}
_VALID_ENFORCEMENT_FALLBACKS = {"none", "deny", "allow"}
_VALID_AUDIT_ACTIONS = {"CREATE", "READ", "UPDATE", "DELETE"}
_VALID_ROLE_CATEGORIES = {"default", "optional"}
_VALID_BUNDLE_KINDS = {"all", "exclude_patterns", "match_pattern", "list"}
_VALID_VALUE_KINDS = {"uuid", "csv-uuid", "string", "none"}


def _err(issues: list[str], path: str, msg: str) -> None:
    issues.append(f"{path}: {msg}")


def validate_rbac(payload: dict[str, Any]) -> list[str]:
    """Structural validation for the RBAC decision payload.

    Returns a list of human-readable issues. Empty list means valid.
    Intentionally light: matches the shape declared in rbac.schema.json
    without depending on jsonschema.
    """
    issues: list[str] = []

    # _schema_version
    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")

    # version
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    # last_changed (optional but if present must look like a date)
    lc = payload.get("last_changed")
    if lc is not None and not (isinstance(lc, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", lc)):
        _err(issues, "last_changed", f"not a YYYY-MM-DD date: {lc!r}")

    # enforcement (optional)
    enf = payload.get("enforcement")
    if enf is not None:
        if not isinstance(enf, dict):
            _err(issues, "enforcement", "must be an object")
        else:
            d = enf.get("default")
            if d is not None and d not in _VALID_ENFORCEMENT_DEFAULTS:
                _err(issues, "enforcement.default", f"invalid: {d!r}")
            fb = enf.get("fallback")
            if fb is not None and fb not in _VALID_ENFORCEMENT_FALLBACKS:
                _err(issues, "enforcement.fallback", f"invalid: {fb!r}")
            ar = enf.get("audit_required")
            if ar is not None:
                if not isinstance(ar, list):
                    _err(issues, "enforcement.audit_required", "must be a list")
                else:
                    for i, a in enumerate(ar):
                        if a not in _VALID_AUDIT_ACTIONS:
                            _err(issues, f"enforcement.audit_required[{i}]", f"invalid: {a!r}")

    # data_scope (optional)
    ds = payload.get("data_scope")
    if ds is not None:
        if not isinstance(ds, dict):
            _err(issues, "data_scope", "must be an object")
        else:
            types = ds.get("types")
            if types is not None:
                if not isinstance(types, list):
                    _err(issues, "data_scope.types", "must be a list")
                else:
                    seen_ids: set[str] = set()
                    for i, t in enumerate(types):
                        base = f"data_scope.types[{i}]"
                        if not isinstance(t, dict):
                            _err(issues, base, "must be an object")
                            continue
                        tid = t.get("id")
                        if not isinstance(tid, str) or not tid:
                            _err(issues, f"{base}.id", "required string")
                        elif tid in seen_ids:
                            _err(issues, f"{base}.id", f"duplicate: {tid!r}")
                        else:
                            seen_ids.add(tid)
                        vk = t.get("value_kind")
                        if vk is not None and vk not in _VALID_VALUE_KINDS:
                            _err(issues, f"{base}.value_kind", f"invalid: {vk!r}")
                        if not isinstance(t.get("description"), str):
                            _err(issues, f"{base}.description", "required string")

    # roles (required, may be empty post-D-103 strip)
    roles = payload.get("roles")
    if not isinstance(roles, list):
        _err(issues, "roles", "required list (may be empty when shipped from "
                              "workspace; projects supply via overrides)")
        return issues
    if not roles:
        return issues

    seen_codes: set[str] = set()
    declared_ds_types = {t.get("id") for t in (ds.get("types", []) if isinstance(ds, dict) else [])}
    for i, r in enumerate(roles):
        base = f"roles[{i}]"
        if not isinstance(r, dict):
            _err(issues, base, "must be an object")
            continue
        code = r.get("code")
        if not isinstance(code, str) or not _ROLE_CODE_RE.match(code):
            _err(issues, f"{base}.code", f"invalid (uppercase snake required): {code!r}")
        elif code in seen_codes:
            _err(issues, f"{base}.code", f"duplicate: {code!r}")
        else:
            seen_codes.add(code)

        for field in ("name", "description"):
            if not isinstance(r.get(field), str) or not r[field]:
                _err(issues, f"{base}.{field}", "required non-empty string")

        cat = r.get("category")
        if cat not in _VALID_ROLE_CATEGORIES:
            _err(issues, f"{base}.category", f"invalid: {cat!r}")

        dst = r.get("data_scope_tipo")
        if dst is not None:
            if not isinstance(dst, str):
                _err(issues, f"{base}.data_scope_tipo", "must be string or null")
            elif declared_ds_types and dst not in declared_ds_types:
                _err(issues, f"{base}.data_scope_tipo",
                     f"references undeclared data_scope.types id: {dst!r}")

        # permission_bundle
        pb = r.get("permission_bundle")
        if not isinstance(pb, dict):
            _err(issues, f"{base}.permission_bundle", "required object")
            continue
        kind = pb.get("kind")
        if kind not in _VALID_BUNDLE_KINDS:
            _err(issues, f"{base}.permission_bundle.kind", f"invalid: {kind!r}")
            continue
        if kind == "list":
            perms = pb.get("permissions")
            if not isinstance(perms, list) or not perms:
                _err(issues, f"{base}.permission_bundle.permissions", "required non-empty list")
            else:
                for j, perm in enumerate(perms):
                    pbase = f"{base}.permission_bundle.permissions[{j}]"
                    if not isinstance(perm, dict):
                        _err(issues, pbase, "must be an object")
                        continue
                    if not isinstance(perm.get("code"), str) or not perm["code"]:
                        _err(issues, f"{pbase}.code", "required non-empty string")
        elif kind == "exclude_patterns":
            pats = pb.get("patterns")
            if not isinstance(pats, list) or not pats:
                _err(issues, f"{base}.permission_bundle.patterns", "required non-empty list")
        elif kind == "match_pattern":
            if not isinstance(pb.get("pattern"), str) or not pb["pattern"]:
                _err(issues, f"{base}.permission_bundle.pattern", "required non-empty string")

    return issues


def validate_permission_catalogue(payload: dict[str, Any]) -> list[str]:
    """Structural validation for permission-catalogue.arch.json (D-060).

    Checks:
      - _schema_version == 1
      - semver shape on version
      - modules is a non-empty list
      - each module has prefix (snake/kebab), name, permissions (non-empty)
      - duplicate detection across the whole catalogue
      - every permission code starts with `<prefix>.` (structural consistency)
    """
    issues: list[str] = []
    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    modules = payload.get("modules")
    if not isinstance(modules, list):
        _err(issues, "modules", "required list (may be empty post-D-103; "
                                "projects supply via overrides)")
        return issues
    if not modules:
        return issues

    seen_prefixes: set[str] = set()
    seen_codes: dict[str, str] = {}  # code → module prefix of first declaration
    for i, mod in enumerate(modules):
        base = f"modules[{i}]"
        if not isinstance(mod, dict):
            _err(issues, base, "must be an object")
            continue
        prefix = mod.get("prefix")
        if not isinstance(prefix, str) or not re.match(r"^[a-z][a-z0-9_-]*$", prefix):
            _err(issues, f"{base}.prefix", f"invalid (lower kebab/snake): {prefix!r}")
        elif prefix in seen_prefixes:
            _err(issues, f"{base}.prefix", f"duplicate: {prefix!r}")
        else:
            seen_prefixes.add(prefix)
        if not isinstance(mod.get("name"), str) or not mod["name"]:
            _err(issues, f"{base}.name", "required non-empty string")

        perms = mod.get("permissions")
        if not isinstance(perms, list) or not perms:
            _err(issues, f"{base}.permissions", "required non-empty list")
            continue
        for j, code in enumerate(perms):
            pbase = f"{base}.permissions[{j}]"
            if not isinstance(code, str) or not code:
                _err(issues, pbase, "required non-empty string")
                continue
            if prefix and not code.startswith(f"{prefix}."):
                _err(issues, pbase,
                     f"code {code!r} doesn't start with module prefix {prefix!r}")
            if code in seen_codes:
                _err(issues, pbase,
                     f"duplicate code {code!r} (first declared under "
                     f"module {seen_codes[code]!r})")
            else:
                seen_codes[code] = prefix or "?"
    return issues


def validate_entity_scope(payload: dict[str, Any]) -> list[str]:
    """Structural validation for entity-scope.arch.json (D-062).

    Checks:
      - _schema_version == 1, semver
      - scopes is a non-empty dict
      - each tipo key has at least one entry
      - each entry has entity (PascalCase), table (snake), filter_name (camel),
        column (snake), param (camel), kind in {scalar,list}
      - duplicate detection: (tipo, entity) pairs unique; filter_name unique
        across the whole catalogue (Hibernate filter names are global)
    """
    issues: list[str] = []

    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    scopes = payload.get("scopes")
    if not isinstance(scopes, dict):
        _err(issues, "scopes", "required object (may be empty post-D-103; "
                               "projects supply via overrides)")
        return issues
    if not scopes:
        return issues

    pascal_re = re.compile(r"^[A-Z][A-Za-z0-9]*$")
    snake_re = re.compile(r"^[a-z][a-z0-9_]*$")
    camel_re = re.compile(r"^[a-z][A-Za-z0-9]*$")

    seen_filter_names: dict[str, str] = {}    # filter_name → "<tipo>.<entity>"
    seen_tipo_entity: set[tuple[str, str]] = set()

    for tipo, entries in scopes.items():
        base = f"scopes[{tipo!r}]"
        if not isinstance(entries, list) or not entries:
            _err(issues, base, "must be a non-empty list")
            continue
        for i, e in enumerate(entries):
            ebase = f"{base}[{i}]"
            if not isinstance(e, dict):
                _err(issues, ebase, "must be an object")
                continue
            entity = e.get("entity")
            if not isinstance(entity, str) or not pascal_re.match(entity):
                _err(issues, f"{ebase}.entity", f"invalid PascalCase: {entity!r}")
            else:
                key = (tipo, entity)
                if key in seen_tipo_entity:
                    _err(issues, f"{ebase}.entity",
                         f"duplicate (tipo={tipo!r}, entity={entity!r})")
                else:
                    seen_tipo_entity.add(key)
            for field, pattern, label in [
                ("table", snake_re, "snake_case"),
                ("filter_name", camel_re, "camelCase"),
                ("column", snake_re, "snake_case"),
                ("param", camel_re, "camelCase"),
            ]:
                val = e.get(field)
                if not isinstance(val, str) or not pattern.match(val):
                    _err(issues, f"{ebase}.{field}", f"invalid {label}: {val!r}")
            kind = e.get("kind")
            if kind is not None and kind not in ("scalar", "list"):
                _err(issues, f"{ebase}.kind", f"must be 'scalar' or 'list', got {kind!r}")
            fn = e.get("filter_name")
            if isinstance(fn, str) and fn:
                if fn in seen_filter_names:
                    _err(issues, f"{ebase}.filter_name",
                         f"duplicate filter_name {fn!r} (also at {seen_filter_names[fn]})")
                else:
                    seen_filter_names[fn] = f"{tipo}.{entity!r}"
    return issues


def validate_multi_tenancy(payload: dict[str, Any]) -> list[str]:
    """Structural validation for multi-tenancy.arch.json (D-063).

    Checks:
      - _schema_version == 1, semver
      - isolation_strategies has unique ids; each has trade_offs with
        non-empty positives + negatives
      - modes has unique ids; each declares supported_isolation_strategies
        that must reference declared strategy ids
      - context_propagation has sync + async with the required template
        fields and cleanup ∈ {always_in_finally_block, auto_via_aspect}
    """
    issues: list[str] = []

    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    id_re = re.compile(r"^[a-z][a-z0-9-]*$")

    strategies = payload.get("isolation_strategies")
    strategy_ids: set[str] = set()
    if not isinstance(strategies, list) or not strategies:
        _err(issues, "isolation_strategies", "required non-empty list")
    else:
        for i, s in enumerate(strategies):
            base = f"isolation_strategies[{i}]"
            if not isinstance(s, dict):
                _err(issues, base, "must be an object")
                continue
            sid = s.get("id")
            if not isinstance(sid, str) or not id_re.match(sid):
                _err(issues, f"{base}.id", f"invalid: {sid!r}")
            elif sid in strategy_ids:
                _err(issues, f"{base}.id", f"duplicate: {sid!r}")
            else:
                strategy_ids.add(sid)
            for field in ("label", "description"):
                if not isinstance(s.get(field), str) or not s[field]:
                    _err(issues, f"{base}.{field}", "required non-empty string")
            to = s.get("trade_offs")
            if not isinstance(to, dict):
                _err(issues, f"{base}.trade_offs", "required object")
            else:
                for side in ("positives", "negatives"):
                    lst = to.get(side)
                    if not isinstance(lst, list) or not lst:
                        _err(issues, f"{base}.trade_offs.{side}", "required non-empty list")

    modes = payload.get("modes")
    mode_ids: set[str] = set()
    if not isinstance(modes, list) or not modes:
        _err(issues, "modes", "required non-empty list")
    else:
        for i, m in enumerate(modes):
            base = f"modes[{i}]"
            if not isinstance(m, dict):
                _err(issues, base, "must be an object")
                continue
            mid = m.get("id")
            if not isinstance(mid, str) or not id_re.match(mid):
                _err(issues, f"{base}.id", f"invalid: {mid!r}")
            elif mid in mode_ids:
                _err(issues, f"{base}.id", f"duplicate: {mid!r}")
            else:
                mode_ids.add(mid)
            for field in ("label", "description", "default_term", "default_term_plural"):
                if not isinstance(m.get(field), str) or not m[field]:
                    _err(issues, f"{base}.{field}", "required non-empty string")
            supp = m.get("supported_isolation_strategies")
            if not isinstance(supp, list) or not supp:
                _err(issues, f"{base}.supported_isolation_strategies", "required non-empty list")
            elif strategy_ids:
                for j, sid in enumerate(supp):
                    if sid not in strategy_ids:
                        _err(issues, f"{base}.supported_isolation_strategies[{j}]",
                             f"references undeclared strategy id {sid!r}")

    cp = payload.get("context_propagation")
    if not isinstance(cp, dict):
        _err(issues, "context_propagation", "required object")
    else:
        sync = cp.get("sync")
        if not isinstance(sync, dict):
            _err(issues, "context_propagation.sync", "required object")
        else:
            for field in ("jwt_claim_template", "http_header_template",
                          "holder_class_template", "filter_class_template",
                          "mdc_key_template", "enforcement_rule"):
                if not isinstance(sync.get(field), str) or not sync[field]:
                    _err(issues, f"context_propagation.sync.{field}", "required non-empty string")
        asy = cp.get("async")
        if not isinstance(asy, dict):
            _err(issues, "context_propagation.async", "required object")
        else:
            for field in ("jms_header_template", "executor_class_template"):
                if not isinstance(asy.get(field), str) or not asy[field]:
                    _err(issues, f"context_propagation.async.{field}", "required non-empty string")
            cu = asy.get("cleanup")
            if cu not in ("always_in_finally_block", "auto_via_aspect"):
                _err(issues, "context_propagation.async.cleanup",
                     f"must be 'always_in_finally_block' or 'auto_via_aspect', got {cu!r}")

    return issues


def validate_error_model(payload: dict[str, Any]) -> list[str]:
    """Structural validation for error-model.arch.json (D-064).

    Checks:
      - _schema_version == 1, semver
      - media_type, rfc, type_uri_template are non-empty strings
      - categories: unique ids; default_http_status appears in
        valid_http_statuses; HTTP statuses in [400, 599]
      - extension_fields: unique names; type non-empty
      - modules: unique prefixes; each error code starts with `<prefix>.`,
        references a known category, and uses an http_status declared in
        that category's valid_http_statuses; duplicate error codes are
        reported across the whole catalogue.
    """
    issues: list[str] = []

    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    for f in ("media_type", "rfc", "type_uri_template"):
        if not isinstance(payload.get(f), str) or not payload[f]:
            _err(issues, f, "required non-empty string")

    id_re = re.compile(r"^[a-z][a-z0-9_-]*$")

    cats = payload.get("categories")
    cat_specs: dict[str, dict[str, Any]] = {}
    if not isinstance(cats, list) or not cats:
        _err(issues, "categories", "required non-empty list")
    else:
        for i, c in enumerate(cats):
            base = f"categories[{i}]"
            if not isinstance(c, dict):
                _err(issues, base, "must be an object")
                continue
            cid = c.get("id")
            if not isinstance(cid, str) or not id_re.match(cid):
                _err(issues, f"{base}.id", f"invalid: {cid!r}")
            elif cid in cat_specs:
                _err(issues, f"{base}.id", f"duplicate: {cid!r}")
            else:
                cat_specs[cid] = c
            dft = c.get("default_http_status")
            if not isinstance(dft, int) or not (400 <= dft <= 599):
                _err(issues, f"{base}.default_http_status", f"must be int 400..599: {dft!r}")
            valid = c.get("valid_http_statuses")
            if not isinstance(valid, list) or not valid or not all(
                isinstance(x, int) and 400 <= x <= 599 for x in valid
            ):
                _err(issues, f"{base}.valid_http_statuses",
                     f"must be non-empty list of int 400..599: {valid!r}")
            elif isinstance(dft, int) and dft not in valid:
                _err(issues, f"{base}.default_http_status",
                     f"{dft} not in valid_http_statuses {valid}")
            if not isinstance(c.get("description"), str) or not c["description"]:
                _err(issues, f"{base}.description", "required non-empty string")

    ext = payload.get("extension_fields")
    if not isinstance(ext, list) or not ext:
        _err(issues, "extension_fields", "required non-empty list")
    else:
        seen_ext: set[str] = set()
        for i, f in enumerate(ext):
            base = f"extension_fields[{i}]"
            if not isinstance(f, dict):
                _err(issues, base, "must be an object")
                continue
            name = f.get("name")
            if not isinstance(name, str) or not name:
                _err(issues, f"{base}.name", "required non-empty string")
            elif name in seen_ext:
                _err(issues, f"{base}.name", f"duplicate: {name!r}")
            else:
                seen_ext.add(name)
            if not isinstance(f.get("required"), bool):
                _err(issues, f"{base}.required", "required boolean")
            if not isinstance(f.get("type"), str) or not f["type"]:
                _err(issues, f"{base}.type", "required non-empty string")

    modules = payload.get("modules")
    if not isinstance(modules, list):
        _err(issues, "modules", "required list (may be empty post-D-103; "
                                "projects supply via overrides)")
        return issues
    if not modules:
        return issues

    seen_prefixes: set[str] = set()
    seen_codes: dict[str, str] = {}  # code → "modules[i].errors[j]"
    for i, mod in enumerate(modules):
        base = f"modules[{i}]"
        if not isinstance(mod, dict):
            _err(issues, base, "must be an object")
            continue
        prefix = mod.get("prefix")
        if not isinstance(prefix, str) or not id_re.match(prefix):
            _err(issues, f"{base}.prefix", f"invalid: {prefix!r}")
        elif prefix in seen_prefixes:
            _err(issues, f"{base}.prefix", f"duplicate: {prefix!r}")
        else:
            seen_prefixes.add(prefix)
        if not isinstance(mod.get("name"), str) or not mod["name"]:
            _err(issues, f"{base}.name", "required non-empty string")
        errs = mod.get("errors")
        if not isinstance(errs, list) or not errs:
            _err(issues, f"{base}.errors", "required non-empty list")
            continue
        for j, e in enumerate(errs):
            ebase = f"{base}.errors[{j}]"
            if not isinstance(e, dict):
                _err(issues, ebase, "must be an object")
                continue
            code = e.get("code")
            if not isinstance(code, str) or not code:
                _err(issues, f"{ebase}.code", "required non-empty string")
            else:
                if prefix and not code.startswith(f"{prefix}."):
                    _err(issues, f"{ebase}.code",
                         f"{code!r} doesn't start with module prefix {prefix!r}")
                if code in seen_codes:
                    _err(issues, f"{ebase}.code",
                         f"duplicate code {code!r} (first declared at {seen_codes[code]})")
                else:
                    seen_codes[code] = ebase
            cat_id = e.get("category")
            if not isinstance(cat_id, str) or not cat_id:
                _err(issues, f"{ebase}.category", "required non-empty string")
            elif cat_specs and cat_id not in cat_specs:
                _err(issues, f"{ebase}.category",
                     f"{cat_id!r} not declared in categories")
            http = e.get("http_status")
            if not isinstance(http, int) or not (400 <= http <= 599):
                _err(issues, f"{ebase}.http_status",
                     f"must be int 400..599: {http!r}")
            elif cat_specs and cat_id in cat_specs:
                allowed = cat_specs[cat_id].get("valid_http_statuses") or []
                if http not in allowed:
                    _err(issues, f"{ebase}.http_status",
                         f"{http} not in valid_http_statuses {allowed} of "
                         f"category {cat_id!r}")
    return issues


def validate_events(payload: dict[str, Any]) -> list[str]:
    """Structural validation for events.arch.json (D-065).

    Checks:
      - _schema_version, semver, broker enum
      - naming_convention: pattern + verb_form non-empty
      - envelope.headers / payload_fields: unique names, type non-empty
      - delivery: retries int, backoff_seconds non-empty list of ints
      - idempotency: table + key_field non-empty
      - modules: unique prefix + module_path; each event has unique name
        across the whole catalogue; event.name starts with the project
        token followed by `<module_path>.` (or just the project token when
        module.is_global=true — IAM-style "{{ project_name }}.<entity>.<action>")
    """
    issues: list[str] = []

    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    broker = payload.get("broker")
    if not _is_templated(broker) and broker not in ("artemis", "kafka", "rabbitmq", "none"):
        _err(issues, "broker", f"invalid: {broker!r}")

    nc = payload.get("naming_convention")
    if not isinstance(nc, dict):
        _err(issues, "naming_convention", "required object")
    else:
        if not isinstance(nc.get("pattern"), str) or not nc["pattern"]:
            _err(issues, "naming_convention.pattern", "required non-empty string")
        if nc.get("verb_form") not in ("past_participle", "infinitive", "imperative"):
            _err(issues, "naming_convention.verb_form", f"invalid: {nc.get('verb_form')!r}")

    env = payload.get("envelope")
    if not isinstance(env, dict):
        _err(issues, "envelope", "required object")
    else:
        for section in ("headers", "payload_fields"):
            entries = env.get(section)
            if not isinstance(entries, list) or not entries:
                _err(issues, f"envelope.{section}", "required non-empty list")
                continue
            seen: set[str] = set()
            for i, f in enumerate(entries):
                base = f"envelope.{section}[{i}]"
                if not isinstance(f, dict):
                    _err(issues, base, "must be an object")
                    continue
                name = f.get("name")
                if not isinstance(name, str) or not name:
                    _err(issues, f"{base}.name", "required non-empty string")
                elif name in seen:
                    _err(issues, f"{base}.name", f"duplicate: {name!r}")
                else:
                    seen.add(name)
                if not isinstance(f.get("required"), bool):
                    _err(issues, f"{base}.required", "required boolean")
                if not isinstance(f.get("type"), str) or not f["type"]:
                    _err(issues, f"{base}.type", "required non-empty string")

    delivery = payload.get("delivery")
    if not isinstance(delivery, dict):
        _err(issues, "delivery", "required object")
    else:
        if not isinstance(delivery.get("retries"), int) or delivery["retries"] < 0:
            _err(issues, "delivery.retries", "required non-negative int")
        bo = delivery.get("backoff_seconds")
        if not isinstance(bo, list) or not bo or not all(isinstance(x, int) and x >= 0 for x in bo):
            _err(issues, "delivery.backoff_seconds", "required non-empty list of non-negative ints")
        if not isinstance(delivery.get("dlq_prefix"), str) or not delivery["dlq_prefix"]:
            _err(issues, "delivery.dlq_prefix", "required non-empty string")

    idem = payload.get("idempotency")
    if not isinstance(idem, dict):
        _err(issues, "idempotency", "required object")
    else:
        for f in ("table", "key_field"):
            if not isinstance(idem.get(f), str) or not idem[f]:
                _err(issues, f"idempotency.{f}", "required non-empty string")

    modules = payload.get("modules")
    if not isinstance(modules, list):
        _err(issues, "modules", "required list (may be empty post-D-103; "
                                "projects supply via overrides)")
        return issues
    if not modules:
        return issues

    id_re = re.compile(r"^[a-z][a-z0-9_-]*$")
    seen_prefixes: set[str] = set()
    seen_module_paths: set[str] = set()
    seen_event_names: dict[str, str] = {}  # event_name → "modules[i].events[j]"
    for i, mod in enumerate(modules):
        base = f"modules[{i}]"
        if not isinstance(mod, dict):
            _err(issues, base, "must be an object")
            continue
        prefix = mod.get("prefix")
        if not isinstance(prefix, str) or not id_re.match(prefix):
            _err(issues, f"{base}.prefix", f"invalid: {prefix!r}")
        elif prefix in seen_prefixes:
            _err(issues, f"{base}.prefix", f"duplicate: {prefix!r}")
        else:
            seen_prefixes.add(prefix)
        module_path = mod.get("module_path")
        if not isinstance(module_path, str) or not module_path:
            _err(issues, f"{base}.module_path", "required non-empty string")
        elif module_path in seen_module_paths:
            _err(issues, f"{base}.module_path", f"duplicate: {module_path!r}")
        else:
            seen_module_paths.add(module_path)
        is_global = bool(mod.get("is_global", False))
        events = mod.get("events")
        if not isinstance(events, list) or not events:
            _err(issues, f"{base}.events", "required non-empty list")
            continue
        for j, e in enumerate(events):
            ebase = f"{base}.events[{j}]"
            if not isinstance(e, dict):
                _err(issues, ebase, "must be an object")
                continue
            name = e.get("name")
            if not isinstance(name, str) or not name:
                _err(issues, f"{ebase}.name", "required non-empty string")
                continue
            if name in seen_event_names:
                _err(issues, f"{ebase}.name",
                     f"duplicate event name {name!r} (first declared at {seen_event_names[name]})")
            else:
                seen_event_names[name] = ebase
            # Naming convention check: project token (first segment after the
            # {{ project_name }} placeholder) — we accept either pattern but
            # require that the second segment matches module_path for non-
            # global modules.
            if isinstance(module_path, str) and not is_global:
                expected_prefix = "{{ project_name }}." + module_path + "."
                if not name.startswith(expected_prefix):
                    _err(issues, f"{ebase}.name",
                         f"{name!r} does not start with {expected_prefix!r} "
                         f"(module is not is_global)")
            else:
                # global module: just require the project token at start
                if not name.startswith("{{ project_name }}."):
                    _err(issues, f"{ebase}.name",
                         f"{name!r} does not start with '{{{{ project_name }}}}.'")
            if not isinstance(e.get("producer"), str) or not e["producer"]:
                _err(issues, f"{ebase}.producer", "required non-empty string")
            if not isinstance(e.get("consumers"), list):
                _err(issues, f"{ebase}.consumers", "required list (may be empty)")
            dt = e.get("destination_type")
            if dt is not None and dt not in ("queue", "topic"):
                _err(issues, f"{ebase}.destination_type", f"invalid: {dt!r}")
    return issues


def validate_persistence(payload: dict[str, Any]) -> list[str]:
    """Structural validation for persistence.arch.json (D-066).

    Singleton aspect — no modules[]. Checks:
      - _schema_version, semver
      - primary_key: strategy enum, rationale non-empty
      - audit_columns: 4 column names non-empty, applies_to enum
      - soft_delete: column + type non-empty, applies_to enum
      - column_types: unique names (snake), sql_type non-empty
      - numbering: pattern + serial_padding (>=1) + column_type
      - schema_annotation: comment_prefix + non-empty valid_values
      - fk_rule: same_schema + cross_schema enums
      - snapshot_pattern: suffix + description
      - encoding enum
    """
    issues: list[str] = []

    sv = payload.get("_schema_version")
    if sv != 1:
        _err(issues, "_schema_version", f"expected 1, got {sv!r}")
    v = payload.get("version")
    if not isinstance(v, str) or not _SEMVER_RE.match(v):
        _err(issues, "version", f"missing or not semver: {v!r}")

    pk = payload.get("primary_key")
    if not isinstance(pk, dict):
        _err(issues, "primary_key", "required object")
    else:
        if pk.get("strategy") not in ("uuid_v4", "uuid_v7", "bigserial", "natural_key"):
            _err(issues, "primary_key.strategy", f"invalid: {pk.get('strategy')!r}")
        if not isinstance(pk.get("rationale"), str) or not pk["rationale"]:
            _err(issues, "primary_key.rationale", "required non-empty string")

    audit = payload.get("audit_columns")
    if not isinstance(audit, dict):
        _err(issues, "audit_columns", "required object")
    else:
        for col in ("created_at", "created_by", "updated_at", "updated_by"):
            if not isinstance(audit.get(col), str) or not audit[col]:
                _err(issues, f"audit_columns.{col}", "required non-empty string")
        if audit.get("applies_to") not in ("all_root_aggregates", "all_tables", "opt_in"):
            _err(issues, "audit_columns.applies_to",
                 f"invalid: {audit.get('applies_to')!r}")

    sd = payload.get("soft_delete")
    if not isinstance(sd, dict):
        _err(issues, "soft_delete", "required object")
    else:
        for f in ("column", "type"):
            if not isinstance(sd.get(f), str) or not sd[f]:
                _err(issues, f"soft_delete.{f}", "required non-empty string")
        if sd.get("applies_to") not in ("all_root_aggregates", "all_tables", "opt_in"):
            _err(issues, "soft_delete.applies_to", f"invalid: {sd.get('applies_to')!r}")

    cts = payload.get("column_types")
    name_re = re.compile(r"^[a-z][a-z0-9_]*$")
    if not isinstance(cts, list) or not cts:
        _err(issues, "column_types", "required non-empty list")
    else:
        seen: set[str] = set()
        for i, ct in enumerate(cts):
            base = f"column_types[{i}]"
            if not isinstance(ct, dict):
                _err(issues, base, "must be an object")
                continue
            name = ct.get("name")
            if not isinstance(name, str) or not name_re.match(name):
                _err(issues, f"{base}.name", f"invalid snake_case: {name!r}")
            elif name in seen:
                _err(issues, f"{base}.name", f"duplicate: {name!r}")
            else:
                seen.add(name)
            if not isinstance(ct.get("sql_type"), str) or not ct["sql_type"]:
                _err(issues, f"{base}.sql_type", "required non-empty string")
            if not isinstance(ct.get("description"), str) or not ct["description"]:
                _err(issues, f"{base}.description", "required non-empty string")

    num = payload.get("numbering")
    if not isinstance(num, dict):
        _err(issues, "numbering", "required object")
    else:
        for f in ("pattern", "column_type"):
            if not isinstance(num.get(f), str) or not num[f]:
                _err(issues, f"numbering.{f}", "required non-empty string")
        sp = num.get("serial_padding")
        if not isinstance(sp, int) or sp < 1:
            _err(issues, "numbering.serial_padding", f"must be positive int: {sp!r}")

    sa = payload.get("schema_annotation")
    if not isinstance(sa, dict):
        _err(issues, "schema_annotation", "required object")
    else:
        if not isinstance(sa.get("comment_prefix"), str) or not sa["comment_prefix"]:
            _err(issues, "schema_annotation.comment_prefix", "required non-empty string")
        vv = sa.get("valid_values")
        if not isinstance(vv, list) or not vv or not all(isinstance(x, str) and x for x in vv):
            _err(issues, "schema_annotation.valid_values",
                 "required non-empty list of strings")

    fk = payload.get("fk_rule")
    if not isinstance(fk, dict):
        _err(issues, "fk_rule", "required object")
    else:
        for f in ("same_schema", "cross_schema"):
            if fk.get(f) not in ("physical_fk", "logical_fk"):
                _err(issues, f"fk_rule.{f}", f"invalid: {fk.get(f)!r}")

    sp = payload.get("snapshot_pattern")
    if not isinstance(sp, dict):
        _err(issues, "snapshot_pattern", "required object")
    else:
        for f in ("suffix", "description"):
            if not isinstance(sp.get(f), str) or not sp[f]:
                _err(issues, f"snapshot_pattern.{f}", "required non-empty string")

    if payload.get("encoding") not in ("UTF-8", "LATIN1"):
        _err(issues, "encoding", f"invalid: {payload.get('encoding')!r}")

    return issues


_VALIDATORS = {
    "rbac": validate_rbac,
    "permission-catalogue": validate_permission_catalogue,
    "entity-scope": validate_entity_scope,
    "multi-tenancy": validate_multi_tenancy,
    "error-model": validate_error_model,
    "events": validate_events,
    "persistence": validate_persistence,
}


# ── Persistence lookup helpers (D-066) ───────────────────────────────────────


def column_type_for(name: str,
                    persistence: dict[str, Any]) -> dict[str, Any] | None:
    """Return the column_types entry matching name (e.g. 'monetary'), or None."""
    for ct in persistence.get("column_types", []):
        if ct.get("name") == name:
            return ct
    return None


def audit_column_names(persistence: dict[str, Any]) -> dict[str, str]:
    """Return the 4 audit column names as a small dict: keys are the canonical
    role (created_at/created_by/updated_at/updated_by); values the configured
    column names. Useful for be-entity-generator (D-066 Phase 2 hook).
    """
    audit = persistence.get("audit_columns") or {}
    return {
        "created_at": audit.get("created_at", ""),
        "created_by": audit.get("created_by", ""),
        "updated_at": audit.get("updated_at", ""),
        "updated_by": audit.get("updated_by", ""),
    }


# ── Events lookup + cross-validation helpers (D-065) ─────────────────────────


def event_for_name(name: str, events: dict[str, Any]) -> dict[str, Any] | None:
    """Return the event entry matching the fully-qualified name, or None."""
    for mod in events.get("modules", []):
        for e in mod.get("events", []):
            if e.get("name") == name:
                return e
    return None


def events_for_module(prefix: str, events: dict[str, Any]) -> list[dict[str, Any]]:
    """Return events declared under the module with this prefix."""
    for mod in events.get("modules", []):
        if mod.get("prefix") == prefix:
            return list(mod.get("events") or [])
    return []


def all_event_names(events: dict[str, Any]) -> set[str]:
    """Flatten every modules[*].events[*].name into a set."""
    out: set[str] = set()
    for mod in events.get("modules", []):
        for e in mod.get("events", []):
            if isinstance(e.get("name"), str):
                out.add(e["name"])
    return out


def cross_validate_events_against_multi_tenancy(
    events: dict[str, Any], multi_tenancy: dict[str, Any]
) -> list[str]:
    """The events envelope MUST carry the tenant id under the header name
    declared in multi_tenancy.context_propagation.async.jms_header_template.

    Both payloads come from the workspace; interpolation hasn't happened at
    validate time, so the comparison is on the templated strings.
    """
    issues: list[str] = []
    mt_header = (
        ((multi_tenancy or {}).get("context_propagation") or {})
        .get("async", {})
        .get("jms_header_template")
    )
    if not mt_header:
        return issues
    headers = ((events or {}).get("envelope") or {}).get("headers") or []
    matching = [h for h in headers if h.get("name") == mt_header]
    if not matching:
        issues.append(
            f"events.envelope.headers: no header matches "
            f"multi_tenancy.context_propagation.async.jms_header_template "
            f"({mt_header!r}). Add a header with this exact templated name."
        )
    return issues


# ── Error model lookup helpers (D-064) ───────────────────────────────────────


def error_category(category_id: str,
                   error_model: dict[str, Any]) -> dict[str, Any] | None:
    """Return the categories entry matching category_id, or None."""
    for c in error_model.get("categories", []):
        if c.get("id") == category_id:
            return c
    return None


def all_error_codes(error_model: dict[str, Any]) -> set[str]:
    """Flatten every modules[*].errors[*].code into a set."""
    out: set[str] = set()
    for mod in error_model.get("modules", []):
        for e in mod.get("errors", []):
            code = e.get("code")
            if isinstance(code, str) and code:
                out.add(code)
    return out


def errors_for_module(prefix: str,
                      error_model: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the errors list for the module with this prefix, or [] when
    no such module exists.
    """
    for mod in error_model.get("modules", []):
        if mod.get("prefix") == prefix:
            return list(mod.get("errors") or [])
    return []


def validate_decision(aspect: str, payload: dict[str, Any]) -> list[str]:
    """Validate one decision payload. Unknown aspects return [] (no validator)."""
    fn = _VALIDATORS.get(aspect)
    return fn(payload) if fn else []


# ── Permission catalogue expansion + cross-validation (D-060) ────────────────


def all_permissions(catalogue: dict[str, Any]) -> set[str]:
    """Flatten the catalogue into a set of permission codes.

    The catalogue may contain `{{ var }}` placeholders inside codes; this
    function returns them as-is. Use `interpolate_payload(catalogue, vars)`
    first if you need literal codes for comparison against generator output.
    """
    out: set[str] = set()
    for module in catalogue.get("modules", []):
        for code in module.get("permissions", []):
            if isinstance(code, str) and code:
                out.add(code)
    return out


def _glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Translate an SQL-style LIKE pattern (% wildcard) to a regex.

    Used by `expand_bundle` for kinds `exclude_patterns` and `match_pattern`,
    whose patterns follow the SQL convention used in rbac.arch.json bundles
    (e.g. `%.read`, `%.config.%`, `iam.%`). `_` (single char) is NOT used in
    those bundles, but supported for symmetry.
    """
    out = []
    for ch in pattern:
        if ch == "%":
            out.append(".*")
        elif ch == "_":
            out.append(".")
        else:
            out.append(re.escape(ch))
    return re.compile("^" + "".join(out) + "$")


def expand_bundle(bundle: dict[str, Any], catalogue: dict[str, Any]) -> set[str]:
    """Resolve a role's `permission_bundle` into the concrete set of permission
    codes it grants, using the catalogue as the universe.

    Handles all four kinds:
      - `all`               → entire catalogue
      - `exclude_patterns`  → catalogue minus codes matching any pattern
      - `match_pattern`     → codes matching the pattern
      - `list`              → the explicit `permissions[*].code` (wildcards
                              inside list entries — like `fis.*` — expanded
                              against the catalogue when the trailing token
                              is `*`)

    Returns an empty set when bundle kind is unknown.
    """
    if not isinstance(bundle, dict):
        return set()
    universe = all_permissions(catalogue)
    kind = bundle.get("kind")
    if kind == "all":
        return set(universe)
    if kind == "exclude_patterns":
        patterns = [_glob_to_regex(p) for p in bundle.get("patterns", [])]
        return {c for c in universe if not any(p.match(c) for p in patterns)}
    if kind == "match_pattern":
        pattern = bundle.get("pattern")
        if not isinstance(pattern, str):
            return set()
        rx = _glob_to_regex(pattern)
        return {c for c in universe if rx.match(c)}
    if kind == "list":
        out: set[str] = set()
        for perm in bundle.get("permissions", []):
            code = perm.get("code", "") if isinstance(perm, dict) else ""
            if not code:
                continue
            if code.endswith(".*"):
                # `fis.*` → every catalogue code starting with `fis.`
                stem = code[:-1]  # keep trailing dot
                out.update(c for c in universe if c.startswith(stem))
            else:
                out.add(code)
        return out
    return set()


def is_known_permission(code: str, catalogue: dict[str, Any]) -> bool:
    """True when the catalogue (already interpolated, if needed) declares
    this exact permission code.
    """
    return code in all_permissions(catalogue)


def entity_scope_entries_for_table(
    entity_scope: dict[str, Any], table_name: str
) -> list[dict[str, Any]]:
    """Return all `{tipo, entity, table, filter_name, column, param, kind}`
    entries that target this table across every scope tipo. The same table
    may participate in multiple scopes (e.g. movimento_estoque under both
    LOCAL_ESTOQUE and LOCAIS). Used by be-entity-generator to emit one
    @FilterDef per match.
    """
    out: list[dict[str, Any]] = []
    for tipo, entries in (entity_scope.get("scopes") or {}).items():
        for e in entries:
            if e.get("table") == table_name:
                out.append({**e, "tipo": tipo})
    return out


def multi_tenancy_isolation_strategy(strategy_id: str,
                                     multi_tenancy: dict[str, Any]) -> dict[str, Any] | None:
    """Return the isolation_strategies entry matching strategy_id, or None."""
    for s in multi_tenancy.get("isolation_strategies", []):
        if s.get("id") == strategy_id:
            return s
    return None


def multi_tenancy_mode(mode_id: str,
                      multi_tenancy: dict[str, Any]) -> dict[str, Any] | None:
    """Return the modes entry matching mode_id, or None."""
    for m in multi_tenancy.get("modes", []):
        if m.get("id") == mode_id:
            return m
    return None


def cross_validate_multi_tenancy_against_context(
    multi_tenancy: dict[str, Any], project_context: dict[str, Any]
) -> list[str]:
    """Verify the project's multiTenancy section is consistent with the
    formal decision (D-063).

    Checks:
      - project_context.multiTenancy.mode exists in multi_tenancy.modes[*].id
      - project_context.multiTenancy.isolationStrategy exists in
        isolation_strategies[*].id
      - the chosen isolationStrategy is listed in the chosen mode's
        supported_isolation_strategies
    """
    issues: list[str] = []
    mt_ctx = (project_context or {}).get("multiTenancy") or {}
    mode_id = mt_ctx.get("mode")
    strat_id = mt_ctx.get("isolationStrategy")

    mode = multi_tenancy_mode(mode_id, multi_tenancy) if mode_id else None
    if mode_id and mode is None:
        issues.append(
            f"project-context.multiTenancy.mode: {mode_id!r} not declared in "
            f"multi-tenancy.arch.json modes"
        )
    strat = multi_tenancy_isolation_strategy(strat_id, multi_tenancy) if strat_id else None
    if strat_id and strat is None:
        issues.append(
            f"project-context.multiTenancy.isolationStrategy: {strat_id!r} not "
            f"declared in multi-tenancy.arch.json isolation_strategies"
        )
    if mode and strat_id and strat_id not in (mode.get("supported_isolation_strategies") or []):
        issues.append(
            f"project-context.multiTenancy: isolationStrategy {strat_id!r} is "
            f"not supported by mode {mode_id!r} (supported: "
            f"{mode.get('supported_isolation_strategies')!r})"
        )
    return issues


def cross_validate_entity_scope_against_rbac(
    entity_scope: dict[str, Any], rbac: dict[str, Any]
) -> list[str]:
    """Every tipo declared in entity-scope must be a recognised data-scope tipo
    in rbac.arch.json (D-062 cross-validation).

    The check is one-directional: entity-scope tipo → rbac.data_scope.types.
    Tipos declared in rbac without any entity-scope entries are allowed
    (e.g. EMPRESA_COMPLETA — "no restriction" — never has entities).
    """
    issues: list[str] = []
    known = {
        t.get("id") for t in ((rbac.get("data_scope") or {}).get("types") or [])
    }
    for tipo in (entity_scope.get("scopes") or {}).keys():
        if tipo not in known:
            issues.append(
                f"entity-scope.scopes[{tipo!r}]: tipo not declared in "
                f"rbac.arch.json data_scope.types"
            )
    return issues


def cross_validate_rbac_against_catalogue(
    rbac: dict[str, Any], catalogue: dict[str, Any]
) -> list[str]:
    """Return a list of issues where rbac.arch.json `kind:list` bundles
    reference permission codes that don't exist in the catalogue.

    Wildcards (`fis.*`) inside list entries are expanded against the
    catalogue; a wildcard that matches nothing is also reported.

    `kind: all` / `exclude_patterns` / `match_pattern` are NOT validated here
    because their semantics are anchored in the catalogue itself; they are
    well-defined as long as the catalogue is non-empty.
    """
    issues: list[str] = []
    universe = all_permissions(catalogue)
    for i, role in enumerate(rbac.get("roles", [])):
        bundle = role.get("permission_bundle") or {}
        if bundle.get("kind") != "list":
            continue
        for j, perm in enumerate(bundle.get("permissions", [])):
            code = perm.get("code", "") if isinstance(perm, dict) else ""
            base = (f"roles[{i}](code={role.get('code')!r})"
                    f".permission_bundle.permissions[{j}].code")
            if not code:
                continue
            if code.endswith(".*"):
                stem = code[:-1]
                if not any(c.startswith(stem) for c in universe):
                    issues.append(f"{base}: wildcard {code!r} matches no catalogue entry")
            elif code not in universe:
                issues.append(f"{base}: {code!r} not declared in permission-catalogue")
    return issues


def cross_validate_registry_against_catalogue(
    project_context: dict[str, Any], catalogue: dict[str, Any]
) -> list[str]:
    """Cross-check `project-context.modules.registry` against
    `permission-catalogue.arch.json` (D-083).

    Two categories of issues:

    A) Registry module without a corresponding catalogue entry. Only reported
       when the module is user-facing (`hasUi: true`) and not infrastructure
       (`isInfrastructure: false`). Backend-only / infra modules (gateway,
       service-registry, migrations runner) typically do not own permissions.

    B) Catalogue module without a corresponding registry entry. Reported
       unconditionally — orphan permissions usually mean the catalogue ships
       defaults the project hasn't removed, or the registry was renamed and
       the catalogue not synced.

    Match key:
      1. `catalogue.module.prefix == registry.prefix.lower()` (primary), OR
      2. `catalogue.module.package == (registry.packageSuffix or prefix.lower())`
         (fallback — projects that renamed the catalogue package without
         touching the prefix still pair correctly).

    Returns a list of human-readable issue strings (empty when consistent).
    """
    issues: list[str] = []
    registry = ((project_context or {}).get("modules") or {}).get("registry") or []
    cat_modules = (catalogue or {}).get("modules") or []
    if not registry or not cat_modules:
        return issues

    cat_by_prefix: dict[str, dict[str, Any]] = {}
    cat_by_package: dict[str, dict[str, Any]] = {}
    for mod in cat_modules:
        if not isinstance(mod, dict):
            continue
        pfx = mod.get("prefix")
        pkg = mod.get("package")
        if isinstance(pfx, str) and pfx:
            cat_by_prefix.setdefault(pfx, mod)
        if isinstance(pkg, str) and pkg:
            cat_by_package.setdefault(pkg, mod)

    matched_catalogue_prefixes: set[str] = set()

    for i, reg in enumerate(registry):
        if not isinstance(reg, dict):
            continue
        reg_prefix = (reg.get("prefix") or "").lower()
        reg_pkg = reg.get("packageSuffix") or reg_prefix
        has_ui = reg.get("hasUi", True)
        is_infra = reg.get("isInfrastructure", False)

        cat_hit = cat_by_prefix.get(reg_prefix) or cat_by_package.get(reg_pkg)
        if cat_hit is None:
            if has_ui and not is_infra:
                issues.append(
                    f"modules.registry[{i}](prefix={reg.get('prefix')!r}): "
                    f"no entry in permission-catalogue.modules - "
                    f"tried prefix={reg_prefix!r} and package={reg_pkg!r}"
                )
            continue
        matched_catalogue_prefixes.add(cat_hit.get("prefix") or "")

    for j, mod in enumerate(cat_modules):
        if not isinstance(mod, dict):
            continue
        pfx = mod.get("prefix") or ""
        if not pfx or pfx in matched_catalogue_prefixes:
            continue
        issues.append(
            f"permission-catalogue.modules[{j}](prefix={pfx!r}): "
            f"no entry in project-context.modules.registry - "
            f"either add to registry or drop from catalogue"
        )
    return issues


# ── Payload interpolation (promoted from render.py for cross-module reuse) ───


# `{{ var }}`, `{{ var | filter }}` or `{{ var | default('value') }}` —
# single optional filter (optionally with one quoted arg), no chains.
# Lightweight subset is enough for arch-decision payloads; full Jinja would
# spin up an Environment per render and is overkill for identifier templates.
_PAYLOAD_VAR_RE = re.compile(
    r"\{\{\s*(\w+)\s*(?:\|\s*(\w+)\s*(?:\(\s*'([^']*)'\s*\))?\s*)?\}\}"
)


_PAYLOAD_FILTERS: dict[str, Any] = {
    "capitalize": lambda s: s[:1].upper() + s[1:] if s else s,
    "upper": str.upper,
    "lower": str.lower,
    "title": str.title,
}


def _payload_sub(match: re.Match[str], vars: dict[str, Any]) -> str:
    name, flt, arg = match.group(1), match.group(2), match.group(3)
    if name not in vars:
        # `default('x')` resolves even when the var is absent — that is its job.
        if flt == "default" and arg is not None:
            return arg
        return match.group(0)
    value = str(vars[name])
    if flt:
        if flt == "default":
            return value if value else (arg or "")
        fn = _PAYLOAD_FILTERS.get(flt)
        if fn is None:
            # Unknown filter — leave token verbatim so render-time Jinja can
            # handle it (or fail loudly). Keeps the regex pass conservative.
            return match.group(0)
        value = fn(value)
    return value


def interpolate_payload(obj: Any, vars: dict[str, Any]) -> Any:
    """Recursively replace `{{ var }}` and `{{ var | filter }}` placeholders
    inside a decision payload.

    Supports the small filter set used by arch-decision identifier templates:
    `capitalize`, `upper`, `lower`, `title`. Unknown vars OR unknown filters
    leave the token verbatim so downstream Jinja-rendered templates can still
    process them. Lists and dicts traversed recursively. Non-container leaves
    pass through unchanged.

    Promoted from render.py:_interpolate_payload so the same logic is reused
    by both the rendering pipeline and consumers like be-module-generator
    that need literal permission codes for comparison.
    """
    if isinstance(obj, str):
        return _PAYLOAD_VAR_RE.sub(lambda m: _payload_sub(m, vars), obj)
    if isinstance(obj, list):
        return [interpolate_payload(x, vars) for x in obj]
    if isinstance(obj, dict):
        return {k: interpolate_payload(v, vars) for k, v in obj.items()}
    return obj


# ── RBAC Phase 2 — derivation helpers (used by be-module-generator.py) ───────
# Maps from op-verb to Portuguese action and from module package to canonical
# 3-letter prefix. Kept here (instead of in the generator) so any consumer of
# RBAC decisions resolves permissions the same way. Phase 2 / D-059.

_OP_VERB_TO_ACTION: dict[str, str] = {
    # creation
    "create": "criar", "register": "criar", "add": "criar", "request": "criar",
    "open": "abrir", "start": "iniciar",
    "generate": "gerar", "consolidate": "consolidar", "submit": "enviar",
    "emit": "emitir", "issue": "emitir",
    # creation — PT-BR domain verbs (D-442)
    "importar": "importar", "registrar": "registrar",
    # creation — PT-BR primary verbs (D-465)
    "criar": "criar", "iniciar": "iniciar", "processar": "processar",
    "sugerir": "sugerir",
    # reading
    "get": "read", "list": "read", "find": "read", "consult": "read", "view": "read",
    # reading — PT-BR (D-442)
    "listby": "read",
    # reading — PT-BR primary verbs (D-465)
    "buscar": "read", "listar": "read", "verificar": "read",
    # update
    "update": "editar", "edit": "editar", "patch": "editar",
    "approve": "aprovar", "reject": "rejeitar",
    "move": "mover", "qualify": "qualificar", "discard": "descartar",
    "win": "ganhar", "lose": "perder",
    "pay": "pagar", "close": "fechar", "settle": "baixar",
    "renegotiate": "renegociar", "reverse": "estornar",
    # update — PT-BR domain verbs (D-442)
    "publicar": "publicar", "arquivar": "arquivar", "reordenar": "reordenar",
    "upload": "upload", "autoria": "gerar", "concluir": "concluir",
    # update — PT-BR primary verbs (D-465)
    "atualizar": "editar", "despublicar": "despublicar",
    # delete-ish
    "delete": "excluir", "remove": "excluir",
    "cancel": "cancelar", "revoke": "cancelar",
    # delete-ish — PT-BR (D-442)
    "revogar": "cancelar",
    # delete-ish — PT-BR primary verbs (D-465)
    "deletar": "excluir",
    # update — PT-BR domain verbs (D-466, candeeiro-so AUD module)
    "ativar": "ativar",
    # update — PT-BR domain verbs (D-467, candeeiro-so TIME module: alterarPapel, reenviar, aceitar)
    "alterar": "editar", "reenviar": "reenviar", "aceitar": "aceitar",
    # delete-ish — PT-BR verb (D-467, candeeiro-so TIME module: cancelar convite)
    "cancelar": "cancelar",
    # delete-ish — LGPD right-to-forget verb (D-466, candeeiro-so AUD module)
    "esquecer": "esquecer",
    # update — PT-BR domain verb (D-468, candeeiro-so AUTO module: pausarFluxo)
    "pausar": "pausar",
    # domain verbs (D-469, candeeiro-so AUTO module: spawnExecucao → iniciar, avancarExecucao → processar)
    "spawn": "iniciar", "avancar": "processar",
    # domain verbs (D-469, candeeiro-so AUTO module: upsertConsentProjection → editar, checkConsentGate → read, purgarContato → excluir)
    "upsert": "editar", "check": "read", "purgar": "excluir",
    # creation — PT-BR verb (D-470, candeeiro-so DATA module: gerarInsight → gerar)
    "gerar": "gerar",
    # update — PT-BR domain verb (D-470, candeeiro-so DATA module: recomputar → recomputar)
    "recomputar": "recomputar",
    # D-488 — LEAD module domain verbs (candeeiro-so LEAD module)
    "capturar": "capturar",     # capture lead into pipeline → CREATE
    "preview": "read",          # dry-run preview of import → READ
    "confirmar": "confirmar",   # confirm/finalize import job → UPDATE
    "obter": "read",            # get a resource by id → READ
    "qualificar": "qualificar", # qualify lead (state update) → UPDATE
    "recalcular": "recalcular", # recalculate maturity score → UPDATE
    "definir": "definir",       # define segment rule or consent → CREATE
    "reavaliar": "reavaliar",   # re-evaluate segment membership → UPDATE
    "anonimizar": "anonimizar", # LGPD anonymise lead data → UPDATE
    "expurgar": "expurgar",     # LGPD erasure of lead data → DELETE
    # D-490 — JRNY module domain verbs (candeeiro-so JRNY module)
    "save": "editar",           # saveEstagios = persist stage list (UPDATE)
    "publish": "publicar",      # publishVersion = publish a rule version (UPDATE)
    "desativar": "desativar",   # deactivate a routing rule (UPDATE)
    "rotear": "rotear",         # rotearAgora = execute routing decision (UPDATE)
    # D-489 — WRKS module session + workspace-lifecycle verbs (candeeiro-so WRKS module)
    # Session management (Keycloak-backed): login/trocar/refresh/logout/atual
    "login": "autenticar",      # initiate a session → CREATE
    "trocar": "editar",         # switch company context → UPDATE
    "refresh": "renovar",       # refresh access token → UPDATE
    "logout": "cancelar",       # terminate session → DELETE
    "atual": "read",            # get current session/user → READ
    # Workspace / tenant lifecycle
    "provisionar": "provisionar",  # provision a new empresa schema → CREATE
    "status": "read",           # get provisioning/domain status → READ
    "suspender": "suspender",   # suspend an empresa → UPDATE
    "reativar": "ativar",       # reactivate a suspended empresa → UPDATE
    "salvar": "editar",         # save/upsert a resource (marca, config) → UPDATE
    # Membership & RBAC
    "associar": "criar",        # associate a member to a workspace → CREATE
    "atribuir": "editar",       # assign roles/permissions → UPDATE
    # Model version & decision
    "versao": "read",           # get current access-model version → READ
    "decide": "read",           # evaluate an access decision → READ
    # D-495 — ASST module domain verbs (candeeiro-so ASST module)
    # Approval flow verbs
    "enviar": "enviar",         # enviarAprovacao = submit for approval → CREATE
    "aprovar": "aprovar",       # approve asset/review → UPDATE
    "rejeitar": "rejeitar",     # reject asset/review → UPDATE
    "retornar": "retornar",     # return for revision → UPDATE
    # Asset versioning verbs
    "restaurar": "restaurar",   # restore a previous version → UPDATE
    "diff": "read",             # compare two versions → READ
    # Asset Studio verb
    "diagnostico": "read",      # IA quality diagnostic → READ
    # D-510 — INTL module domain verbs (candeeiro-so Intelligence/Copilot module)
    "perguntar": "perguntar",   # submit a question in a conversation (Copilot) → CREATE
    "criticar": "criticar",     # add a critique/annotation to a conversation turn → CREATE
    "ingerir": "ingerir",       # ingest a document into the knowledge base → CREATE
    "editar": "editar",         # PT-BR direct verb for update (editarDocumento, etc.) → UPDATE
    # D-518 — COMM module domain verbs (candeeiro-so Communication module)
    "reply": "enviar",          # replyMessage = send a reply in a conversation → SEND
    "dispatch": "enviar",       # dispatchBatch = dispatch a batch send → SEND
    "proxima": "read",          # proximaAcao = get IA next recommended action → READ
    "copy": "criar",            # copyTemplate = copy-create a new template from existing → CREATE
    "desenhar": "gerar",        # desenharAutomacao = IA-generate an automation design → CREATE
    "handle": "processar",      # handleDeliveryStatus = process webhook delivery event → UPDATE
    # D-523 -- SALE module domain verbs (candeeiro-so Vendas/SDR module)
    "adiar": "adiar",           # adiar = postpone an opportunity follow-up → UPDATE
    "mover": "mover",           # moverEstagio = move opportunity to another stage → UPDATE
    # D-524 -- CAMP module domain verbs (candeeiro-so Campanhas module)
    "encerrar": "encerrar",     # encerrar = end/close a campaign → UPDATE state
    "configurar": "editar",     # configurarPixel = configure pixel settings → UPDATE
    "conectar": "conectar",     # conectar = establish ad platform connection → CREATE
    "reconectar": "reconectar", # reconectar = reconnect after error → UPDATE
    "desconectar": "desconectar", # desconectar = disconnect ad platform → UPDATE
    "sincronizar": "sincronizar", # sincronizar = sync metrics from ad platform → UPDATE
    "analisar": "analisar",     # analisarCampanha = IA campaign analysis → CREATE
    # D-525 — GROW module verbs (candeeiro-so Growth/Super-admin module)
    "provision": "provisionar",  # provision = create a new tenant → CREATE
    "change": "alterar",         # changePlan = change subscription plan → UPDATE
    "suspend": "suspender",      # suspend = suspend a tenant → UPDATE
    "reactivate": "ativar",      # reactivate = reactivate a suspended tenant → UPDATE
    "mark": "marcar",            # markInvoicePaid = mark invoice as paid → UPDATE
    "replay": "reprocessar",     # replay = replay event stream for read model → READ
    "resolve": "resolver",       # resolve = resolve an expansion opportunity → UPDATE
    # D-530 — GEST module domain verbs (neuroassist-ai GEST module)
    "transition": "editar",      # transitionState = drive state-machine transition → UPDATE
    "pull": "read",              # pullByDevice = edge device fetches active profile → READ
    "validate": "read",          # validateReport = validate incoming recognition report → READ
    # D-531 — EVNT module domain verbs (neuroassist-ai EVNT module)
    "ingest": "ingerir",         # ingestReport = receive/create Evento from edge report → CREATE
    "confirm": "confirmar",      # confirm = caregiver verdict on an Evento (real/falso_positivo) → UPDATE
    "acknowledge": "confirmar",  # acknowledgeDispatch = caregiver acks delivered notification → UPDATE
    "orchestrate": "processar",  # orchestrate = drive urgency-tiered notification dispatch → CREATE
    "retry": "reprocessar",      # retrySweep = reprocess failed/queued notification dispatches → UPDATE
    # D-532 — PAC module domain verbs (neuroassist-ai PAC module)
    "recalibrate": "recalibrar",  # recalibrate = adjust command sensitivity/timing thresholds → UPDATE
    "retire": "aposentar",        # retire = transition a published Comando to retired state → UPDATE
    # D-533 — EDGE module domain verbs (neuroassist-ai EDGE module)
    "enroll": "criar",     # enroll = complete device enrollment (exchange token for credential) → CREATE
    "pair": "criar",       # pair = bind device to patient (create exclusive pairing) → CREATE
    "unpair": "excluir",   # unpair = remove active pairing (DELETE pairing) → DELETE
    "record": "criar",     # recordHeartbeat = persist heartbeat event → CREATE
    "evaluate": "read",    # evaluate = compute device liveness state at query time → READ
    "current": "read",     # currentPointerForTenant = fetch active detection-profile pointer → READ
    # D-535 — ACS module domain verbs (neuroassist-ai ACS module — auth authority + tenant provisioning)
    "authenticate": "autenticar",  # authenticate = credential validation + JWT issuance → CREATE
    "deactivate": "desativar",     # deactivate = soft-deactivate a caregiver account → UPDATE
    "link": "vincular",            # link = create caregiver↔patient link (anchor event) → CREATE
    # D-539 — HIST module domain verbs (neuroassist-ai HIST/Audit module)
    "append": "registrar",         # append = write-once append to immutable audit ledger → CREATE
    "query": "read",               # query = paginated timeline query (queryTimeline) → READ
    "verify": "read",              # verify = hash-chain integrity check (verifyStream) → READ
    # D-540 — DASH module domain verbs (neuroassist-ai DASH BFF module)
    "compose": "read",    # compose = BFF aggregation read (composeSummary, composePatientOverview) → READ
    "poll": "read",       # poll = notification polling (pollUnacknowledged) → READ
    "long": "read",       # long = longPoll verb prefix (re.match ^[a-z]+) → READ
    "heartbeat": "criar", # heartbeat = SSE keep-alive tick (creates heartbeat event) → CREATE
    # NB: `close` (closeSession → fechar) is already mapped in the D-4xx block
    # above with the same value; re-declaring it here was redundant, not a
    # different meaning.
}

_ACTION_TO_CRUD: dict[str, str] = {
    "criar": "CREATE", "abrir": "CREATE", "iniciar": "CREATE", "gerar": "CREATE",
    "emitir": "CREATE", "enviar": "CREATE",
    # D-442 — PT-BR creation actions
    "importar": "CREATE", "registrar": "CREATE",
    # D-465 — PT-BR creation actions (candeeiro-so DIST module)
    "processar": "CREATE", "sugerir": "CREATE",
    "read": "READ",
    "editar": "UPDATE", "mover": "UPDATE", "qualificar": "UPDATE",
    "aprovar": "UPDATE", "rejeitar": "UPDATE", "pagar": "UPDATE",
    "fechar": "UPDATE", "descartar": "UPDATE", "ganhar": "UPDATE",
    "perder": "UPDATE", "baixar": "UPDATE", "renegociar": "UPDATE",
    "estornar": "UPDATE", "consolidar": "UPDATE",
    # D-442 — PT-BR update actions
    "publicar": "UPDATE", "arquivar": "UPDATE", "reordenar": "UPDATE",
    "upload": "UPDATE", "concluir": "UPDATE",
    # D-465 — PT-BR update actions (candeeiro-so DIST module)
    "despublicar": "UPDATE",
    # D-466 — AUD module domain actions (candeeiro-so)
    "ativar": "UPDATE",
    # D-467 — TIME module domain actions (candeeiro-so)
    "reenviar": "UPDATE", "aceitar": "UPDATE", "cancelar": "DELETE",
    "excluir": "DELETE",
    # D-466 — LGPD erasure action (candeeiro-so AUD module)
    "esquecer": "DELETE",
    # D-468 — AUTO module domain action (candeeiro-so)
    "pausar": "UPDATE",
    # D-470 — DATA module domain actions (candeeiro-so)
    "recomputar": "UPDATE",
    # D-488 — LEAD module domain actions (candeeiro-so LEAD module)
    "capturar": "CREATE",
    "confirmar": "UPDATE",
    "recalcular": "UPDATE",
    "definir": "CREATE",
    "reavaliar": "UPDATE",
    "anonimizar": "UPDATE",
    "expurgar": "DELETE",
    # D-490 — JRNY module domain actions (candeeiro-so JRNY module)
    "desativar": "UPDATE",     # deactivate routing rule → state update
    "rotear": "UPDATE",        # execute routing decision → state update
    # D-489 — WRKS module domain actions (candeeiro-so WRKS module)
    "autenticar": "CREATE",    # login → creates a session
    "renovar": "UPDATE",       # refresh token → updates session
    "provisionar": "CREATE",   # provision tenant schema → creates resources
    "suspender": "UPDATE",     # suspend empresa → state update
    # D-495 — ASST module approval/versioning actions (candeeiro-so ASST module)
    # Note: "enviar" → "CREATE" already declared above (line 1612); no duplicate needed.
    "retornar": "UPDATE",      # return for revision → state update
    "restaurar": "UPDATE",     # restore a previous version → state update
    # D-524 -- CAMP module domain actions (candeeiro-so Campanhas module)
    "encerrar": "UPDATE",    # end/close a campaign → state update
    "conectar": "CREATE",    # establish ad platform connection → CREATE
    "reconectar": "UPDATE",  # reconnect after error → state update
    "desconectar": "UPDATE", # disconnect ad platform → state update
    "sincronizar": "UPDATE", # sync metrics from ad platform → UPDATE
    "analisar": "CREATE",    # IA campaign analysis → generates result
    # D-525 — GROW module actions (candeeiro-so Growth/Super-admin module)
    "alterar": "UPDATE",     # changePlan → state update
    "marcar": "UPDATE",      # markInvoicePaid → mark invoice paid
    "reprocessar": "READ",   # replay read model → read/reconstruct
    "resolver": "UPDATE",    # resolve expansion opportunity → state update
    # D-532 — PAC module domain actions (neuroassist-ai PAC module)
    "recalibrar": "UPDATE",  # adjust command sensitivity/timing thresholds → state update
    "aposentar": "UPDATE",   # retire/deactivate a published Comando → state update
}

_MODULE_PREFIX_MAP: dict[str, str] = {
    "comercial": "com",
    "cadastros": "cad",
    "estoque": "est",
    "financeiro": "fin",
    "fiscal": "fis",
    "logistica": "log",
    "crm": "crm",
    "rtc": "rtc",
    "iam": "iam",
    "gateway": "adm",
    "administracao": "adm",
    # candeeiro-so modules (D-465)
    "distribuicao": "dist",
    "produto": "pro",
    "colaboradores": "time",
    "audiencia": "aud",
    "automacao": "auto",
    "analytics": "data",
}


def resolve_module_prefix(
    package_segment: str,
    modules: list[dict[str, Any]] | None = None,
) -> str:
    """Map last package segment (e.g. 'comercial') to its canonical prefix
    used in permission codes ('com'). D-078: consult
    project-context.modules.registry first when available, so each project
    can declare its own modules without depending on the workspace's
    hardcoded BOSQ-ERP map.

    Resolution order:
      1. `modules[?packageSuffix==<seg>].prefix.lower()` — explicit match
      2. `modules[?prefix.lower()==<seg>].prefix.lower()` — segment is
         already the lowercase prefix (e.g. `com.bosq.ops` matches OPS)
      3. `modules[?slug(displayName)==<seg>].prefix.lower()` — segment is
         the slugified displayName (e.g. `com.bosq.operations` matches
         displayName "Operations" → prefix "OPS")
      4. `_MODULE_PREFIX_MAP[<seg>]` — legacy BOSQ-ERP fallback
      5. `<seg>[:3].lower()` — last resort
    """
    seg = package_segment.lower()
    if modules:
        # 1. Explicit packageSuffix.
        for m in modules:
            if (m.get("packageSuffix") or "").lower() == seg:
                p = (m.get("prefix") or "").lower()
                if p:
                    return p
        # 2. prefix.lower() match.
        for m in modules:
            if (m.get("prefix") or "").lower() == seg:
                return seg
        # 3. Slug of displayName match (lowercase, spaces/punct → hyphens).
        for m in modules:
            display = (m.get("displayName") or "")
            slug = re.sub(r"[^a-z0-9]+", "-", display.lower()).strip("-")
            if slug == seg or slug.replace("-", "") == seg:
                p = (m.get("prefix") or "").lower()
                if p:
                    return p
    if seg in _MODULE_PREFIX_MAP:
        return _MODULE_PREFIX_MAP[seg]
    return seg[:3]


def resolve_action(op_name: str) -> str | None:
    """Map a camelCase operation name (e.g. 'createOrcamento') to its
    Portuguese action ('criar'). Returns None when the verb prefix is unknown
    so callers can fail explicitly instead of silently emitting a fallback
    permission code (D-060 hardening).
    """
    m = re.match(r"^([a-z]+)", op_name)
    verb = m.group(1) if m else op_name.lower()
    return _OP_VERB_TO_ACTION.get(verb)


def resolve_permission(op_name: str, module_prefix: str,
                       resource_kebab: str) -> str | None:
    """Compose the canonical permission code from op + module + resource, or
    return None when the op's verb has no mapping in `_OP_VERB_TO_ACTION`.

    Example: ('createOrcamento', 'com', 'orcamento') -> 'com.orcamento.criar'.
    """
    action = resolve_action(op_name)
    if action is None:
        return None
    return f"{module_prefix}.{resource_kebab}.{action}"


def resolve_audit_action(op_name: str, resource_kebab: str,
                         audit_required: list[str] | None) -> str | None:
    """Return the audit action string (e.g. 'CREATE_ORCAMENTO') if this op
    requires auditing, else None. `audit_required` comes from
    rbac.enforcement.audit_required.
    """
    if not audit_required:
        return None
    action = resolve_action(op_name)
    if action is None:
        return None
    crud = _ACTION_TO_CRUD.get(action)
    if not crud or crud not in audit_required:
        return None
    resource_token = resource_kebab.upper().replace("-", "_")
    return f"{crud}_{resource_token}"


def list_explicit_permissions(rbac: dict[str, Any]) -> set[str]:
    """Flatten every `kind: list` permission_bundle into a set of permission
    codes (wildcards stripped). Used for soft validation: emit a warning when
    the generator derives a code that doesn't appear anywhere in roles.

    Note: roles with `all` / `exclude_patterns` / `match_pattern` are skipped
    because they refer to a permission catalogue we haven't formalized yet.
    A `*` in a list entry is also skipped.
    """
    out: set[str] = set()
    for role in rbac.get("roles", []):
        pb = role.get("permission_bundle", {})
        if pb.get("kind") != "list":
            continue
        for perm in pb.get("permissions", []):
            code = perm.get("code", "")
            if code and "*" not in code:
                out.add(code)
    return out


# ── CLI ──────────────────────────────────────────────────────────────────────


def cmd_list(args: argparse.Namespace) -> int:
    ws = find_workspace_root(args.workspace)
    aspects = list_aspects(ws)
    if not aspects:
        print(f"(no decisions found under {decisions_dir(ws)})", file=sys.stderr)
        return 0
    for a in aspects:
        print(a)
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    ws = find_workspace_root(args.workspace)
    try:
        payload = load_decision(args.aspect, ws)
    except (FileNotFoundError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    ws = find_workspace_root(args.workspace)
    aspects = [args.aspect] if args.aspect else list_aspects(ws)
    if not aspects:
        print(f"(no decisions found under {decisions_dir(ws)})", file=sys.stderr)
        return 0

    total_issues = 0
    for aspect in aspects:
        try:
            payload = load_decision(aspect, ws)
        except (FileNotFoundError, ValueError) as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        issues = validate_decision(aspect, payload)
        if issues:
            print(f"{aspect}: {len(issues)} issue(s)", file=sys.stderr)
            for it in issues:
                print(f"  - {it}", file=sys.stderr)
            total_issues += len(issues)
        else:
            print(f"OK: {aspect} valid")
    return 2 if total_issues else 0


def cmd_cross_validate(args: argparse.Namespace) -> int:
    """Cross-validate aspects against each other and against project-context (D-083).

    Runs the cross-validators that are *not* covered by `validate` (structural):
      - registry ↔ permission-catalogue (D-083)
      - multi-tenancy ↔ project-context (D-063)
      - entity-scope ↔ rbac (D-062)
      - rbac ↔ permission-catalogue (D-060)
      - events ↔ multi-tenancy (D-067)

    Each pair runs only when both sides are present (loaders that fail are
    treated as "absent" rather than fatal — keeps the command usable in the
    workspace where there is no project-context).
    """
    ws = find_workspace_root(args.workspace)

    def safe_load(aspect: str) -> dict[str, Any] | None:
        try:
            return load_decision(aspect, ws)
        except (FileNotFoundError, ValueError):
            return None

    project_context: dict[str, Any] | None = None
    if args.project_context:
        try:
            project_context = json.loads(
                Path(args.project_context).read_text(encoding="utf-8")
            )
        except (FileNotFoundError, ValueError, OSError) as e:
            print(f"error: --project-context {e}", file=sys.stderr)
            return 1

    rbac = safe_load("rbac")
    catalogue = safe_load("permission-catalogue")
    entity_scope = safe_load("entity-scope")
    multi_tenancy = safe_load("multi-tenancy")
    events = safe_load("events")

    checks: list[tuple[str, list[str]]] = []
    if project_context and catalogue:
        checks.append((
            "registry ↔ permission-catalogue",
            cross_validate_registry_against_catalogue(project_context, catalogue),
        ))
    if project_context and multi_tenancy:
        checks.append((
            "multi-tenancy ↔ project-context",
            cross_validate_multi_tenancy_against_context(multi_tenancy, project_context),
        ))
    if entity_scope and rbac:
        checks.append((
            "entity-scope ↔ rbac",
            cross_validate_entity_scope_against_rbac(entity_scope, rbac),
        ))
    if rbac and catalogue:
        checks.append((
            "rbac ↔ permission-catalogue",
            cross_validate_rbac_against_catalogue(rbac, catalogue),
        ))
    if events and multi_tenancy:
        checks.append((
            "events ↔ multi-tenancy",
            cross_validate_events_against_multi_tenancy(events, multi_tenancy),
        ))

    if not checks:
        print("(no cross-validation pairs available — both sides must be present)",
              file=sys.stderr)
        return 0

    total = 0
    for name, issues in checks:
        if issues:
            print(f"{name}: {len(issues)} issue(s)", file=sys.stderr)
            for it in issues:
                print(f"  - {it}", file=sys.stderr)
            total += len(issues)
        else:
            print(f"OK: {name} consistent")
    return 2 if total else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="arch_decisions.py",
        description="Load and validate architectural decision JSON files (D-058).",
    )
    parser.add_argument("--workspace", type=Path, default=None,
                        help="Path to workspace (default: $TECHLAB_ARCH_HOME or walk up)")
    sub = parser.add_subparsers(dest="command")

    p_l = sub.add_parser("list", help="List available aspects")
    p_l.set_defaults(func=cmd_list)

    p_s = sub.add_parser("show", help="Print parsed JSON for an aspect")
    p_s.add_argument("--aspect", required=True)
    p_s.set_defaults(func=cmd_show)

    p_v = sub.add_parser("validate", help="Structurally validate one or all aspects")
    p_v.add_argument("--aspect", default=None,
                     help="Validate just this aspect (default: all)")
    p_v.set_defaults(func=cmd_validate)

    p_x = sub.add_parser(
        "cross-validate",
        help="Cross-validate aspects against each other and project-context (D-083)",
    )
    p_x.add_argument(
        "--project-context",
        type=Path,
        default=None,
        help="Path to project-context.json (enables registry ↔ catalogue + "
             "multi-tenancy ↔ context checks)",
    )
    p_x.set_defaults(func=cmd_cross_validate)

    return parser


def main(argv: list[str] | None = None) -> int:
    from cli_utils import force_utf8_stdio
    force_utf8_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return 1
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
