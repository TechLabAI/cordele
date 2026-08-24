"""issues-mirror.py — one-way mirror of issue .md files to GitHub issues (D-430).

The atomic issue files under ``docs/architecture/backend/issues/*.md`` (authored by
``/be-architect-backlog``) stay the **canonical** source — the planner/implementer
read the plan, never GitHub. This script is an **opt-in, one-way** mirror for human
visibility only: it creates/updates a GitHub issue per ``.md`` and writes the issue
number back into the file as a non-rendering HTML-comment marker, so re-runs update
instead of duplicating.

Nothing in the execution pipeline depends on it. It is gated twice: a GitHub repo
must be resolvable (``gh`` configured or ``--repo``), and ``--confirm`` is required to
actually push (otherwise use ``--dry-run``). A repo with no remote → clean no-op.

Usage:
    py scripts/issues-mirror.py status                          # what is mirrored vs not
    py scripts/issues-mirror.py mirror --dry-run                # preview create/update
    py scripts/issues-mirror.py mirror --confirm                # push to GitHub
    py scripts/issues-mirror.py mirror --confirm --repo o/r --label backlog

Default dir: docs/architecture/backend/issues (relative to cwd). Run from project root.
Exit codes (R3): 0 success | 1 user/gate error | 2 one or more issues failed.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

_DEFAULT_DIR = "docs/architecture/backend/issues"
_SKIP = re.compile(r"^(issues_map|index|readme)", re.IGNORECASE)
_H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
_MARKER_RE = re.compile(r"<!--\s*github-issue:\s*(\d+)\s*-->")
_ISSUE_ID_RE = re.compile(r"^(INT-[A-Z]+-\d+|[A-Z]+-\d+)")


def _issue_files(directory: Path) -> list[Path]:
    return sorted(
        f for f in directory.glob("*.md")
        if f.is_file() and not _SKIP.match(f.name)
    )


def _parse(path: Path) -> tuple[str | None, int | None, str]:
    """Return (title, github_number, full_text). Title is the H1 text."""
    text = path.read_text(encoding="utf-8", errors="replace")
    m = _H1_RE.search(text)
    title = m.group(1).strip() if m else None
    num = None
    mm = _MARKER_RE.search(text)
    if mm:
        num = int(mm.group(1))
    return title, num, text


def _body_without_marker(text: str) -> str:
    """Body sent to GitHub: drop the mirror marker line (kept only in the .md)."""
    return re.sub(r"[ \t]*<!--\s*github-issue:\s*\d+\s*-->\n?", "", text)


def _write_marker(path: Path, text: str, number: int) -> None:
    """Insert the marker right after the H1 line; atomic (R3)."""
    if _MARKER_RE.search(text):
        return
    lines = text.splitlines(keepends=True)
    out, inserted = [], False
    for line in lines:
        out.append(line)
        if not inserted and line.lstrip().startswith("# "):
            if not out[-1].endswith("\n"):
                out[-1] += "\n"
            out.append(f"<!-- github-issue: {number} -->\n")
            inserted = True
    if not inserted:  # no H1 — prepend
        out.insert(0, f"<!-- github-issue: {number} -->\n")
    tmp = path.with_suffix(".md.tmp")
    tmp.write_text("".join(out), encoding="utf-8")
    tmp.replace(path)


def _gh(args: list[str], *, stdin: str | None = None) -> tuple[int, str, str]:
    proc = subprocess.run(
        ["gh", *args], input=stdin, capture_output=True, text=True,
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def _resolve_repo(explicit: str | None) -> str | None:
    if explicit:
        return explicit
    rc, out, _ = _gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
    return out if rc == 0 and out else None


def _resolve_dir(arg: str | None) -> Path:
    d = Path(arg) if arg else Path(_DEFAULT_DIR)
    if d.is_dir():
        return d
    # walk up from cwd looking for the default path (run-from-subdir convenience)
    for base in [Path.cwd(), *Path.cwd().parents]:
        cand = base / _DEFAULT_DIR
        if cand.is_dir():
            return cand
    return d


def cmd_status(args: argparse.Namespace) -> int:
    directory = _resolve_dir(args.dir)
    if not directory.is_dir():
        print(f"info: no issues directory at {directory}")
        return 0
    files = _issue_files(directory)
    mirrored = unmirrored = 0
    for f in files:
        _title, num, _ = _parse(f)
        if num:
            mirrored += 1
            print(f"  #{num:<6} {f.name}")
        else:
            unmirrored += 1
            print(f"  {'-':<7} {f.name}")
    print(f"\nOK: {len(files)} issue file(s) — {mirrored} mirrored, {unmirrored} not")
    return 0


def cmd_mirror(args: argparse.Namespace) -> int:
    directory = _resolve_dir(args.dir)
    if not directory.is_dir():
        print(f"error: no issues directory at {directory}", file=sys.stderr)
        return 1

    files = _issue_files(directory)
    if not files:
        print(f"info: no issue files in {directory}")
        return 0

    if not args.dry_run and not args.confirm:
        print("error: refusing to push without --confirm (or use --dry-run)", file=sys.stderr)
        return 1

    if not args.dry_run and shutil.which("gh") is None:
        print("error: gh CLI not found (install GitHub CLI or use --dry-run)", file=sys.stderr)
        return 1

    repo = None
    if not args.dry_run:
        repo = _resolve_repo(args.repo)
        if not repo:
            print("info: no GitHub repo resolvable (no remote / gh not authed) — no-op")
            return 0

    created = updated = failed = 0
    for f in files:
        title, num, text = _parse(f)
        if not title:
            print(f"warning: {f.name} has no H1 title — skipped", file=sys.stderr)
            continue
        body = _body_without_marker(text)
        action = "update" if num else "create"

        if args.dry_run:
            tgt = f"#{num}" if num else "new"
            print(f"  [{action:<6}] {tgt:<6} {title}")
            continue

        if num:
            gh_args = ["issue", "edit", str(num), "--repo", repo,
                       "--title", title, "--body-file", "-"]
            rc, _out, err = _gh(gh_args, stdin=body)
            if rc == 0:
                updated += 1
                print(f"  updated #{num}  {title}")
            else:
                failed += 1
                print(f"  error editing #{num} ({err})", file=sys.stderr)
        else:
            gh_args = ["issue", "create", "--repo", repo,
                       "--title", title, "--body-file", "-"]
            for lbl in args.label or []:
                gh_args += ["--label", lbl]
            rc, out, err = _gh(gh_args, stdin=body)
            if rc == 0:
                m = re.search(r"/issues/(\d+)", out)
                if m:
                    new_num = int(m.group(1))
                    _write_marker(f, text, new_num)
                    created += 1
                    print(f"  created #{new_num}  {title}")
                else:
                    failed += 1
                    print(f"  created but could not parse number from: {out}", file=sys.stderr)
            else:
                failed += 1
                print(f"  error creating {f.name} ({err})", file=sys.stderr)

    if args.dry_run:
        print(f"\nOK: dry-run — {len(files)} issue file(s) inspected")
        return 0
    print(f"\nOK: mirror complete — {created} created, {updated} updated, {failed} failed")
    return 2 if failed else 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="One-way mirror of issue .md files to GitHub issues (D-430)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_st = sub.add_parser("status", help="Show which issues are mirrored")
    p_st.add_argument("--dir", default=None)

    p_mi = sub.add_parser("mirror", help="Create/update GitHub issues from .md files")
    p_mi.add_argument("--dir", default=None, help=f"Issues dir (default: {_DEFAULT_DIR})")
    p_mi.add_argument("--repo", default=None, help="OWNER/NAME (default: gh-resolved repo)")
    p_mi.add_argument("--label", action="append", help="Label to add on create (repeatable)")
    p_mi.add_argument("--confirm", action="store_true", help="Actually push to GitHub")
    p_mi.add_argument("--dry-run", action="store_true", help="Preview without calling gh")

    args = parser.parse_args()
    dispatch = {"status": cmd_status, "mirror": cmd_mirror}
    sys.exit(dispatch[args.command](args))


if __name__ == "__main__":
    main()
