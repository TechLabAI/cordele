"""reverser.py — code-to-spec proposal engine for living-specs bidirecional (D-204, D-205).

Given a git diff, detects new REST endpoints (and optionally new entity fields or
port methods) that have no corresponding EARS clause in the spec, and produces
draft EARS clauses ready for human review.

Workflow:
  1. ``detect_code_additions(git_diff)``  — parses unified diff, yields CodeAddition list
  2. ``propose_ears_clause(addition)``    — templates a draft EARS clause per addition
  3. ``format_proposal_doc(module, ...)`` — assembles the Markdown proposal file
  4. ``apply_approved_clauses(...)``      — patches spec files with ``- [x]`` lines
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

# ── Data shapes ─────────────────────────────────────────────────────────────


@dataclass
class CodeAddition:
    """A new code element detected in a git diff that may need a spec clause."""

    kind: str  # "endpoint" | "field" | "method"
    http_method: str | None = None  # GET / POST / PUT / PATCH / DELETE
    path: str | None = None  # e.g. /v1/perdas or /v1/perdas/{id}
    class_name: str = ""
    member_name: str = ""
    file: str = ""
    diff_hunk: str = ""  # raw hunk for context in the proposal doc


@dataclass
class SpecProposal:
    """One proposed EARS clause tied to a CodeAddition."""

    addition: CodeAddition
    clauses: list[str] = field(default_factory=list)  # one or more draft clauses


# ── Git diff parsing ────────────────────────────────────────────────────────

_FILE_HEADER_RX = re.compile(r"^\+\+\+ b/(.+)$")
_HUNK_HEADER_RX = re.compile(r"^@@[^@]*@@ ?(.*)$")

_HTTP_MAPPING_RX = re.compile(
    r"^\+\s*@(Get|Post|Put|Patch|Delete)Mapping(?:\((?:value\s*=\s*)?\"([^\"]*)\"\))?",
    re.IGNORECASE,
)
_METHOD_SIG_RX = re.compile(
    r"^\+\s+"
    r"(?:(?:public|protected|private|static|final|abstract|synchronized|default)\s+)*"
    r"(?:\w+(?:<[^>]+>)?(?:\[\])*)\s+"  # return type (allows generics, arrays)
    r"(\w+)\s*\(",  # method name
)
_CLASS_DECL_RX = re.compile(
    r"^\+?\s*(?:public\s+)?(?:abstract\s+)?class\s+(\w+)",
)
_CLASS_MAPPING_RX = re.compile(
    r"^\+?\s*@RequestMapping\((?:value\s*=\s*)?\"([^\"]*)\"\)",
)


def detect_code_additions(git_diff: str) -> list[CodeAddition]:
    """Parse unified diff output and return new REST endpoint additions.

    Looks for pairs of added lines: ``@XxxMapping(...)`` immediately followed
    (within the same hunk) by a method signature.  Class-level ``@RequestMapping``
    is used to build the full path when present.
    """
    additions: list[CodeAddition] = []
    current_file = ""
    current_class = ""
    class_base_path = ""
    lines = git_diff.splitlines()
    hunk_lines: list[str] = []
    _hunk_start = 0

    def _flush_hunk() -> None:
        nonlocal hunk_lines
        _scan_hunk(hunk_lines, current_file, current_class, class_base_path, additions)
        hunk_lines = []

    for raw_line in lines:
        fh = _FILE_HEADER_RX.match(raw_line)
        if fh:
            _flush_hunk()
            current_file = fh.group(1)
            current_class = ""
            class_base_path = ""
            continue

        hh = _HUNK_HEADER_RX.match(raw_line)
        if hh:
            _flush_hunk()
            continue

        # Track class declarations and class-level @RequestMapping even on
        # unchanged lines (no leading +/-) so we always know the class context.
        cm = _CLASS_MAPPING_RX.match(raw_line)
        if cm:
            class_base_path = cm.group(1)

        cd = _CLASS_DECL_RX.match(raw_line)
        if cd and not raw_line.startswith("-"):
            current_class = cd.group(1)

        hunk_lines.append(raw_line)

    _flush_hunk()
    return additions


def _scan_hunk(
    lines: list[str],
    file: str,
    class_name: str,
    class_base_path: str,
    out: list[CodeAddition],
) -> None:
    """Scan one diff hunk for added @XxxMapping + method signature pairs."""
    i = 0
    while i < len(lines):
        line = lines[i]
        mm = _HTTP_MAPPING_RX.match(line)
        if mm:
            verb_raw = mm.group(1).upper()
            http_method = verb_raw + "PING"  # GetMapping → GET handled below
            http_method = verb_raw  # just use GET/POST/etc.
            method_path = (mm.group(2) or "").strip()
            full_path = _join(class_base_path, method_path)

            # Look ahead for the method signature (skip blank / comment lines)
            member_name = ""
            hunk_fragment = line
            for j in range(i + 1, min(i + 5, len(lines))):
                nxt = lines[j]
                hunk_fragment += "\n" + nxt
                sm = _METHOD_SIG_RX.match(nxt)
                if sm:
                    member_name = sm.group(1)
                    break

            if member_name or full_path:
                out.append(
                    CodeAddition(
                        kind="endpoint",
                        http_method=http_method,
                        path=full_path or f"/{member_name or 'unknown'}",
                        class_name=class_name,
                        member_name=member_name,
                        file=file,
                        diff_hunk=hunk_fragment.strip(),
                    )
                )
        i += 1


def _join(base: str, suffix: str) -> str:
    a = base.rstrip("/")
    b = suffix.strip()
    if not a and not b:
        return ""
    if not a:
        return b if b.startswith("/") else "/" + b
    if not b:
        return a
    if not b.startswith("/"):
        b = "/" + b
    return a + b


# ── EARS clause proposal ────────────────────────────────────────────────────

_RESOURCE_HINTS = {
    "obra": ("obra", "obras"),
    "perda": ("perda", "perdas"),
    "operacao": ("operação", "operações"),
    "item": ("item", "items"),
}


def _resource_name(path: str) -> str:
    """Guess a human-friendly singular resource name from a URL path segment."""
    segments = [s for s in path.split("/") if s and "{" not in s]
    if not segments:
        return "resource"
    last = segments[-1].lower().rstrip("s")
    for key, (singular, _) in _RESOURCE_HINTS.items():
        if last.startswith(key[:5]):
            return singular
    return last


def propose_ears_clause(addition: CodeAddition) -> list[str]:
    """Return one or more draft EARS clauses for the given code addition."""
    if addition.kind != "endpoint":
        return [f"The system SHALL handle {addition.member_name}"]

    method = (addition.http_method or "").upper()
    path = addition.path or ""
    resource = _resource_name(path)
    is_by_id = "{" in path

    if method == "POST":
        return [
            f"SHALL return HTTP 201 with the created {resource} in the body "
            f"when the request payload is valid",
            "IF required fields are missing or invalid, THEN the system SHALL "
            "return HTTP 400 with field-level violations",
        ]
    elif method == "GET" and is_by_id:
        return [
            f"IF the {resource} exists and belongs to the authenticated empresa, "
            f"THEN the system SHALL return HTTP 200 with the full {resource} representation",
            f"IF the {resource} does not exist OR belongs to a different empresa, "
            f"THEN the system SHALL return HTTP 404 (never 403, to prevent tenant enumeration)",
        ]
    elif method == "GET":
        return [
            f"SHALL return HTTP 200 with paginated list of {resource}s belonging "
            f"to the authenticated empresa (zero cross-tenant data leakage)",
            f"SHALL return HTTP 200 with empty content list when no {resource}s exist",
        ]
    elif method in ("PUT", "PATCH"):
        return [
            f"IF the {resource} exists and belongs to the authenticated empresa, "
            f"THEN the system SHALL return HTTP 200 with the updated {resource}",
            f"IF the {resource} does not exist, THEN the system SHALL return HTTP 404",
        ]
    elif method == "DELETE":
        return [
            f"IF the {resource} exists and belongs to the authenticated empresa, "
            f"THEN the system SHALL delete it and return HTTP 204",
            f"IF the {resource} does not exist, THEN the system SHALL return HTTP 404",
        ]
    else:
        return [f"The system SHALL handle {method} {path}"]


# ── Proposal document formatting ────────────────────────────────────────────


def format_proposal_doc(module: str, additions: list[CodeAddition]) -> str:
    """Build the human-editable Markdown proposal file."""
    today = date.today().isoformat()
    lines: list[str] = []
    lines.append(f"# Spec update proposals — {module} ({today})")
    lines.append("")
    lines.append(
        "> Review each proposal below. "
        "Change `- [ ]` to `- [x]` to approve a clause for application."
    )
    lines.append("> Delete any line you do NOT want applied.")
    lines.append(
        f"> When ready: `be-spec-drift apply {module} --from <this-file> --service <service-path>`"
    )
    lines.append("")
    lines.append("---")
    lines.append("")

    if not additions:
        lines.append("*No new code additions detected in the given range.*")
        lines.append("")
        return "\n".join(lines)

    for idx, addition in enumerate(additions, start=1):
        label = f"{addition.http_method} {addition.path}" if addition.kind == "endpoint" else addition.member_name
        method_ref = f"{addition.class_name}.{addition.member_name}" if addition.member_name else addition.class_name
        lines.append(f"## {idx}. New {addition.kind}: {label}")
        if method_ref:
            lines.append(f"  ({method_ref})")
        lines.append("")
        if addition.file:
            lines.append(f"**Source:** `{addition.file}`")
            lines.append("")
        lines.append("**Proposed EARS clauses** (check to approve):")
        lines.append("")
        for clause in propose_ears_clause(addition):
            lines.append(f"- [ ] {clause}")
        lines.append("")
        if addition.diff_hunk:
            lines.append("<details><summary>Diff context</summary>")
            lines.append("")
            lines.append("```diff")
            lines.append(addition.diff_hunk)
            lines.append("```")
            lines.append("")
            lines.append("</details>")
            lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


# ── Apply approved clauses ───────────────────────────────────────────────────

_APPROVED_RX = re.compile(r"^-\s*\[x\]\s+(.+)$", re.IGNORECASE)
_SECTION_HDR_RX = re.compile(r"^##\s+\d+\.\s+New \w+:\s+(.+)$")


def apply_approved_clauses(
    proposal_path: Path,
    spec_files: list[Path],
    changelog_path: Path | None = None,
    dry_run: bool = False,
) -> int:
    """Read proposal_path, collect ``- [x]`` lines, append to each spec file.

    Returns number of clauses applied (0 on dry-run also counts).
    """
    text = proposal_path.read_text(encoding="utf-8")

    # Collect (section_label, clause) pairs
    approved: list[tuple[str, str]] = []
    current_section = "New additions"
    for line in text.splitlines():
        sh = _SECTION_HDR_RX.match(line)
        if sh:
            current_section = sh.group(1).strip()
            continue
        am = _APPROVED_RX.match(line)
        if am:
            approved.append((current_section, am.group(1).strip()))

    if not approved:
        print("OK: no approved clauses (no '- [x]' lines found)")
        return 0

    # Pick the best spec file: longest path name (most specific) or first
    target_spec: Path | None = None
    if spec_files:
        target_spec = max(spec_files, key=lambda p: len(p.name))

    if not target_spec or not target_spec.exists():
        print(f"error: no spec file to patch (received {len(spec_files)} candidate(s))")
        return 0

    if dry_run:
        print(f"[dry-run] Would append {len(approved)} clause(s) to {target_spec}")
        for section, clause in approved:
            print(f"  [{section}]  {clause}")
        return len(approved)

    # Build the patch block
    patch_lines: list[str] = [
        "",
        f"<!-- spec-reverse-applied: {date.today().isoformat()} from {proposal_path.name} -->",
        "",
        "## Auto-proposed additions (review and integrate)",
        "",
    ]
    last_section = ""
    for section, clause in approved:
        if section != last_section:
            patch_lines.append(f"### {section}")
            patch_lines.append("")
            last_section = section
        patch_lines.append(f"- **SHALL** {clause}")
    patch_lines.append("")

    existing = target_spec.read_text(encoding="utf-8")
    updated = existing.rstrip() + "\n" + "\n".join(patch_lines)
    target_spec.write_text(updated, encoding="utf-8")
    print(f"OK: appended {len(approved)} clause(s) to {target_spec}")

    # Changelog
    if changelog_path:
        changelog_path.parent.mkdir(parents=True, exist_ok=True)
        entry_lines = [
            f"\n## {date.today().isoformat()} — spec-reverse-apply ({len(approved)} clause(s))\n",
            f"Source: {proposal_path}\n",
            f"Target: {target_spec}\n",
        ]
        for section, clause in approved:
            entry_lines.append(f"- [{section}] {clause}\n")
        with changelog_path.open("a", encoding="utf-8") as fh:
            fh.writelines(entry_lines)
        print(f"OK: changelog appended to {changelog_path}")

    return len(approved)


# ── Git helper ───────────────────────────────────────────────────────────────


def git_diff_since(since_sha: str, repo_path: Path) -> str:
    """Return ``git diff <since_sha> HEAD`` output for the given repo."""
    result = subprocess.run(
        ["git", "diff", since_sha, "HEAD"],
        cwd=str(repo_path),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"git diff failed: {result.stderr.strip()}")
    return result.stdout
