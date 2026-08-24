"""ears_parser.py — permissive EARS clause extraction for the BOSQ spec dialect.

The strict validator in scripts/be-validate-ears.py requires
"THE SYSTEM SHALL". Real BOSQ specs (e.g.
docs/architecture/backend/services/obras-service/spec/backend/SPEC-01-api-surface.md)
use a relaxed form:

  **SHALL** return HTTP 201 ...
  **WHEN** the obra is persisted, the system **SHALL** publish ...
  **IF** `nome` is blank, **THEN** the system **SHALL** return ...

This parser is broader than be-validate-ears.py by design (D-160): it
must accept the prose that exists today.

For S5 we don't care which sub-pattern a clause matches strictly — we care
about the raw text and structured triggers. The comparator (Fase E) reuses
this text + per-rule regex from code-mapping.arch.json to classify drift.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path


@dataclass
class EarsClause:
    """One EARS-like clause found in a markdown spec."""

    pattern_type: str  # "ubiquitous" | "event" | "state" | "optional" | "unwanted" | "loose"
    raw_text: str  # complete original line (or paragraph) for the clause
    normalized_text: str  # raw_text with markdown emphasis (`**`, `*`, `_`) stripped
    trigger: str | None = None  # WHEN/IF predicate, if matched
    state: str | None = None  # WHILE predicate, if matched
    feature: str | None = None  # WHERE predicate, if matched
    response: str | None = None  # post-SHALL fragment
    file: str | None = None
    line: int | None = None
    list_marker: str | None = None  # "1.", "-", "*", etc.

    def __str__(self) -> str:  # pragma: no cover - debug
        return f"[{self.pattern_type}] {self.normalized_text}"


# ── Recognition ─────────────────────────────────────────────────────────────


# permissive: accepts SHALL alone, "the system SHALL", "THE SYSTEM SHALL"
_SHALL = r"(?:THE\s+SYSTEM\s+|the\s+system\s+)?SHALL(?:\s+NOT)?"

_PATTERNS = [
    (
        "unwanted",
        re.compile(
            rf"^IF\s+(?P<trigger>.+?),\s+THEN\s+(?:the\s+system\s+)?{_SHALL}\s+(?P<response>.+?)$",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "event",
        re.compile(
            rf"^WHEN\s+(?P<trigger>.+?),\s+(?:the\s+system\s+)?{_SHALL}\s+(?P<response>.+?)$",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "state",
        re.compile(
            rf"^WHILE\s+(?P<state>.+?),\s+(?:the\s+system\s+)?{_SHALL}\s+(?P<response>.+?)$",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "optional",
        re.compile(
            rf"^WHERE\s+(?P<feature>.+?)\s+{_SHALL}\s+(?P<response>.+?)$",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "ubiquitous",
        re.compile(
            r"^(?:THE\s+SYSTEM\s+|the\s+system\s+)?SHALL(?:\s+NOT)?\s+(?P<response>.+?)$",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
]


_LIST_RX = re.compile(r"^(\s*)(?P<marker>[-*+]|\d+[.)])\s+(?P<rest>.*)$")
_EMPHASIS_RX = re.compile(r"\*{1,3}([^*]+)\*{1,3}|_{1,3}([^_]+)_{1,3}")


def _strip_markdown(text: str) -> str:
    """Remove bold/italic emphasis markers; preserve inline-code backticks
    (downstream rules anchor field identifiers on backticks)."""
    def repl(m: re.Match) -> str:
        return next((g for g in m.groups() if g is not None), "")

    return _EMPHASIS_RX.sub(repl, text).strip()


def _classify(line: str) -> EarsClause | None:
    norm = _strip_markdown(line)
    if not norm:
        return None
    # Must contain SHALL (any casing) to be considered an EARS clause
    if not re.search(r"\bSHALL\b", norm, re.IGNORECASE):
        return None
    for ptype, rx in _PATTERNS:
        m = rx.match(norm)
        if m:
            gd = m.groupdict()
            return EarsClause(
                pattern_type=ptype,
                raw_text=line,
                normalized_text=norm,
                trigger=gd.get("trigger"),
                state=gd.get("state"),
                feature=gd.get("feature"),
                response=gd.get("response"),
            )
    # Loose: contains SHALL but doesn't match any structured pattern
    return EarsClause(
        pattern_type="loose",
        raw_text=line,
        normalized_text=norm,
        response=norm,
    )


# ── Per-file walk ───────────────────────────────────────────────────────────


def _iter_logical_lines(text: str) -> Iterator[tuple[int, str, str | None]]:
    """Yield (line_number, content, list_marker).

    Joins continuation lines: a list item that wraps onto the next indented
    line is returned as a single content string. Headers and blank lines act
    as separators.
    """
    lines = text.splitlines()
    buf: list[str] = []
    buf_start = 0
    buf_marker: str | None = None
    in_code = False
    for idx, raw in enumerate(lines, start=1):
        stripped = raw.rstrip()
        if stripped.startswith("```"):
            in_code = not in_code
            if buf:
                yield buf_start, " ".join(buf).strip(), buf_marker
                buf = []
                buf_marker = None
            continue
        if in_code:
            continue
        if not stripped.strip():
            if buf:
                yield buf_start, " ".join(buf).strip(), buf_marker
                buf = []
                buf_marker = None
            continue
        if stripped.lstrip().startswith("#"):
            if buf:
                yield buf_start, " ".join(buf).strip(), buf_marker
                buf = []
                buf_marker = None
            continue
        m = _LIST_RX.match(stripped)
        if m:
            if buf:
                yield buf_start, " ".join(buf).strip(), buf_marker
            buf = [m.group("rest")]
            buf_start = idx
            buf_marker = m.group("marker")
        else:
            # continuation of previous item (indented or plain)
            if buf:
                buf.append(stripped.strip())
            else:
                buf = [stripped.strip()]
                buf_start = idx
                buf_marker = None
    if buf:
        yield buf_start, " ".join(buf).strip(), buf_marker


def parse_ears(path: Path) -> list[EarsClause]:
    """Parse one markdown file, return EARS clauses (including loose)."""
    text = path.read_text(encoding="utf-8")
    out: list[EarsClause] = []
    file_str = str(path)
    for lineno, content, marker in _iter_logical_lines(text):
        clause = _classify(content)
        if clause is None:
            continue
        clause.file = file_str
        clause.line = lineno
        clause.list_marker = marker
        out.append(clause)
    return out


def parse_ears_tree(root: Path, glob: str = "**/*.md") -> list[EarsClause]:
    """Parse every markdown under root matching glob, aggregating clauses."""
    out: list[EarsClause] = []
    if not root.exists():
        return out
    for md in sorted(root.rglob(glob.removeprefix("**/"))):
        if md.is_file():
            out.extend(parse_ears(md))
    return out
