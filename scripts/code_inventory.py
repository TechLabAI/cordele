#!/usr/bin/env python3
"""code_inventory.py -- shared deterministic code-inventory helpers (D-319).

Foundation module for the script-parity pipeline (D-316). Centralizes the
file-presence / stub-detection / path-extraction / lib-inventory logic so
the pipeline scripts share ONE implementation instead of N copies:

    - validator-score.py     (D-317) -- scan_presence, is_stub, extract_paths
    - plan-state-extractor.py (D-319) -- scan_presence, is_stub
    - fe-discover-scan.py    (D-320) -- inventory
    - spec-delta-diff.py     (D-321) -- inventory

Importable by sibling scripts: `from code_inventory import is_stub, ...`
(Python adds the script directory to sys.path when run as a program.)

This module has NO CLI of its own -- it is a pure library. R3 applies to the
scripts that import it.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

# ── Stub detection ───────────────────────────────────────────────────────────

# Effective code = lines that are not blank, not a comment, not an import.
# Below this many effective chars a source file is treated as an unfilled stub.
_STUB_MAX_EFFECTIVE = 40

# Strong textual signals of an unfilled scaffold (case-insensitive substring).
_STUB_SIGNATURES = (
    "works!",                       # @nx/angular default component template
    "not implemented",
    "throw new error('not implemented",
    "todo[lote-",                   # techlab stub header (R5 stub strategy)
    "todo[agent]",                  # backlog-gen skeleton marker (D-318)
)

_COMMENT_LINE = re.compile(r"^\s*(//|#|\*|/\*|\*/|<!--|-->)")
_IMPORT_LINE = re.compile(r"^\s*(import|package|from)\b")
_EMPTY_CLASS = re.compile(r"\bclass\s+\w+[^{]*\{\s*\}", re.DOTALL)


def is_stub(path: Path) -> bool:
    """Heuristic: does this *existing* file look like an unfilled stub?

    Conservative by design -- only returns True on strong signals so a real
    file is never misclassified as a stub. The caller must ensure the file
    exists (a missing file is "MISSING", not a stub).
    """
    try:
        text = Path(path).read_text(encoding="utf-8", errors="replace")
    except (OSError, UnicodeError):
        return False

    stripped = text.strip()
    if not stripped:
        return True

    low = stripped.lower()
    if any(sig in low for sig in _STUB_SIGNATURES):
        return True

    effective = [
        s for line in text.splitlines()
        if (s := line.strip())
        and not _COMMENT_LINE.match(s)
        and not _IMPORT_LINE.match(s)
    ]
    effective_len = len("".join(effective))
    if effective_len < _STUB_MAX_EFFECTIVE:
        return True
    # An empty class body (`class Foo {}`) is only a stub signal on its own
    # when the file otherwise has little content. NestJS/Angular decorated
    # classes (`@Module({...}) export class FooModule {}`) legitimately keep
    # an empty body -- all the real content lives in the decorator args --
    # so require it alongside low effective content, not standalone.
    if _EMPTY_CLASS.search(text) and effective_len < _STUB_MAX_EFFECTIVE * 4:
        return True
    return False


# ── Presence scan ────────────────────────────────────────────────────────────

def scan_presence(paths, root: Path, bases=None) -> dict:
    """Report existence / size / stub for each path (relative to root or absolute).

    Issue checklists cite paths relative to the unit that owns them -- a service
    root such as ``backend/services/proj-service/`` -- not to the repo root, so
    ``bases`` supplies the extra prefixes to try before declaring a file absent.

    Returns ``{path_str: {"exists": bool, "size": int, "isStub": bool}}``.
    Read-only: never touches the filesystem beyond ``stat``/``read``.
    """
    root = Path(root)
    candidates = [root] + [root / b if not Path(b).is_absolute() else Path(b)
                           for b in (bases or [])]
    # Issues abbreviate sibling files: `dir/a.ts`, `b.ts`, `c.ts` -- the bare
    # names belong to the directory named by the first fully-qualified path.
    siblings = [Path(q).parent for q in paths if "/" in str(q)]
    result: dict[str, dict] = {}
    for raw in paths:
        p = Path(raw)
        full = None
        if p.is_absolute():
            full = p if p.is_file() else None
        else:
            tries = [c / p for c in candidates]
            if "/" not in str(raw):
                tries += [c / s / p for c in candidates for s in siblings]
            full = next((f for f in tries if f.is_file()), None)
            # Bare filename not found at root/base or a cited sibling dir --
            # last resort: bounded recursive search under each base (issues
            # sometimes cite a bare filename with no directory context at
            # all, e.g. "`comp.tokens.ts`" instead of the fully-qualified
            # path already cited elsewhere in the same checklist).
            if full is None and "/" not in str(raw):
                full = next(
                    (f for c in candidates if c.is_dir()
                     for f in c.rglob(str(p)) if f.is_file()),
                    None,
                )
        if full is not None:
            result[str(raw)] = {
                "exists": True,
                "size": full.stat().st_size,
                "isStub": is_stub(full),
            }
        else:
            result[str(raw)] = {"exists": False, "size": 0, "isStub": False}
    return result


# ── Path extraction (from prose / checklist items) ───────────────────────────

_BACKTICKED = re.compile(r"`([^`]+)`")
_PATH_LIKE = re.compile(r"^[\w\-./]+\.[A-Za-z0-9]+$")
_KNOWN_EXT = (
    ".ts", ".tsx", ".java", ".py", ".scss", ".css", ".html",
    ".yml", ".yaml", ".json", ".kts", ".gradle", ".sql", ".feature",
)


def extract_paths(text: str) -> list[str]:
    """Pull file-path-looking tokens out of a checklist item / sentence.

    Looks inside backticks (the convention in issue specs) for tokens that
    end in a known source extension. Splits multi-token backticks (commands)
    and keeps order, de-duplicated.
    """
    out: list[str] = []
    seen: set[str] = set()
    for m in _BACKTICKED.finditer(text):
        for part in m.group(1).split():
            part = part.strip().strip(",;")
            if not part or part in seen:
                continue
            if _PATH_LIKE.match(part) and (
                "/" in part or part.endswith(_KNOWN_EXT)
            ):
                seen.add(part)
                out.append(part)
    return out


# ── Lib / component inventory (D-320) ────────────────────────────────────────

_EXPORT_CLASS = re.compile(r"\bexport\s+class\s+(\w+)")
_ROUTE_PATH = re.compile(r"""\bpath\s*:\s*['"]([^'"]*)['"]""")


@dataclass
class LibInfo:
    name: str
    type: str = ""
    scope: str = ""
    tags: list[str] = field(default_factory=list)
    components: list[str] = field(default_factory=list)
    services: list[str] = field(default_factory=list)
    facades: list[str] = field(default_factory=list)
    routes: list[str] = field(default_factory=list)


def _classes_in(path: Path) -> list[str]:
    try:
        return _EXPORT_CLASS.findall(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, UnicodeError):
        return []


def _scan_fe_lib(lib_dir: Path) -> LibInfo:
    info = LibInfo(name=lib_dir.name)
    pj = lib_dir / "project.json"
    if pj.is_file():
        try:
            data = json.loads(pj.read_text(encoding="utf-8", errors="replace"))
            info.tags = list(data.get("tags", []))
        except (OSError, UnicodeError, json.JSONDecodeError):
            pass
    for tag in info.tags:
        if tag.startswith("type:"):
            info.type = tag.split(":", 1)[1]
        elif tag.startswith("scope:"):
            info.scope = tag.split(":", 1)[1]
    for f in lib_dir.rglob("*.component.ts"):
        info.components.extend(_classes_in(f))
    for f in lib_dir.rglob("*.facade.ts"):
        info.facades.extend(_classes_in(f))
    for f in lib_dir.rglob("*.service.ts"):
        info.services.extend(_classes_in(f))
    for f in lib_dir.rglob("*.routes.ts"):
        try:
            txt = f.read_text(encoding="utf-8", errors="replace")
            info.routes.extend(p for p in _ROUTE_PATH.findall(txt) if p)
        except (OSError, UnicodeError):
            pass
    return info


_BE_ANN = {
    "controllers": re.compile(r"@(?:RestController|Controller)\b"),
    "entities": re.compile(r"@Entity\b"),
    "services": re.compile(r"@Service\b"),
    "repositories": re.compile(r"@Repository\b|\bextends\s+JpaRepository\b"),
}
_BE_ENDPOINT = re.compile(r"@(?:Get|Post|Put|Delete|Patch)Mapping\b")
_BE_CLASS = re.compile(r"\b(?:class|interface|enum|record)\s+(\w+)")


def _scan_be_service(service_dir: Path) -> dict:
    """Inventory one backend service dir: classes by annotation + endpoint count."""
    inv = {k: [] for k in _BE_ANN}
    classes = endpoints = 0
    for f in service_dir.rglob("*.java"):
        if "build" in f.parts or "target" in f.parts:
            continue
        try:
            txt = f.read_text(encoding="utf-8", errors="replace")
        except (OSError, UnicodeError):
            continue
        classes += 1
        endpoints += len(_BE_ENDPOINT.findall(txt))
        cm = _BE_CLASS.search(txt)
        name = cm.group(1) if cm else f.stem
        for kind, pat in _BE_ANN.items():
            if pat.search(txt):
                inv[kind].append(name)
    return {
        "name": service_dir.name, "classes": classes, "endpoints": endpoints,
        **{k: sorted(set(v)) for k, v in inv.items()},
    }


def inventory(root: Path, layer: str = "fe", module: str | None = None) -> dict:
    """Deterministic inventory of existing code (D-320; BE branch: D-374 follow-up).

    FE: scans ``frontend/libs/<module>/*`` (or all modules) for libs + their
    components/services/facades/tags/routes.
    BE: scans ``backend/services/<service>`` (or all) for java classes by
    annotation (controllers/entities/services/repositories) + endpoint count.
    Returns a JSON-ready dict.
    """
    root = Path(root)
    if layer != "fe":
        svc_root = root / "backend" / "services"
        if module:
            dirs = [svc_root / module]
        elif svc_root.is_dir():
            dirs = [d for d in svc_root.iterdir() if d.is_dir()]
        else:
            dirs = []
        services = [_scan_be_service(d) for d in dirs if d.is_dir()]
        return {"module": module, "layer": "be", "services": services}

    libs_root = root / "frontend" / "libs"
    libs: list[LibInfo] = []
    module_dirs = (
        [libs_root / module] if module else
        [d for d in libs_root.iterdir() if d.is_dir()] if libs_root.is_dir() else []
    )
    for mdir in module_dirs:
        if not mdir.is_dir():
            continue
        for sublib in mdir.iterdir():
            if sublib.is_dir() and (sublib / "project.json").is_file():
                libs.append(_scan_fe_lib(sublib))

    return {
        "module": module,
        "layer": "fe",
        "libs": [asdict(li) for li in libs],
    }
